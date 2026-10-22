import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDuration } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getNiche } from '../../data/niches';
import { DURATIONS, creditsFor } from '../../data/pricing';
import BotSettingsFields, { DEFAULT_SETTINGS } from './BotSettingsFields';
import { PlanBanner } from './Dashboard';
import { StatusBadge } from './RunPage';
import './Bots.css';

function BrandCard({ bot, onRegenerate, busy }) {
  const [notes, setNotes] = useState('');
  const [open, setOpen] = useState(false);
  const brand = bot.brand;

  if (bot.brand_status === 'generating' || (!brand && bot.brand_status === 'pending')) {
    return (
      <div className="card brand-card working">
        <div className="spinner" aria-hidden="true" />
        <div>
          <strong>Designing {bot.name}'s channel identity…</strong>
          <p className="muted small">A recurring character and house style that every video will share. Takes about a minute.</p>
        </div>
      </div>
    );
  }

  return (
    <section className="card brand-card">
      {brand ? (
        <div className="brand-grid">
          <div className="brand-images">
            <figure>
              <img src={brand.characterImage} alt={`${brand.character.name}, the channel's recurring character`} />
              <figcaption>Character</figcaption>
            </figure>
            <figure>
              <img src={brand.styleImage} alt="The channel's house style" />
              <figcaption>House style</figcaption>
            </figure>
          </div>
          <div className="brand-info">
            <span className="field-label">Channel identity</span>
            <h2 className="brand-name">{brand.channelName} <span className="muted">{brand.handle}</span></h2>
            <p className="muted small">{brand.tagline}</p>
            <dl className="brand-facts">
              <div><dt>Character</dt><dd><strong>{brand.character.name}</strong>, {brand.character.role}. {brand.character.personality}</dd></div>
              <div><dt>Catchphrase</dt><dd>“{brand.character.catchphrase}”</dd></div>
              <div><dt>Style</dt><dd>{brand.style.look}. {brand.style.colorGrade}.</dd></div>
              <div><dt>Opens with</dt><dd>{brand.signatureOpening}</dd></div>
              <div><dt>Signs off</dt><dd>{brand.signatureSignoff}</dd></div>
            </dl>
            <div className="swatches" aria-label="Palette">
              {[...(brand.style.palette || []), brand.captionColor].filter(Boolean).map((c, i) => (
                <span key={i} className="swatch" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <strong>No channel identity yet</strong>
          <p className="muted small">
            {bot.brand_status === 'failed' ? `The last attempt failed: ${bot.brand_error || 'unknown error'}. ` : ''}
            It's designed automatically before the first video, or you can create it now.
          </p>
        </div>
      )}

      {open ? (
        <form className="brand-redo" onSubmit={(e) => { e.preventDefault(); onRegenerate(notes); setOpen(false); }}>
          <input className="input" value={notes} maxLength={400} onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional direction, e.g. 'an elderly lighthouse keeper with a lantern'" />
          <button className="btn btn-primary btn-sm" disabled={busy}>{brand ? 'Redesign' : 'Design it'}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        </form>
      ) : (
        <button className="btn btn-ghost btn-sm brand-redo-btn" onClick={() => setOpen(true)}>
          {brand ? 'Redesign identity' : 'Design identity now'}
        </button>
      )}
      {brand && <p className="field-hint">Redesigning changes the look of future videos only.</p>}
    </section>
  );
}

export default function BotPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscription, refresh } = useAuth();
  const [bot, setBot] = useState(null);
  const [runs, setRuns] = useState([]);
  const [duration, setDuration] = useState(60);
  const [topicHint, setTopicHint] = useState('');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');

  const load = useCallback(
    (initial) =>
      api(`/bots/${id}`)
        .then(({ bot, runs }) => {
          setBot(bot);
          setRuns(runs);
          if (initial) {
            setSettings({ ...DEFAULT_SETTINGS, ...bot.settings });
            setDuration(bot.settings.defaultDuration || 60);
          }
        })
        .catch((e) => setError(e.message)),
    [id]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  // Poll while the identity is being designed
  useEffect(() => {
    if (bot?.brand_status !== 'generating') return;
    const t = setInterval(() => load(false), 4000);
    return () => clearInterval(t);
  }, [bot?.brand_status, load]);

  if (!bot) return <div className="page container">{error ? <div className="alert">{error}</div> : <div className="page-loading" />}</div>;

  const niche = getNiche(bot.niche_id);
  const maxDuration = subscription?.limits?.maxDuration || 0;
  const cost = creditsFor(duration);
  const balance = subscription?.credits ?? 0;
  const active = subscription?.status === 'active';
  const short = active && balance < cost;
  const pitchesLeft = subscription ? subscription.limits.pitchesPerMonth - subscription.pitchesUsed : 0;

  const requestVideo = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { runId } = await api(`/bots/${id}/runs`, { method: 'POST', body: { durationSec: duration, topicHint } });
      navigate(`/runs/${runId}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const regenerateBrand = async (notes) => {
    setError('');
    setBusy(true);
    try {
      await api(`/bots/${id}/brand`, { method: 'POST', body: { notes } });
      await load(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setError('');
    setSaved('');
    try {
      const { bot: updated } = await api(`/bots/${id}`, { method: 'PATCH', body: { settings } });
      setBot(updated);
      setSettings({ ...DEFAULT_SETTINGS, ...updated.settings });
      setSaved('Saved');
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteBot = async () => {
    if (!window.confirm(`Delete ${bot.name} and all its videos? This can't be undone.`)) return;
    try {
      await api(`/bots/${id}`, { method: 'DELETE' });
      await refresh();
      navigate('/bots');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page container">
      <Link to="/bots" className="back-link">← All bots</Link>
      <div className="page-head">
        <div className="bot-title">
          {bot.brand?.characterImage ? (
            <img className="bot-avatar lg photo" src={bot.brand.characterImage} alt="" />
          ) : (
            <div className="bot-avatar lg" aria-hidden="true">{bot.name.slice(0, 1).toUpperCase()}</div>
          )}
          <div>
            <h1 className="page-title">{bot.name}</h1>
            <p className="page-sub">{niche?.name} · {bot.settings.voice} voice</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
          {showSettings ? 'Close settings' : 'Bot settings'}
        </button>
      </div>
      <PlanBanner />
      {error && <div className="alert" role="alert" style={{ marginBottom: '1.25rem' }}>{error}</div>}

      {showSettings && (
        <form className="card form settings-panel" onSubmit={saveSettings}>
          <BotSettingsFields settings={settings} onChange={setSettings} subscription={subscription} />
          <div className="settings-actions">
            <button className="btn btn-primary btn-sm">Save settings</button>
            {saved && <span className="badge ok">{saved}</span>}
            <button type="button" className="btn btn-ghost btn-sm danger" onClick={deleteBot}>Delete bot</button>
          </div>
        </form>
      )}

      <BrandCard bot={bot} onRegenerate={regenerateBrand} busy={busy} />

      <form className="card request-card" onSubmit={requestVideo}>
        <h2 className="card-title">Ask {bot.name} for a new video</h2>
        <p className="muted small">
          {bot.name} will research what's trending in {niche?.name}, gather sourced facts, pitch 3 ideas,
          and wait for your approval. Credits are only used when you approve.
        </p>
        <div className="field">
          <span className="field-label">Length</span>
          <div className="segmented">
            {DURATIONS.map((d) => (
              <button type="button" key={d} disabled={d > maxDuration} aria-pressed={duration === d} onClick={() => setDuration(d)}>
                {formatDuration(d)}
              </button>
            ))}
          </div>
          {active && maxDuration < 180 && <span className="field-hint">3-minute videos need the Pro plan.</span>}
        </div>
        <label className="field">
          <span className="field-label">Steer it (optional)</span>
          <input className="input" value={topicHint} maxLength={300} onChange={(e) => setTopicHint(e.target.value)} placeholder="Leave blank to let the bot find the trend — or e.g. 'abandoned hospitals'" />
        </label>

        {short && (
          <div className="alert" role="alert">
            A {formatDuration(duration)} video needs {cost} credits and you have {balance}.{' '}
            <Link to="/pricing#packs">Buy a credit pack</Link> or pick a shorter length.
          </div>
        )}

        <div className="request-foot">
          <span className="muted small">
            Needs <strong className="text">{cost} credits</strong> · you have {balance}
            {subscription && <> · {pitchesLeft} idea rounds left this month</>}
          </span>
          <button className="btn btn-primary" disabled={busy || !active || short || pitchesLeft <= 0}>
            {busy ? 'Starting…' : 'Research & pitch ideas →'}
          </button>
        </div>
      </form>

      <h2 className="section-label">Videos</h2>
      {runs.length === 0 ? (
        <p className="muted">No videos yet — ask {bot.name} for one above.</p>
      ) : (
        <ul className="run-list">
          {runs.map((run) => (
            <li key={run.id}>
              <Link to={`/runs/${run.id}`} className="run-row">
                <span className="run-title">{run.title || (run.status === 'awaiting_approval' ? 'Ideas ready for review' : 'Researching…')}</span>
                <span className="muted small">{formatDuration(run.duration_sec)} · {new Date(run.created_at).toLocaleDateString()}</span>
                <StatusBadge status={run.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
