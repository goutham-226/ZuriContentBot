import { readFile } from 'node:fs/promises';
import { one, query } from './db.js';
import { HttpError } from './auth.js';

const CHUNK = 1024 * 1024; // read the bytea 1 MB at a time when streaming

// Stores a finished MP4 in Postgres; the run then points at the streaming endpoint
export async function saveVideo({ runId, userId, file }) {
  const data = await readFile(file);
  await query(
    `INSERT INTO videos (run_id, user_id, size_bytes, data) VALUES ($1, $2, $3, $4)
     ON CONFLICT (run_id) DO UPDATE SET size_bytes = $3, data = $4, created_at = now()`,
    [runId, userId, data.length, data]
  );
  return `/api/runs/${runId}/video`;
}

// Streams a video the user owns, honoring Range requests so players can seek
export async function streamVideo(req, res) {
  const meta = await one('SELECT size_bytes, mime FROM videos WHERE run_id = $1 AND user_id = $2', [req.params.id, req.user.id]).catch(() => null);
  if (!meta) throw new HttpError(404, 'Video not found.');
  const size = meta.size_bytes;

  let start = 0;
  let end = size - 1;
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    if (range[1] === '') {
      start = Math.max(0, size - Number(range[2])); // "bytes=-500" = last 500 bytes
    } else {
      start = Number(range[1]);
      if (range[2] !== '') end = Math.min(Number(range[2]), size - 1);
    }
    if (start >= size || start > end) {
      res.status(416).set('Content-Range', `bytes */${size}`).end();
      return;
    }
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
  }

  res.set({
    'Content-Type': meta.mime,
    'Content-Length': String(end - start + 1),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  });
  if (req.query.download) res.attachment(`${String(req.query.download).replace(/[^\w-]+/g, '-').slice(0, 80) || 'video'}.mp4`);

  for (let pos = start; pos <= end && !res.destroyed; pos += CHUNK) {
    const len = Math.min(CHUNK, end - pos + 1);
    const { chunk } = await one('SELECT substring(data FROM $2 FOR $3) AS chunk FROM videos WHERE run_id = $1', [req.params.id, pos + 1, len]);
    if (!res.write(chunk)) await new Promise((resolve) => res.once('drain', resolve));
  }
  res.end();
}
