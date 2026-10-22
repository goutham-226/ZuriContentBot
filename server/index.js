import express from 'express';
import cookieParser from 'cookie-parser';
import { mkdir } from 'node:fs/promises';
import { one, query, migrate } from './lib/db.js';
import { HttpError, signup, login, logout, loadUser, requireUser } from './lib/auth.js';
import { apiThrottle, hit, pruneRateLimits } from './lib/rateLimit.js';
import { getBudget, assertBudget } from './lib/budget.js';
import { getSubscription, serializeSubscription, requireActivePlan, checkout, cancel, buyPack, reserveCredits, refundCredits, pitchesUsed, spendableCredits } from './lib/billing.js';
import { MEDIA_DIR, RENDER_STATUSES, researchAndPitch, render, generateBrand, recoverInterruptedRuns } from './lib/pipeline.js';
import { hasReplicateToken } from './lib/replicate.js';
import { streamVideo } from './lib/videos.js';
import { getNiche, voiceOrDefault } from '../src/data/niches.js';
import { DURATIONS, RESOLUTION, creditsFor } from '../src/data/pricing.js';
import { estimateRunCost, PITCH_COST, REPITCH_COST, BRAND_COST } from './lib/costs.js';

const app = express();
const port = Number(process.env.PORT) || 3001;

app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use('/media', express.static(MEDIA_DIR, { maxAge: '7d' }));
// Video streaming is registered before the API throttle: players send many Range requests
app.get('/api/runs/:id/video', loadUser, requireUser, streamVideo);
app.use('/api', loadUser, apiThrottle());

// ---------- Auth ----------
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.post('/api/auth/logout', logout);

app.get('/api/me', async (req, res) => {
  if (!req.user) return res.json({ user: null, subscription: null });
  const sub = await getSubscription(req.user.id);
  res.json({
    user: req.user,
    subscription: serializeSubscription(sub, sub && (await pitchesUsed(req.user.id, sub.current_period_start))),
  });
});

// ---------- Billing (test mode) ----------
app.post('/api/billing/checkout', requireUser, async (req, res) => {
  const sub = await checkout(req.user.id, req.body.planId);
  res.json({ subscription: serializeSubscription(sub, 0), testMode: true });
});

app.post('/api/billing/credits', requireUser, async (req, res) => {
  const sub = await buyPack(req.user.id, req.body.packId);
  res.json({ subscription: serializeSubscription(sub, 0), testMode: true });
});

app.post('/api/billing/cancel', requireUser, async (req, res) => {
  res.json({ subscription: serializeSubscription(await cancel(req.user.id), 0) });
});

// ---------- Bots ----------
// Normalizes bot settings. Reference media is chosen by the pipeline, never the user.
function cleanSettings(body = {}) {
  return {
    voice: voiceOrDefault(body.voice),
    defaultDuration: DURATIONS.includes(Number(body.defaultDuration)) ? Number(body.defaultDuration) : 60,
    styleNotes: String(body.styleNotes || '').slice(0, 600),
    audienceNotes: String(body.audienceNotes || '').slice(0, 400),
  };
}

async function ownedBot(userId, botId) {
  const bot = await one('SELECT * FROM bots WHERE id = $1 AND user_id = $2', [botId, userId]).catch(() => null);
  if (!bot) throw new HttpError(404, 'Bot not found.');
  return bot;
}

function requireReplicate() {
  if (!hasReplicateToken()) throw new HttpError(503, 'REPLICATE_API_TOKEN is not set on the server.');
}

// Designs the channel identity in the background; errors land on the bot row
function startBrand(botId, notes) {
  generateBrand(botId, { notes }).catch(() => {});
}

app.get('/api/bots', requireUser, async (req, res) => {
  const { rows } = await query(
    `SELECT b.*, (SELECT count(*)::int FROM runs r WHERE r.bot_id = b.id AND r.status = 'done') AS videos,
       (SELECT max(created_at) FROM runs r WHERE r.bot_id = b.id) AS last_run_at
     FROM bots b WHERE b.user_id = $1 ORDER BY b.created_at DESC`,
    [req.user.id]
  );
  res.json({ bots: rows });
});

