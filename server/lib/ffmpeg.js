import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export const OUTPUT = { width: 720, height: 1280, fps: 30 };

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    proc.on('error', reject);
    proc.on('close', (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(`${cmd} exited ${code}: ${stderr.trim().split('\n').slice(-3).join(' ')}`))
    );
  });
}

export async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}

export async function probeDuration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return parseFloat(out) || 0;
}

// One segment: video fitted to 9:16 (frozen on its last frame if it comes back
// short), the clean narration on top, and the clip's foley track (`bed`, from the
// sound-effects pass) underneath, gently ducked while the narrator speaks. The
// clip's own audio is never used: with keep_audio it is just a copy of the narration.
export async function buildSegment({ cwd, video, voice, bed, seconds, out }) {
  const { width: W, height: H, fps } = OUTPUT;
  const L = seconds.toFixed(3);
  const inputs = ['-i', video, '-i', voice];
  if (bed) inputs.push('-i', bed);
  else inputs.push('-f', 'lavfi', '-t', L, '-i', 'anullsrc=r=44100:cl=stereo');

  const filter = [
    `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${fps},setsar=1,` +
      `tpad=stop_mode=clone:stop_duration=20,trim=duration=${L},setpts=PTS-STARTPTS[v]`,
    `[2:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.5,apad[bed]`,
    `[1:a]aresample=44100,aformat=channel_layouts=stereo,apad,asplit=2[vo][key]`,
    `[bed][key]sidechaincompress=threshold=0.03:ratio=4:attack=30:release=600:makeup=1[ducked]`,
    `[ducked][vo]amix=inputs=2:duration=longest:normalize=0,atrim=duration=${L},asetpts=PTS-STARTPTS[a]`,
  ].join(';');

  await run(
    'ffmpeg',
    ['-y', ...inputs, '-filter_complex', filter, '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-ac', '2', out],
    cwd
  );
}

// Last frame of a clip — the next clip starts on it so the shot never jumps
export async function extractLastFrame(cwd, video, out) {
  await run('ffmpeg', ['-y', '-sseof', '-0.25', '-i', video, '-update', '1', '-q:v', '2', out], cwd);
}

// The previous clip, re-encoded as a silent reference video under the model's
// 15s cap (a "15s" clip can come back a few milliseconds long)
export async function makeReference(cwd, video, out, seconds) {
  await run(
    'ffmpeg',
    ['-y', '-sseof', `-${seconds.toFixed(2)}`, '-i', video, '-t', seconds.toFixed(2), '-an',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', out],
    cwd
  );
}

// A segment's narration as an exact-length slice: sped up by `tempo` if it would
// overrun, then padded with silence and cut to `seconds`. Used both as the clip's
// reference audio and as the voice track in the final mix, so they always match.
export async function sliceNarration(cwd, voice, out, { tempo = 1, seconds }) {
  const speed = tempo > 1.001 ? `atempo=${tempo.toFixed(3)},` : '';
  await run(
    'ffmpeg',
    ['-y', '-i', voice, '-af', `${speed}aresample=44100,apad`, '-t', seconds.toFixed(2), '-ac', '2', '-c:a', 'libmp3lame', '-b:a', '192k', out],
    cwd
  );
}

// Silent stand-in for a segment with no narration
export async function silence(cwd, seconds, out) {
  await run('ffmpeg', ['-y', '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=r=44100:cl=stereo', '-q:a', '9', out], cwd);
}

const assTime = (t) => {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = (t % 60).toFixed(2).padStart(5, '0');
  return `${h}:${String(m).padStart(2, '0')}:${s}`;
};

// #RRGGBB -> ASS &HBBGGRR& (ASS stores colors as blue-green-red)
const assColor = (hex) => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  return m ? `&H${m[3]}${m[2]}${m[1]}&`.toUpperCase() : '&H00E6FF&';
};

// Bold, centred, 3-words-at-a-time captions in the lower third (clear of faces),
// alternating white and the channel's accent color
export async function writeCaptions(path, scenes, accentHex) {
  const accent = assColor(accentHex);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${OUTPUT.width}
PlayResY: ${OUTPUT.height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,52,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,4,2,2,60,60,230,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const lines = [];
  let offset = 0;
  for (const scene of scenes) {
    const words = scene.narration.replace(/\[[^\]]*\]/g, ' ').split(/\s+/).filter(Boolean);
    const chunks = [];
    for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(' '));
    const totalChars = chunks.reduce((n, c) => n + c.length, 0) || 1;
    let t = offset;
    for (const [i, chunk] of chunks.entries()) {
      const dur = (chunk.length / totalChars) * scene.voiceSeconds;
      // Every other chunk in the accent color keeps the eye moving
      const color = i % 2 ? `{\\c${accent}}` : '';
      lines.push(`Dialogue: 0,${assTime(t)},${assTime(t + dur)},Cap,,0,0,0,,${color}${chunk.toUpperCase().replace(/[{}]/g, '')}`);
      t += dur;
    }
    offset += scene.segmentSeconds;
  }
  await writeFile(path, header + lines.join('\n') + '\n');
}

export async function finalize({ cwd, segments, captions, out }) {
  await writeFile(`${cwd}/segments.txt`, segments.map((s) => `file '${s}'`).join('\n'));
  await run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', 'segments.txt', '-c', 'copy', 'joined.mp4'], cwd);
  await run(
    'ffmpeg',
    ['-y', '-i', 'joined.mp4', '-vf', `ass=${captions}`, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out],
    cwd
  );
  return probeDuration(`${cwd}/${out}`);
}
