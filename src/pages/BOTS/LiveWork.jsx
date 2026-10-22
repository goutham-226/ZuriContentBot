import React, { useEffect, useState } from 'react';
import Mascot from '../../components/landing/Mascot';
import './LiveWork.css';

const RESEARCH_STAGES = [
  { key: 'scan', label: 'Scanning sources' },
  { key: 'mine', label: 'Reading articles, mining stories' },
  { key: 'angles', label: 'Finding viral angles' },
  { key: 'pitch', label: 'Writing pitches' },
  { key: 'critic', label: 'Critic picks the best 3' },
];

const RENDER_STAGES = [
  { key: 'scripting', label: 'Writing the script' },
  { key: 'designing', label: 'Designing the opening frame' },
  { key: 'voicing', label: 'Recording the voice-over' },
  { key: 'rendering', label: 'Filming the continuous shot' },
  { key: 'editing', label: 'Editing, captions, sound' },
];

// Rough expectations, shown so the wait never feels open-ended
const EXPECTED = { research: 150, render: (seconds) => 60 + (seconds / 15) * 45 };

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function useElapsed(since) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return since ? Math.max(0, (now - new Date(since).getTime()) / 1000) : 0;
}

// The "watch Zuri work" panel shown while a run is researching or rendering
export default function LiveWork({ run }) {
  const researching = run.status === 'researching';
  const stages = researching ? RESEARCH_STAGES : RENDER_STAGES;
  const current = researching ? run.progress?.stage || 'scan' : run.status;
  const idx = Math.max(0, stages.findIndex((s) => s.key === current));
  const elapsed = useElapsed(run.progress?.startedAt || run.updated_at);
  const expected = researching ? EXPECTED.research : EXPECTED.render(run.duration_sec);
  const preview = run.progress?.preview || {};
  const left = Math.max(0, expected - elapsed);

  return (
    <section className="card livework">
      <div className="live-head">
        <Mascot size={64} mood="think" />
        <div className="live-title">
          <strong>{run.progress?.message || 'Working…'}</strong>
          <span className="muted small">
            {clock(elapsed)} elapsed · {left > 5 ? `about ${Math.ceil(left / 60)} min left` : 'almost there'} · you can leave this page, Zuri keeps working
          </span>
        </div>
      </div>

      <div className="live-bar"><span style={{ width: `${Math.min(96, (elapsed / expected) * 100)}%` }} /></div>

      <div className="live-body">
        <ol className="live-stages">
          {stages.map((s, i) => (
            <li key={s.key} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
              <span className="live-dot" aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ol>

        <div className="live-feed" aria-live="polite">
          {researching ? (
            <>
              {preview.focus?.length > 0 && (
                <p className="live-focus">
                  Digging into {preview.focus.map((t, i) => <React.Fragment key={t}>{i > 0 && ' and '}<b>{t}</b></React.Fragment>)}
                </p>
              )}
              {preview.angles?.length > 0 ? (
                <FeedList title="Angles on the table" items={preview.angles} />
              ) : preview.facts?.length > 0 ? (
                <FeedList title="Facts found so far" items={preview.facts} mono />
              ) : preview.sources?.length > 0 ? (
                <FeedList title="Sources found" items={preview.sources.map((s) => `${s.source} · ${s.title}`)} />
              ) : (
                <p className="muted small">Fetching the latest from news, trends, blogs and Wikipedia…</p>
              )}
              {preview.stories?.length > 0 && !preview.angles && <FeedList title="Story leads" items={preview.stories} />}
            </>
          ) : (
            <RenderFeed run={run} />
          )}
        </div>
      </div>
    </section>
  );
}

function FeedList({ title, items, mono }) {
  return (
    <div className="live-list">
      <span className="field-label">{title}</span>
      <ul>
        {items.map((text, i) => (
          <li key={text} className={mono ? 'mono' : ''} style={{ animationDelay: `${i * 0.12}s` }}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

function RenderFeed({ run }) {
  const scenes = run.progress?.scenes || [];
  if (!scenes.length) return <p className="muted small">Turning the approved idea into a shot plan…</p>;
  return (
    <div className="live-list">
      <span className="field-label">Segments</span>
      <div className="live-segments">
        {scenes.map((s, i) => (
          <span key={i} className={`live-seg ${s.clip ? 'done' : ''}`}>
            {s.image ? <img src={s.image} alt="" /> : <i>{i + 1}</i>}
          </span>
        ))}
      </div>
    </div>
  );
}
