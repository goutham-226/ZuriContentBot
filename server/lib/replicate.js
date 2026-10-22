import Replicate from 'replicate';
import { RESOLUTION } from '../../src/data/pricing.js';

export const MODELS = {
  text: process.env.TEXT_MODEL || 'qwen/qwen3-235b-a22b-instruct-2507',
  image: process.env.IMAGE_MODEL || 'black-forest-labs/flux-schnell',
  voice: process.env.VOICE_MODEL || 'elevenlabs/v3',
  video: process.env.VIDEO_MODEL || 'prunaai/p-video-2-pro-reference',
  sfx: process.env.SFX_MODEL || 'zsxkib/mmaudio', // video-to-audio foley for each clip
};

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
  useFileOutput: false, // plain URLs instead of FileOutput streams
});

export const hasReplicateToken = () => Boolean(process.env.REPLICATE_API_TOKEN);

// Input property schemas per model, fetched once. Lets us adapt to the exact
// field names (and array-vs-string shapes) each model version declares.
const schemaCache = new Map();
async function inputSchema(model) {
  if (!schemaCache.has(model)) {
    const promise = (async () => {
      const [owner, name] = model.split('/');
      const info = await replicate.models.get(owner, name);
      return info.latest_version?.openapi_schema?.components?.schemas?.Input?.properties || {};
    })().catch((err) => {
      schemaCache.delete(model);
      throw err;
    });
    schemaCache.set(model, promise);
  }
  return schemaCache.get(model);
}

// Builds an input object: `wanted` maps candidate field names (first match wins)
// to a value. Arrays collapse to a single value if the model takes one.
async function buildInput(model, wanted) {
  const props = await inputSchema(model);
  const known = Object.keys(props).length > 0;
  const input = {};
  for (const [candidates, value] of wanted) {
    if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) continue;
    const names = candidates.split('|');
    const field = known ? names.find((n) => n in props) : names[0];
    if (!field) continue;
    const isArray = props[field]?.type === 'array';
    input[field] = Array.isArray(value) && !isArray ? value[0] : !Array.isArray(value) && isArray ? [value] : value;
  }
  return input;
}

// How long each kind of model may take, queue time included, before we give up
const TIMEOUTS = { text: 6 * 60e3, image: 4 * 60e3, voice: 5 * 60e3, video: 20 * 60e3, sfx: 5 * 60e3 };
const TERMINAL = ['succeeded', 'failed', 'canceled'];

// Runs one prediction and waits for it to really finish. The client's run() is
// not used on purpose: in this version it gives up after ~60s of "processing"
// and returns a null output as if the model had finished.
// Official models run by name; community models (like MMAudio) need a version id
const versionCache = new Map();
async function target(model) {
  if (!versionCache.has(model)) {
    const [owner, name] = model.split('/');
    const info = await replicate.models.get(owner, name);
    versionCache.set(model, info.is_official ? { model } : { version: info.latest_version.id });
  }
  return versionCache.get(model);
}

async function runModel(kind, input) {
  const model = MODELS[kind];
  const started = Date.now();
  let prediction = await replicate.predictions.create({ ...(await target(model)), input });
  while (!TERMINAL.includes(prediction.status)) {
    if (Date.now() - started > TIMEOUTS[kind]) {
      await replicate.predictions.cancel(prediction.id).catch(() => {});
      throw new Error(`${model} timed out after ${Math.round(TIMEOUTS[kind] / 60e3)} min (prediction ${prediction.id})`);
    }
    await new Promise((r) => setTimeout(r, kind === 'video' ? 3000 : 1000));
    prediction = await replicate.predictions.get(prediction.id);
  }
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (prediction.status !== 'succeeded') {
    throw new Error(`${model} ${prediction.status}: ${String(prediction.error || 'no details').slice(0, 300)}`);
  }
  const empty = prediction.output == null || (Array.isArray(prediction.output) && prediction.output.length === 0);
  if (empty) throw new Error(`${model} finished but returned no output (prediction ${prediction.id})`);
  console.log(`[replicate] ${model} ${secs}s (${prediction.id})`);
  return prediction.output;
}

const firstUrl = (output) => {
  const url = Array.isArray(output) ? output[0] : output;
  if (typeof url !== 'string' || !url.startsWith('http')) throw new Error(`Expected a file URL, got ${JSON.stringify(url).slice(0, 120)}`);
  return url;
};

export async function generateText(prompt, { maxTokens = 4096, temperature = 0.8 } = {}) {
  const input = await buildInput(MODELS.text, [
    ['prompt', prompt],
    ['max_tokens|max_new_tokens', maxTokens],
    ['temperature', temperature],
    ['top_p', 0.9],
  ]);
  const output = await runModel('text', input);
  return Array.isArray(output) ? output.join('') : String(output);
}

export async function generateImage(prompt, aspectRatio = '9:16') {
  const input = await buildInput(MODELS.image, [
    ['prompt', prompt],
    ['aspect_ratio', aspectRatio],
    ['num_outputs', 1],
    ['output_format', 'jpg'],
    ['output_quality', 90],
  ]);
  return firstUrl(await runModel('image', input));
}

// One narration segment. Higher stability keeps the voice steady from segment to
// segment. (eleven_v3 rejects previous_text/next_text context, so none is sent.)
export async function generateVoice(text, voice) {
  const input = await buildInput(MODELS.voice, [
    ['prompt|text', text],
    ['voice|voice_id', voice],
    ['stability', 0.65],
    ['similarity_boost', 0.8],
    ['style', 0],
  ]);
  return firstUrl(await runModel('voice', input));
}

// 480p speed mode only: the pricing is built on it. Image inputs may be URLs or
// Buffers (the client uploads Buffers to Replicate's file API).
// With keepAudio the single narration file becomes the clip's soundtrack and sets
// its length, so picture and voice are generated together; the model adds no
// audio of its own. Sound effects come from a separate pass (generateSfx).
export async function generateVideo({ prompt, firstFrame, images, videos, audios, keepAudio = false, seconds, aspectRatio }) {
  const input = await buildInput(MODELS.video, [
    ['prompt', prompt],
    ['first_frame_image', firstFrame],
    ['image|images|reference_images', images],
    ['video|videos|reference_videos', videos],
    ['audio|audios|reference_audio', audios],
    ['keep_audio', keepAudio && audios?.length === 1],
    ['duration', seconds],
    ['resolution', RESOLUTION],
    ['aspect_ratio', aspectRatio],
    ['mode', 'speed'],
    ['prompt_upsampler', 'turbo'],
  ]);
  return firstUrl(await runModel('video', input));
}

// Foley for a finished clip: sounds that match what's on screen, never voices or music
export async function generateSfx({ video, prompt, seconds }) {
  const input = await buildInput(MODELS.sfx, [
    ['video', video],
    ['prompt', prompt],
    ['negative_prompt', 'speech, voice, talking, whispering, narration, singing, music, breathing, coughing, laughing, screaming'],
    ['duration', Math.ceil(seconds)],
    ['num_steps', 25],
    ['cfg_strength', 4.5],
  ]);
  return firstUrl(await runModel('sfx', input));
}
