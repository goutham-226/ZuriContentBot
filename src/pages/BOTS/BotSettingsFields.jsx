import React from 'react';
import { VOICES } from '../../data/niches';
import { DURATIONS } from '../../data/pricing';
import { formatDuration } from '../../lib/api';

// Shared by "new bot" and the bot settings panel
export default function BotSettingsFields({ settings, onChange, subscription }) {
  const set = (key) => (value) => onChange({ ...settings, [key]: value });
  const maxDuration = subscription?.limits?.maxDuration || 180;

  return (
    <>
      <label className="field">
        <span className="field-label">Narrator voice</span>
        <select className="select" value={settings.voice} onChange={(e) => set('voice')(e.target.value)}>
          {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <span className="field-hint">ElevenLabs v3 — supports emotion like [whispers] and [excited].</span>
      </label>

      <div className="field">
        <span className="field-label">Default video length</span>
        <div className="segmented">
          {DURATIONS.map((d) => (
            <button type="button" key={d} disabled={d > maxDuration} aria-pressed={settings.defaultDuration === d} onClick={() => set('defaultDuration')(d)}>
              {formatDuration(d)}
            </button>
          ))}
        </div>
        <span className="field-hint">You can change it for each video too.</span>
      </div>

      <label className="field">
        <span className="field-label">Style notes (optional)</span>
        <textarea className="textarea" value={settings.styleNotes} maxLength={600} onChange={(e) => set('styleNotes')(e.target.value)}
          placeholder="e.g. Dark, rainy, neon-lit city. Recurring narrator character: a tired night-shift security guard." />
      </label>

      <label className="field">
        <span className="field-label">Audience notes (optional)</span>
        <textarea className="textarea" value={settings.audienceNotes} maxLength={400} onChange={(e) => set('audienceNotes')(e.target.value)}
          placeholder="e.g. US teens who love creepypasta; keep it PG-13." />
      </label>

    </>
  );
}
export const DEFAULT_SETTINGS = {
  voice: 'Roger',
  defaultDuration: 60,
  styleNotes: '',
  audienceNotes: '',
};