app.post('/api/bots', requireUser, async (req, res) => {
  const sub = await requireActivePlan(req.user.id);
  const name = String(req.body.name || '').trim().slice(0, 40);
  const niche = getNiche(req.body.nicheId);
  if (!name) throw new HttpError(400, 'Give your bot a name.');
  if (!niche) throw new HttpError(400, 'Pick a niche.');
  const { count } = await one('SELECT count(*)::int AS count FROM bots WHERE user_id = $1', [req.user.id]);
  if (count >= sub.plan.bots) throw new HttpError(403, `Your ${sub.plan.name} plan allows ${sub.plan.bots} bots. Upgrade for more.`);

  const bot = await one(
    'INSERT INTO bots (user_id, name, niche_id, settings) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.user.id, name, niche.id, cleanSettings(req.body.settings)]
  );
  // Design the channel identity right away so it's ready by the first video
  const budget = await getBudget(req.user.id);
  if (hasReplicateToken() && (!budget || budget.leftCents >= BRAND_COST * 100)) {
    await query(`UPDATE bots SET brand_status = 'generating' WHERE id = $1`, [bot.id]);
    startBrand(bot.id, String(req.body.brandNotes || '').slice(0, 400));
  }
  res.status(201).json({ bot });
});

app.get('/api/bots/:id', requireUser, async (req, res) => {
  const bot = await ownedBot(req.user.id, req.params.id);
  const { rows: runs } = await query(
    `SELECT id, status, duration_sec, chosen_idea->>'title' AS title, video_url, created_at
     FROM runs WHERE bot_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [bot.id]
  );
  res.json({ bot, runs });
});

app.patch('/api/bots/:id', requireUser, async (req, res) => {
  const bot = await ownedBot(req.user.id, req.params.id);
  const name = String(req.body.name || bot.name).trim().slice(0, 40);
  const updated = await one('UPDATE bots SET name = $2, settings = $3 WHERE id = $1 RETURNING *', [
    bot.id, name, cleanSettings({ ...bot.settings, ...req.body.settings }),
  ]);
  res.json({ bot: updated });
});

// (Re)design the bot's channel identity, optionally steered by notes
app.post('/api/bots/:id/brand', requireUser, async (req, res) => {
  requireReplicate();
  await requireActivePlan(req.user.id);
  const bot = await ownedBot(req.user.id, req.params.id);
  if (bot.brand_status === 'generating') throw new HttpError(409, 'The identity is already being designed.');
  await hit(`brand:${req.user.id}`, 10, 86400, 'You can redesign identities 10 times a day.');
  await assertBudget(req.user.id, BRAND_COST);
  await query(`UPDATE bots SET brand_status = 'generating', brand_error = NULL WHERE id = $1`, [bot.id]);
  startBrand(bot.id, String(req.body.notes || '').slice(0, 400));
  res.json({ ok: true });
});

app.delete('/api/bots/:id', requireUser, async (req, res) => {
  const bot = await ownedBot(req.user.id, req.params.id);
  const busy = await one('SELECT 1 FROM runs WHERE bot_id = $1 AND status = ANY($2)', [bot.id, RENDER_STATUSES]);
  if (busy) throw new HttpError(409, 'This bot is rendering a video. Delete it once that finishes.');
  await query('DELETE FROM bots WHERE id = $1', [bot.id]);
  res.json({ ok: true });
});

// ---------- Runs ----------
// Research rounds are capped per billing period (their LLM cost is priced into the plan)
async function requirePitchAllowance(sub) {
  const used = await pitchesUsed(sub.user_id, sub.current_period_start);
  if (used >= sub.plan.pitchesPerMonth) {
    throw new HttpError(429, `You've used all ${sub.plan.pitchesPerMonth} idea rounds this month on ${sub.plan.name}. Upgrade or wait for your monthly reset.`);
  }
}

// Ask the bot for a new video: it researches and pitches, then waits for approval
app.post('/api/bots/:id/runs', requireUser, async (req, res) => {
  requireReplicate();
  const sub = await requireActivePlan(req.user.id);
  const bot = await ownedBot(req.user.id, req.params.id);
  const duration = Number(req.body.durationSec) || bot.settings.defaultDuration || 60;
  if (!DURATIONS.includes(duration)) throw new HttpError(400, 'Duration must be 1, 1.5, 2 or 3 minutes.');
  if (duration > sub.plan.maxDuration) throw new HttpError(403, `${sub.plan.name} supports videos up to ${sub.plan.maxDuration / 60} minutes.`);
  // Don't research a video the balance can't pay for
  const needed = creditsFor(duration);
  if (spendableCredits(sub) < needed) {
    throw new HttpError(402, `A ${duration / 60}-minute video needs ${needed} credits and you have ${spendableCredits(sub)}. Buy a credit pack or pick a shorter length.`);
  }
  await requirePitchAllowance(sub);
  await assertBudget(req.user.id, PITCH_COST + (bot.brand_status === 'ready' ? 0 : BRAND_COST));

  const run = await one(
    `INSERT INTO runs (bot_id, user_id, duration_sec, resolution, topic_hint, progress)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [bot.id, req.user.id, duration, RESOLUTION, String(req.body.topicHint || '').slice(0, 300) || null,
      JSON.stringify({ message: 'Starting research…' })]
  );
  researchAndPitch(run.id);
  res.status(201).json({ runId: run.id });
});

async function ownedRun(userId, runId) {
  const run = await one(
    `SELECT r.*, b.name AS bot_name, b.niche_id FROM runs r JOIN bots b ON b.id = r.bot_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [runId, userId]
  ).catch(() => null);
  if (!run) throw new HttpError(404, 'Run not found.');
  return run;
}

app.get('/api/runs/:id', requireUser, async (req, res) => {
  // Provider spend (cost_cents) is internal and never leaves the server
  const { cost_cents: _cost, ...run } = await ownedRun(req.user.id, req.params.id);
  res.json({ run: { ...run, credits_needed: creditsFor(run.duration_sec) } });
});

// Owner rejects the pitches; bot re-pitches using the same research + feedback
app.post('/api/runs/:id/regenerate', requireUser, async (req, res) => {
  requireReplicate();
  const sub = await requireActivePlan(req.user.id);
  const run = await ownedRun(req.user.id, req.params.id);
  if (run.status !== 'awaiting_approval') throw new HttpError(409, 'This run is not waiting for approval.');
  await requirePitchAllowance(sub);
  await assertBudget(req.user.id, REPITCH_COST);
  await query(`UPDATE runs SET status = 'researching', progress = $2, updated_at = now() WHERE id = $1`, [
    run.id, JSON.stringify({ message: 'Re-thinking ideas with your feedback…' }),
  ]);
  researchAndPitch(run.id, { feedback: String(req.body.feedback || '').slice(0, 500) });
  res.json({ ok: true });
});

// Owner approves one idea: reserve credits and start rendering
app.post('/api/runs/:id/approve', requireUser, async (req, res) => {
  requireReplicate();
  const sub = await requireActivePlan(req.user.id);
  const run = await ownedRun(req.user.id, req.params.id);
  if (run.status !== 'awaiting_approval') throw new HttpError(409, 'This run is not waiting for approval.');
  const idea = run.ideas?.ideas?.[Number(req.body.ideaIndex)];
  if (!idea) throw new HttpError(400, 'Pick one of the pitched ideas.');

  const { count: rendering } = await one(
    'SELECT count(*)::int AS count FROM runs WHERE user_id = $1 AND status = ANY($2)',
    [req.user.id, RENDER_STATUSES]
  );
  if (rendering >= sub.plan.concurrentRenders) {
    throw new HttpError(429, `${sub.plan.name} renders ${sub.plan.concurrentRenders} video(s) at a time. Approve this one when the current render finishes.`);
  }

  // 10% headroom: voice-over can run a little long and clips round up to whole seconds
  await assertBudget(req.user.id, estimateRunCost(run.duration_sec).total * 1.1);
  const credits = creditsFor(run.duration_sec);
  const fromPurchased = await reserveCredits(req.user.id, credits);
  if (fromPurchased === null) {
    throw new HttpError(402, `This video needs ${credits} credits and you have ${spendableCredits(sub)}. Buy a credit pack or wait for your monthly reset.`);
  }
  // Guarded update so a double-click can't start two renders
  const claimed = await one(
    `UPDATE runs SET status = 'scripting', chosen_idea = $2, credits_reserved = $3, credits_from_purchased = $4, updated_at = now()
     WHERE id = $1 AND status = 'awaiting_approval' RETURNING id`,
    [run.id, JSON.stringify({ ...idea, notes: String(req.body.notes || '').slice(0, 500) }), credits, fromPurchased]
  );
  if (!claimed) {
    await refundCredits(req.user.id, credits, fromPurchased);
    throw new HttpError(409, 'This run was already approved.');
  }
  render(run.id);
  res.json({ ok: true, creditsReserved: credits });
});

app.post('/api/runs/:id/discard', requireUser, async (req, res) => {
  const run = await ownedRun(req.user.id, req.params.id);
  if (run.status !== 'awaiting_approval') throw new HttpError(409, 'Only pending ideas can be discarded.');
  await query(`UPDATE runs SET status = 'discarded', updated_at = now() WHERE id = $1`, [run.id]);
  res.json({ ok: true });
});

// ---------- Errors ----------
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (err.retryAfterSec) res.set('Retry-After', String(err.retryAfterSec));
  res.status(status).json({ error: status >= 500 && status !== 503 ? 'Something went wrong.' : err.message });
});

await migrate();
await mkdir(MEDIA_DIR, { recursive: true });
await recoverInterruptedRuns();
setInterval(() => pruneRateLimits().catch(() => {}), 6 * 3600 * 1000).unref();

app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
  if (!hasReplicateToken()) console.warn('REPLICATE_API_TOKEN not set: sign-in works, but bots cannot research or render.');
});
