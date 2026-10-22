import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { one, query } from './db.js';
import { getNiche, voiceOrDefault } from '../../src/data/niches.js';
import { creditsFor } from '../../src/data/pricing.js';
import { UNIT_COSTS, RUN_ASSUMPTIONS } from './costs.js';
import { gatherSignals } from './research.js';
import { designBrand, extractFacts, analyzeTrends, pitchIdeas, writeScript } from './agent.js';
import { generateImage, generateVoice, generateVideo, generateSfx } from './replicate.js';
import { download, probeDuration, buildSegment, writeCaptions, finalize, extractLastFrame, makeReference, sliceNarration, silence } from './ffmpeg.js';
import { refundCredits } from './billing.js';
import { charge } from './budget.js';
import { saveVideo } from './videos.js';

export const MEDIA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'media');

// Statuses where work is happening in this process (lost on restart)
export const ACTIVE_STATUSES = ['researching', 'scripting', 'designing', 'voicing', 'rendering', 'editing'];
export const RENDER_STATUSES = ACTIVE_STATUSES.filter((s) => s !== 'researching');

const jsonParam = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

async function update(runId, fields) {
  const keys = Object.keys(fields);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE runs SET ${sets}, updated_at = now() WHERE id = $1`, [runId, ...keys.map((k) => jsonParam(fields[k]))]);
}

const botFromRow = (row) => ({
  id: row.bot_id ?? row.id,
  userId: row.user_id,
  name: row.bot_name ?? row.name,
  niche: getNiche(row.niche_id),
  settings: row.bot_settings ?? row.settings ?? {},
  brand: row.brand_status === 'ready' ? row.brand : null,
});

async function loadRun(runId) {
  const run = await one(
    `SELECT r.*, b.name AS bot_name, b.niche_id, b.settings AS bot_settings, b.brand, b.brand_status
     FROM runs r JOIN bots b ON b.id = r.bot_id WHERE r.id = $1`,
    [runId]
  );
  return { run, bot: botFromRow(run) };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function recentTitles(botId, excludeRunId) {
  const { rows } = await query(
    `SELECT chosen_idea->>'title' AS title FROM runs
     WHERE bot_id = $1 AND id <> $2 AND chosen_idea IS NOT NULL ORDER BY created_at DESC LIMIT 20`,
    [botId, excludeRunId]
  );
  return rows.map((r) => r.title).filter(Boolean);
}

async function fail(runId, err) {
  console.error(`[run ${runId}]`, err.message || err);
  const run = await one('SELECT user_id, credits_reserved, credits_charged, credits_from_purchased FROM runs WHERE id = $1', [runId]);
  if (run) await refundCredits(run.user_id, run.credits_reserved - run.credits_charged, run.credits_from_purchased);
  await update(runId, { status: 'failed', error: String(err.message || err).slice(0, 500), credits_reserved: 0 });
}

// ---------- Channel identity (once per bot) ----------

export async function generateBrand(botId, { notes } = {}) {
  const row = await one('SELECT * FROM bots WHERE id = $1', [botId]);
  const bot = botFromRow(row);
  const spend = (usd) => charge(bot.userId, usd);
  await query(`UPDATE bots SET brand_status = 'generating', brand_error = NULL WHERE id = $1`, [botId]);
  try {
    const brand = await designBrand({ bot, notes, spend });
    const dir = path.join(MEDIA_DIR, 'brands', botId);
    await mkdir(dir, { recursive: true });
    const version = Date.now(); // cache-buster when the identity is regenerated
    const look = `${brand.style.look}. Lighting: ${brand.style.lighting}. Color grade: ${brand.style.colorGrade}`;

    await spend(UNIT_COSTS.image * 2);
    const [characterUrl, styleUrl] = await Promise.all([
      generateImage(`Character reference sheet of ${brand.character.name}: ${brand.character.look}. Full body and face clearly visible, front view, neutral pose, plain softly lit background. ${look}. No text.`),
      generateImage(`Establishing shot that defines the visual world of a ${bot.niche.name} channel: ${look}. Camera: ${brand.style.camera}. No people, no text.`),
    ]);
    await download(characterUrl, path.join(dir, 'character.jpg'));
    await download(styleUrl, path.join(dir, 'style.jpg'));
    brand.characterImage = `/media/brands/${botId}/character.jpg?v=${version}`;
    brand.styleImage = `/media/brands/${botId}/style.jpg?v=${version}`;

    await query(`UPDATE bots SET brand = $2, brand_status = 'ready' WHERE id = $1`, [botId, JSON.stringify(brand)]);
    return brand;
  } catch (err) {
    console.error(`[brand ${botId}]`, err.message || err);
    await query(`UPDATE bots SET brand_status = 'failed', brand_error = $2 WHERE id = $1`, [botId, String(err.message || err).slice(0, 300)]);
    throw err;
  }
}

// Returns the bot's identity, generating it (or waiting for a generation in flight)
async function ensureBrand(botId) {
  for (let waited = 0; waited < 180; waited += 3) {
    const row = await one('SELECT brand, brand_status FROM bots WHERE id = $1', [botId]);
    if (row.brand_status === 'ready') return row.brand;
    if (row.brand_status !== 'generating') return generateBrand(botId);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Channel identity is taking too long to generate. Try again.');
}

// Brand images are local files; Buffers are uploaded to Replicate by the client
const mediaFile = (url) => path.join(MEDIA_DIR, url.replace(/^\/media\//, '').replace(/\?.*$/, ''));

// ---------- Phase 1: research + pitch, then wait for the owner ----------

export async function researchAndPitch(runId, { feedback } = {}) {
  try {
    let { run, bot } = await loadRun(runId);
    const spend = (usd) => charge(run.user_id, usd, runId);
    // The channel identity is designed alongside the research instead of before it
    const brandReady = ensureBrand(bot.id).catch(() => null);
    let research = run.research;

    // Live progress the run page animates: current stage, when it started, and a
    // growing preview of what Zuri has found so far
    const progress = { stage: 'scan', startedAt: new Date().toISOString(), preview: {}, message: '' };
    const stage = (key, message) => update(runId, { progress: Object.assign(progress, { stage: key, message }) });

    if (!research) {
      await stage('scan', 'Scanning news, Google Trends, niche blogs and Wikipedia…');
      const signals = await gatherSignals(bot.niche, run.topic_hint);
      progress.preview.focus = signals.focusTopics;
      progress.preview.sources = [...signals.articles, ...signals.wiki, ...signals.news.slice(0, 4), ...signals.trends.slice(0, 3)]
        .slice(0, 14)
        .map((i) => ({ source: i.source, title: i.title }));

      await stage('mine', `Reading ${signals.articles.length + signals.wiki.length} articles and mining stories…`);
      const { facts, stories, sources } = await extractFacts({ bot, signals, topicHint: run.topic_hint, spend });
      progress.preview.facts = facts.slice(0, 6).map((f) => f.fact);
      progress.preview.stories = stories.slice(0, 6).map((st) => st.headline);

      bot = { ...bot, brand: await brandReady };
      await stage('angles', 'Turning stories into viral angles…');
      const analysis = await analyzeTrends({ bot, signals, facts, stories, sources, topicHint: run.topic_hint, recentTitles: await recentTitles(run.bot_id, runId), spend });
      progress.preview.angles = (analysis.angles || []).slice(0, 8).map((an) => an.angle);

      // Article bodies were only needed for story mining; keep the row small
      const stored = { ...signals, articles: signals.articles.map(({ text, ...a }) => a), wiki: signals.wiki.map(({ text, ...w }) => w) };
      research = { signals: stored, facts, stories, sources, trends: analysis.trends || [], angles: analysis.angles || [] };
      await update(runId, { research });
    } else {
      bot = { ...bot, brand: await brandReady };
      progress.preview = { facts: (research.facts || []).slice(0, 6).map((f) => f.fact), angles: (research.angles || []).slice(0, 8).map((an) => an.angle) };
    }

    await stage('pitch', feedback ? 'Re-pitching with your feedback…' : 'Writing 4 pitches…');
    const rejected = (run.ideas?.ideas || []).map((i) => i.title);
    const ideas = await pitchIdeas({
      bot, research, durationSec: run.duration_sec, feedback, rejected, spend,
      onCritic: () => stage('critic', 'Critic is scoring the pitches and keeping the best 3…'),
    });

    await query('UPDATE runs SET pitches = pitches + 1 WHERE id = $1', [runId]);
    await update(runId, { status: 'awaiting_approval', ideas, progress: { message: 'Waiting for your approval' } });
  } catch (err) {
    await fail(runId, err);
  }
}

// ---------- Phase 2: after approval — one continuous shot ----------
//
// Script -> opening keyframe -> voice-over (always before any video) -> a chain of
// 15s clips. Clip 1 opens on the keyframe; every later clip continues from the
// previous one (its last frame as first frame, the clip itself as reference video).
// Every clip gets the bot's character sheet + style frame so the recurring character
// stays on-model, and its own 15s narration slice as reference audio.

const CLIP = RUN_ASSUMPTIONS.clipSeconds;
const MAX_REFERENCE_SECONDS = 14.9; // the model caps reference video and audio at 15s combined each
const VO_ROOM = 13.8; // narration must end well before the clip does (clips follow the audio's length)

export async function render(runId) {
  try {
    const { run, bot: baseBot } = await loadRun(runId);
    const spend = (usd) => charge(run.user_id, usd, runId);
    const brand = await ensureBrand(baseBot.id);
    const bot = { ...baseBot, brand };
    const dir = path.join(MEDIA_DIR, runId);
    await mkdir(dir, { recursive: true });
    const file = (name) => path.join(dir, name);
    const mediaUrl = (name) => `/media/${runId}/${name}`;
    const progress = { message: '', scenes: [] };
    const save = (fields = {}) => update(runId, { progress, ...fields });

    // Script: one continuous shot in 15s segments
    progress.message = 'Writing the script and shot plan from the fact sheet…';
    await save({ status: 'scripting' });
    const script = await writeScript({ bot, idea: run.chosen_idea, durationSec: run.duration_sec, notes: run.chosen_idea.notes, facts: run.research?.facts, spend });
    const segments = script.segments;
    progress.scenes = segments.map(() => ({}));
    await save({ script });

    // Opening keyframe in the channel's house style
    progress.message = 'Designing the opening frame…';
    await save({ status: 'designing' });
    const house = `${brand.style.look}. Lighting: ${brand.style.lighting}. Color grade: ${brand.style.colorGrade}`;
    await spend(UNIT_COSTS.image);
    const openingUrl = await generateImage(`${script.openingFrame}. ${house}. Vertical 9:16, no text.`);
    await download(openingUrl, file('opening.jpg'));
    progress.opening = mediaUrl('opening.jpg');

    // Voice-over per segment. Anything longer than its slot is sped up slightly;
    // every slice is then padded/cut to exactly 14.9s so it can drive its clip.
    progress.message = 'Recording the ElevenLabs v3 voice-over…';
    await save({ status: 'voicing' });
    const voice = voiceOrDefault(bot.settings.voice); // older bots may hold a retired voice name
    await mapLimit(segments, 3, async (seg, i) => {
      const name = `voice-${i}.mp3`;
      seg.hasNarration = Boolean(seg.narration);
      if (seg.hasNarration) {
        await spend((seg.narration.length / 1000) * UNIT_COSTS.voicePer1kChars);
        await download(await generateVoice(seg.narration, voice), file(name));
      } else {
        await silence(dir, 1, name);
      }
      const raw = await probeDuration(file(name));
      const tempo = raw > VO_ROOM ? Math.min(1.3, raw / VO_ROOM) : 1;
      seg.voiceSeconds = Math.min(MAX_REFERENCE_SECONDS, raw / tempo);
      seg.segmentSeconds = CLIP;
      await sliceNarration(dir, name, `narration-${i}.mp3`, { tempo, seconds: MAX_REFERENCE_SECONDS });
      progress.scenes[i].voiceSeconds = Math.round(seg.voiceSeconds * 10) / 10;
      await save();
    });

    // The clip chain — strictly sequential, each clip continues the last. Each clip
    // is filmed FROM its narration (keep_audio), so picture and words line up.
    const characterSheet = await readFile(mediaFile(brand.characterImage));
    const styleFrame = await readFile(mediaFile(brand.styleImage));
    const refSeconds = Math.min(MAX_REFERENCE_SECONDS, RUN_ASSUMPTIONS.referenceSeconds);
    const sfxJobs = []; // foley for finished clips runs while the next clip renders
    await save({ status: 'rendering' });

    for (const [i, seg] of segments.entries()) {
      progress.message = i === 0
        ? `Rendering segment 1 of ${segments.length}…`
        : `Rendering segment ${i + 1} of ${segments.length}, continuing from segment ${i}…`;
      await save();

      const firstFrame = await readFile(i === 0 ? file('opening.jpg') : file(`last-${i - 1}.jpg`));
      const reference = i === 0 ? [] : [await readFile(file(`ref-${i - 1}.mp4`))];
      const narration = seg.hasNarration ? [await readFile(file(`narration-${i}.mp3`))] : [];
      const lines = [
        i === 0 ? '' : 'Continue seamlessly from the reference video: same place, same lighting, same characters, no cut.',
        `Camera: ${seg.camera || 'one slow, continuous move'}.`,
        `First half: ${seg.firstHalf}.`,
        `Second half: ${seg.secondHalf}.`,
        seg.featuresCharacter ? `Exactly one ${brand.character.name} in frame, matching the character reference image: ${brand.character.look}.` : '',
        seg.hasNarration ? 'The audio is an off-screen voice-over narrator. Time the action to it. Nobody on screen speaks or moves their lips.' : '',
        `Visual style: ${house}.`,
        'One continuous shot. No cuts, text, captions, logos or split screens.',
      ];
      const input = {
        prompt: lines.filter(Boolean).join(' '),
        firstFrame,
        images: [characterSheet, styleFrame],
        videos: reference,
        audios: narration,
        keepAudio: narration.length === 1,
        seconds: CLIP,
        aspectRatio: '9:16',
      };

      // One retry: a single failed clip shouldn't sink a 12-clip chain
      let url;
      for (let attempt = 0; !url; attempt++) {
        await spend(
          CLIP * UNIT_COSTS.videoPerSecond +
            3 * UNIT_COSTS.refImage +
            (narration.length ? MAX_REFERENCE_SECONDS * UNIT_COSTS.refAudioPerSecond : 0) +
            (i === 0 ? 0 : refSeconds * UNIT_COSTS.refVideoPerSecond)
        );
        try {
          url = await generateVideo(input);
        } catch (err) {
          if (attempt >= 1 || err.name === 'SpendCapError') throw err;
        }
      }
      await download(url, file(`clip-${i}.mp4`));
      // keep_audio makes the clip as long as its narration slice; edit to its real length
      seg.segmentSeconds = Math.min(CLIP, await probeDuration(file(`clip-${i}.mp4`)));
      if (i < segments.length - 1) {
        await extractLastFrame(dir, `clip-${i}.mp4`, `last-${i}.jpg`);
        await makeReference(dir, `clip-${i}.mp4`, `ref-${i}.mp4`, refSeconds);
      }
      await extractLastFrame(dir, `clip-${i}.mp4`, `thumb-${i}.jpg`);
      progress.scenes[i].image = mediaUrl(`thumb-${i}.jpg`);
      progress.scenes[i].clip = true;
      await save();

      // Foley pass in the background; a failed one just leaves the segment without SFX
      sfxJobs[i] = (async () => {
        await spend(UNIT_COSTS.sfxPerClip);
        const sfxUrl = await generateSfx({ video: await readFile(file(`clip-${i}.mp4`)), prompt: seg.sfx || 'quiet room tone', seconds: seg.segmentSeconds });
        await download(sfxUrl, file(`sfx-${i}.mp4`));
        return `sfx-${i}.mp4`;
      })().catch((err) => {
        // Never rethrow here: nothing awaits this promise yet, and an unhandled
        // rejection would take the whole server down. Errors are checked below.
        if (err.name !== 'SpendCapError') console.warn(`[run ${runId}] sound effects for segment ${i + 1} skipped: ${err.message}`);
        return err.name === 'SpendCapError' ? err : null;
      });
    }
    progress.message = 'Adding sound effects…';
    await save();
    const sfxResults = await Promise.all(sfxJobs);
    const capHit = sfxResults.find((r) => r instanceof Error);
    if (capHit) throw capHit;
    const sfxFiles = sfxResults;

    // Edit: per-segment mix, concat, branded captions, loudness
    progress.message = 'Editing — mixing audio, burning captions…';
    await save({ status: 'editing' });
    const parts = [];
    for (let i = 0; i < segments.length; i++) {
      const out = `segment-${i}.mp4`;
      // The same narration slice the clip was paced to, so voice and picture line up
      await buildSegment({ cwd: dir, video: `clip-${i}.mp4`, voice: `narration-${i}.mp3`, bed: sfxFiles[i], seconds: segments[i].segmentSeconds, out });
      parts.push(out);
    }
    await writeCaptions(file('captions.ass'), segments, brand.captionColor);
    const finalSeconds = await finalize({ cwd: dir, segments: parts, captions: 'captions.ass', out: 'final.mp4' });

    // The finished video goes into Postgres; on disk keep only the opening frame
    // and segment thumbnails (small images the run page shows)
    const videoUrl = await saveVideo({ runId, userId: run.user_id, file: file('final.mp4') });
    await Promise.all(
      segments.flatMap((_, i) => [`clip-${i}.mp4`, `voice-${i}.mp3`, `narration-${i}.mp3`, `sfx-${i}.mp4`, `segment-${i}.mp4`, `last-${i}.jpg`, `ref-${i}.mp4`])
        .concat(['joined.mp4', 'segments.txt', 'captions.ass', 'final.mp4'])
        .map((f) => rm(file(f), { force: true }))
    );

    // Never charge more than was reserved; refund the difference if shorter
    const charged = Math.min(run.credits_reserved, creditsFor(Math.round(finalSeconds)));
    await refundCredits(run.user_id, run.credits_reserved - charged, run.credits_from_purchased);
    progress.message = 'Done';
    progress.finalSeconds = Math.round(finalSeconds);
    await save({ status: 'done', script, video_url: videoUrl, credits_charged: charged });
  } catch (err) {
    await fail(runId, err);
  }
}

// In-process jobs die with the server: fail them and give the credits back
export async function recoverInterruptedRuns() {
  const { rows } = await query('SELECT id FROM runs WHERE status = ANY($1)', [ACTIVE_STATUSES]);
  for (const { id } of rows) await fail(id, new Error('Interrupted by a server restart — credits refunded. Please try again.'));
  await query(`UPDATE bots SET brand_status = 'failed', brand_error = 'Interrupted by a server restart' WHERE brand_status = 'generating'`);
}
