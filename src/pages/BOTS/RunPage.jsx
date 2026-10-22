import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, formatDuration } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import LiveWork from './LiveWork';
import '../../components/landing/HeroDemo.css';
import '../../components/landing/Mascot.css';
import './Bots.css';

const STEPS = [
  { key: 'researching', label: 'Research' },
  { key: 'awaiting_approval', label: 'Your approval' },
  { key: 'scripting', label: 'Script' },
  { key: 'designing', label: 'Visuals' },
  { key: 'voicing', label: 'Voice-over' },
  { key: 'rendering', label: 'Video' },
  { key: 'editing', label: 'Edit' },
  { key: 'done', label: 'Ready' },
];
const WORKING = ['researching', 'scripting', 'designing', 'voicing', 'rendering', 'editing'];

const STATUS_LABEL = {
  researching: ['Researching', 'live'],
  awaiting_approval: ['Needs approval', 'wait'],
  scripting: ['Writing', 'live'],
  designing: ['Designing', 'live'],
  voicing: ['Voicing', 'live'],
  rendering: ['Rendering', 'live'],
  editing: ['Editing', 'live'],
  done: ['Ready', 'ok'],
  failed: ['Failed', 'bad'],
  discarded: ['Discarded', ''],
};

export function StatusBadge({ status }) {
  const [label, tone] = STATUS_LABEL[status] || [status, ''];
  return <span className={`badge ${tone}`}>{label}</span>;
}

