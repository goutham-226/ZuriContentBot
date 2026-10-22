// Provider costs, token budgets, hosting and margin maths. Server-only:
// this is proprietary and must never be imported by anything under src/.
import { PLANS, CREDIT_PACKS } from '../../src/data/pricing.js';

// Replicate list prices as of Oct 2026 — update here if they change.
export const UNIT_COSTS = {
  // prunaai/p-video-2-pro-reference (480p, speed mode)
  videoPerSecond: 0.015, // per second of output video
  refVideoPerSecond: 0.03, // per second of reference video, charged on every clip it's sent to
  refImage: 0.005, // per reference image (first frame included), per clip
  refAudioPerSecond: 0.0015, // per second of reference audio, per clip
  // zsxkib/mmaudio foley pass, per 15s clip (~11s on an L40S)
  sfxPerClip: 0.012,
  // elevenlabs/v3, per 1,000 characters of narration
  voicePer1kChars: 0.1,
  // black-forest-labs/flux-schnell, per image
  image: 0.003,
  // qwen/qwen3-235b-a22b-instruct-2507, per million tokens (conservative estimate)
  llmPerMTokIn: 0.3,
  llmPerMTokOut: 1.2,
};

// Hard token caps per LLM pass. Prompts are trimmed to fit `in`, and `out` is
// passed as max_tokens, so these are worst-case numbers we can budget on.
export const LLM_BUDGET = {
  facts: { in: 8000, out: 2200 }, // mine sourced facts + story leads from scraped articles
  analyze: { in: 7000, out: 2000 }, // trends + candidate angles
  pitch: { in: 6000, out: 2400 }, // 4 compact pitches
  critic: { in: 3000, out: 900 }, // scores + better hooks only
  script: { in: 6000, out: 5000 }, // narration + storyboard
  brand: { in: 2500, out: 1200 }, // channel identity, once per bot
};
export const CHARS_PER_TOKEN = 3.5; // conservative for English prompts

export const llmCost = (...passes) =>
  passes.reduce((usd, p) => usd + (LLM_BUDGET[p].in * UNIT_COSTS.llmPerMTokIn + LLM_BUDGET[p].out * UNIT_COSTS.llmPerMTokOut) / 1e6, 0);

// Worst-case LLM cost of one idea round (first round researches; re-pitches reuse it)
export const PITCH_COST = llmCost('facts', 'analyze', 'pitch', 'critic');
export const REPITCH_COST = llmCost('pitch', 'critic');
export const BRAND_COST = llmCost('brand') + 2 * UNIT_COSTS.image;

// Continuous-shot pipeline: every video is a chain of 15s clips. Clip 1 opens on a
// generated keyframe; each later clip gets the previous clip as its reference video
// and starts on its last frame. Every clip also gets the bot's character sheet + style
// frame and its own 15s slice of narration as reference audio.
export const RUN_ASSUMPTIONS = {
  clipSeconds: 15,
  referenceSeconds: 15, // how much of the previous clip is sent as reference video
  audioReferenceSeconds: 15, // each clip also gets its own narration as reference audio
  brandImagesPerClip: 2, // character sheet + style frame
  charsPerSecond: 15, // ~2.5 spoken words per second
};

// Hosting: one VPS runs the API, Postgres and ffmpeg; finished videos live in
// object storage. Fixed costs are spread over an assumed subscriber count.
export const HOSTING = {
  serverMonthly: 48, // 4 vCPU / 8 GB VPS
  extrasMonthly: 12, // backups, domain, email, monitoring
  subscribersToAmortize: 50,
  storagePerGBMonth: 0.015, // e.g. Cloudflare R2 (free egress)
  mbPerVideoSecond: 0.4, // final 720x1280 MP4; intermediates are deleted
  retentionMonths: 6,
};

export const PAYMENT_FEES = { percent: 0.029, fixed: 0.3 }; // card processing per charge

// Provider + storage cost in USD to produce one approved video
export function estimateRunCost(durationSec) {
  const a = RUN_ASSUMPTIONS;
  const clips = Math.ceil(durationSec / a.clipSeconds);
  const perClipImages = (a.brandImagesPerClip + 1) * UNIT_COSTS.refImage; // + first frame
  const video = clips * a.clipSeconds * UNIT_COSTS.videoPerSecond;
  const references =
    clips * (perClipImages + a.audioReferenceSeconds * UNIT_COSTS.refAudioPerSecond) +
    (clips - 1) * a.referenceSeconds * UNIT_COSTS.refVideoPerSecond;
  const voice = ((durationSec * a.charsPerSecond) / 1000) * UNIT_COSTS.voicePer1kChars;
  const images = UNIT_COSTS.image; // opening keyframe
  const sfx = clips * UNIT_COSTS.sfxPerClip;
  const script = llmCost('script');
  const storage = (durationSec * HOSTING.mbPerVideoSecond * HOSTING.retentionMonths * HOSTING.storagePerGBMonth) / 1000;
  const total = video + references + voice + images + sfx + script + storage;
  return { clips, video, references, voice, images, sfx, script, storage, total };
}

// Cost of one credit = one second of the most expensive length per second (3 min,
// where the cheap reference-free first clip matters least), so margins hold at every length
export const CREDIT_COST = estimateRunCost(180).total / 180;

// Worst-case monthly economics for a plan used to the limit (internal; README)
export function planEconomics(plan) {
  const fees = plan.price * PAYMENT_FEES.percent + PAYMENT_FEES.fixed;
  const hosting = (HOSTING.serverMonthly + HOSTING.extrasMonthly) / HOSTING.subscribersToAmortize;
  const videos = plan.credits * CREDIT_COST;
  const research = plan.pitchesPerMonth * PITCH_COST;
  const brands = plan.bots * BRAND_COST;
  const cost = fees + hosting + videos + research + brands;
  return { fees, hosting, videos, research, brands, cost, profit: plan.price - cost, margin: 1 - cost / plan.price };
}

export function packEconomics(pack) {
  const fees = pack.price * PAYMENT_FEES.percent + PAYMENT_FEES.fixed;
  const videos = pack.credits * CREDIT_COST;
  const cost = fees + videos;
  return { fees, videos, cost, profit: pack.price - cost, margin: 1 - cost / pack.price };
}

// Margin report for every plan and pack: node -e "import('./server/lib/costs.js').then(m => m.report())"
export function report() {
  for (const p of PLANS) console.log(p.id, p.price, `${(planEconomics(p).margin * 100).toFixed(1)}%`);
  for (const p of CREDIT_PACKS) console.log(p.id, p.price, `${(packEconomics(p).margin * 100).toFixed(1)}%`);
}