function Stepper({ status }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="stepper">
      {STEPS.map((step, i) => (
        <li key={step.key} className={i < current || status === 'done' ? 'done' : i === current ? 'current' : ''}>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

const SCORE_LABELS = { hook: 'Hook', curiosity: 'Curiosity', emotion: 'Emotion', visuals: 'Visuals', novelty: 'Novelty' };

function IdeaCard({ idea, index, recommended, cost, onApprove, busy, canAfford }) {
  const [notes, setNotes] = useState('');
  const total = Object.values(idea.scores || {}).reduce((a, b) => a + b, 0);
  return (
    <article className={`card idea-card ${recommended ? 'recommended' : ''}`}>
      <div className="idea-top">
        <span className="idea-num">Idea {index + 1}</span>
        {recommended && <span className="badge ok">Top pick</span>}
        <span className="idea-total" title="Critic score out of 50">{total}/50</span>
      </div>
      <h3 className="idea-title">{idea.title}</h3>
      <p className="idea-hook">“{idea.hook}”</p>
      <p className="muted small">{idea.premise}</p>

      <dl className="scores">
        {Object.entries(SCORE_LABELS).map(([key, label]) => (
          <div key={key} className="score">
            <dt>{label}</dt>
            <dd><span style={{ width: `${(idea.scores?.[key] || 0) * 10}%` }} /></dd>
            <span className="score-val">{idea.scores?.[key] ?? '–'}</span>
          </div>
        ))}
      </dl>

      <details className="idea-more">
        <summary>Beats, payoff and why it should go viral</summary>
        <ol className="beats">{(idea.beats || []).map((b, i) => <li key={i}>{b}</li>)}</ol>
        {idea.payoff && <p className="small"><strong>Payoff:</strong> {idea.payoff}</p>}
        {idea.whyViral && <p className="small"><strong>Why viral:</strong> {idea.whyViral}</p>}
        {idea.visualStyle && <p className="small"><strong>Look:</strong> {idea.visualStyle}</p>}
        {idea.verdict && <p className="small muted"><strong>Critic:</strong> {idea.verdict}</p>}
      </details>

      {idea.sources?.length > 0 && (
        <div className="idea-sources">
          <span className="muted small">Sources:</span>
          {idea.sources.map((s) => (
            <a key={s.id} className="source-link" href={s.url} target="_blank" rel="noreferrer" title={s.title}>
              {s.id} {s.source}
            </a>
          ))}
        </div>
      )}

      <textarea className="textarea idea-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the script, e.g. 'end on a cliffhanger'" />
      <button className="btn btn-primary" disabled={busy || !canAfford} onClick={() => onApprove(index, notes)}>
        Approve & make it · {cost} credits
      </button>
    </article>
  );
}

function Research({ research }) {
  if (!research) return null;
  const s = research.signals || {};
  const c = s.counts || {};
  const facts = research.facts || [];
  return (
    <details className="card research-card">
      <summary>
        <strong>What the bot researched</strong>
        <span className="muted small">
          {facts.length} sourced facts · {c.articles || 0} articles read · {c.wiki || 0} Wikipedia pages ·{' '}
          {(c.reddit || 0) + (c.news || 0) + (c.trends || 0) + (c.blogs || 0) + (c.searches || 0)} trend signals ·{' '}
          {research.angles?.length || 0} angles weighed
        </span>
      </summary>
      <div className="grid-2 research-grid">
        <div>
          <h4>Fact sheet</h4>
          {facts.length ? (
            <ul className="facts">
              {facts.map((f, i) => (
                <li key={i}>
                  {f.fact}{' '}
                  <a className="source-link" href={f.url} target="_blank" rel="noreferrer">[{f.source}]</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No facts could be extracted this time; ideas lean on trends and the niche playbook.</p>
          )}
        </div>
        <div>
          <h4>Trends it spotted</h4>
          <ul>{(research.trends || []).map((t, i) => <li key={i}><strong>{t.signal}</strong> — <span className="muted">{t.insight}</span></li>)}</ul>
          <h4 style={{ marginTop: '1.25rem' }}>What it read</h4>
          <ul>
            {[...(s.articles || []), ...(s.wiki || [])].map((a, i) => (
              <li key={i}><a className="source-link" href={a.url} target="_blank" rel="noreferrer">{a.source}</a> {a.title}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}

export default function RunPage() {
  const { id } = useParams();
  const { subscription, refresh: refreshAccount } = useAuth();
  const [run, setRun] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => api(`/runs/${id}`).then((d) => setRun(d.run)).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while the bot is working
  useEffect(() => {
    if (!run || !WORKING.includes(run.status)) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [run, load]);

  // Credits change on approval, completion (refund of unused) and failure
  useEffect(() => {
    if (run && ['done', 'failed', 'scripting'].includes(run.status)) refreshAccount();
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!run) return <div className="page container">{error ? <div className="alert">{error}</div> : <div className="page-loading" />}</div>;

  const act = async (path, body) => {
    setError('');
    setBusy(true);
    try {
      await api(`/runs/${id}/${path}`, { method: 'POST', body });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cost = run.credits_needed;
  const balance = subscription?.credits ?? 0;
  const ideas = run.ideas?.ideas || [];
  const idea = run.chosen_idea;
  const scenes = run.progress?.scenes || [];

  const copyCaption = async () => {
    const text = `${run.script?.caption || idea?.caption || ''}\n\n${(run.script?.hashtags || idea?.hashtags || []).join(' ')}`;
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="page container">
      <Link to={`/bots/${run.bot_id}`} className="back-link">← {run.bot_name}</Link>
      <div className="page-head">
        <div>
          <h1 className="page-title">{idea?.title || (run.status === 'awaiting_approval' ? `${run.bot_name} has ideas` : `${run.bot_name} is researching`)}</h1>
          <p className="page-sub">{formatDuration(run.duration_sec)} · 480p · 9:16{run.topic_hint ? ` · steered toward “${run.topic_hint}”` : ''}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      {!['failed', 'discarded'].includes(run.status) && <Stepper status={run.status} />}
      {error && <div className="alert" role="alert" style={{ marginBottom: '1.25rem' }}>{error}</div>}

      {WORKING.includes(run.status) && <LiveWork run={run} />}

      {run.status === 'failed' && (
        <div className="alert" role="alert">
          {run.error || 'Something went wrong.'} Any reserved credits were refunded. <Link to={`/bots/${run.bot_id}`}>Try again</Link>
        </div>
      )}
      {run.status === 'discarded' && <div className="alert info">You discarded these ideas. <Link to={`/bots/${run.bot_id}`}>Ask for new ones</Link></div>}

      <Research research={run.research} />

      {run.status === 'awaiting_approval' && (
        <>
          <h2 className="section-label">Pick the one to make</h2>
          {balance < cost && (
            <div className="alert" role="alert" style={{ marginBottom: '1rem' }}>
              This video needs {cost} credits and you have {balance}. <Link to="/pricing#packs">Buy a credit pack</Link> to approve it.
            </div>
          )}
          <div className="grid-3 ideas">
            {ideas.map((idea, i) => (
              <IdeaCard key={i} idea={idea} index={i} recommended={i === run.ideas.recommended} cost={cost} busy={busy} canAfford={balance >= cost}
                onApprove={(ideaIndex, notes) => act('approve', { ideaIndex, notes })} />
            ))}
          </div>
          <form className="card retry-card" onSubmit={(e) => { e.preventDefault(); act('regenerate', { feedback }); }}>
            <div className="field">
              <span className="field-label">None of these?</span>
              <input className="input" value={feedback} maxLength={500} onChange={(e) => setFeedback(e.target.value)} placeholder="Tell the bot what to change — e.g. 'more true stories, less supernatural'" />
            </div>
            <div className="retry-actions">
              <button className="btn btn-ghost" disabled={busy}>Pitch new ideas</button>
              <button type="button" className="btn btn-ghost danger" disabled={busy} onClick={() => act('discard')}>Discard</button>
            </div>
          </form>
        </>
      )}

      {run.status === 'done' && run.video_url && (
        <div className="result">
          <div className="player-frame">
            <video src={run.video_url} controls playsInline poster={scenes[0]?.image} />
          </div>
          <div className="result-side">
            <a className="btn btn-primary" href={`${run.video_url}?download=${encodeURIComponent(idea?.title || 'video')}`}>Download MP4</a>
            <div className="card">
              <div className="caption-head">
                <h3 className="card-title">Post caption</h3>
                <button className="btn btn-ghost btn-sm" onClick={copyCaption}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <p className="small">{run.script?.caption || idea?.caption}</p>
              <p className="small hashtags">{(run.script?.hashtags || idea?.hashtags || []).join(' ')}</p>
            </div>
            <p className="muted small">
              {run.progress?.finalSeconds ? `${run.progress.finalSeconds}s finished · ` : ''}{run.credits_charged} credits used
            </p>
            <div className="alert info upscale-note">
              Clips are generated at 480p to keep every video affordable. For the sharpest result, run the MP4
              through an upscaler before posting — CapCut's free video upscaler, Topaz Video AI or DaVinci Resolve's Super Scale.
            </div>
          </div>
        </div>
      )}

      {run.script?.scenes && (
        <>
          <h2 className="section-label">Storyboard</h2>
          <ol className="scenes">
            {run.script.scenes.map((scene, i) => (
              <li key={i} className="scene">
                <div className="scene-thumb">
                  {scenes[i]?.image ? <img src={scenes[i].image} alt="" loading="lazy" /> : <span className="scene-wait" />}
                  {scenes[i]?.clip && <span className="badge ok scene-badge">Clip ready</span>}
                </div>
                <div>
                  <span className="muted small">Scene {i + 1} · {scene.seconds}s{scenes[i]?.voiceSeconds ? ` · VO ${scenes[i].voiceSeconds}s` : ''}</span>
                  <p>{scene.narration}</p>
                  {scene.sfx && <p className="muted small">SFX: {scene.sfx}</p>}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
