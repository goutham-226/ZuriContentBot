import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { NICHES, NICHE_CATEGORIES } from '../../data/niches';
import BotSettingsFields, { DEFAULT_SETTINGS } from './BotSettingsFields';
import { PlanBanner } from './Dashboard';
import './Bots.css';

const NAME_IDEAS = ['Zuri', 'Nightshift', 'Atlas', 'Lumen', 'Echo', 'Vesper', 'Nova', 'Orbit'];

export default function NewBot() {
  const { subscription } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState('All');
  const [nicheId, setNicheId] = useState('');
  const [name, setName] = useState('Zuri');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [brandNotes, setBrandNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const formRef = useRef(null);

  // The form renders below the niche grid, so bring it into view on pick
  useEffect(() => {
    if (nicheId) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [nicheId]);

  const shown = useMemo(() => (category === 'All' ? NICHES : NICHES.filter((n) => n.category === category)), [category]);
  const niche = NICHES.find((n) => n.id === nicheId);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { bot } = await api('/bots', { method: 'POST', body: { name, nicheId, brandNotes, settings } });
      navigate(`/bots/${bot.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Create a Zuri</h1>
          <p className="page-sub">Choose the niche it will own. Its research, ideas, voice and visuals all come from that niche's playbook.</p>
        </div>
      </div>
      <PlanBanner />

      <section aria-labelledby="niche-step">
        <h2 id="niche-step" className="step-heading"><span>1</span> Pick a niche</h2>
        <div className="segmented" style={{ marginBottom: '1.25rem' }}>
          {['All', ...NICHE_CATEGORIES].map((c) => (
            <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
        <div className="niche-grid">
          {shown.map((n) => (
            <button type="button" key={n.id} className={`niche-option ${nicheId === n.id ? 'selected' : ''}`} aria-pressed={nicheId === n.id} onClick={() => setNicheId(n.id)}>
              <span className="niche-option-name">{n.name}</span>
              <span className="niche-option-tag">{n.tagline}</span>
              <span className="niche-option-meta">
                <span>Demand: {n.demand}</span>
                <span>Ad value: {n.rpm}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {niche && (
        <form ref={formRef} className="form new-bot-form" onSubmit={submit}>
          <h2 className="step-heading"><span>2</span> Name it and set it up</h2>
          <div className="card niche-brief">
            <strong>{niche.name}</strong>
            <p className="muted small">{niche.whyItWorks}</p>
            <p className="small"><span className="muted">Audience:</span> {niche.audience}</p>
          </div>

          <label className="field">
            <span className="field-label">Bot name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Zuri" />
            <span className="chips">
              {NAME_IDEAS.map((idea) => (
                <button type="button" key={idea} className="chip chip-btn" onClick={() => setName(idea)}>{idea}</button>
              ))}
            </span>
          </label>

          <label className="field">
            <span className="field-label">Channel identity direction (optional)</span>
            <input className="input" value={brandNotes} maxLength={400} onChange={(e) => setBrandNotes(e.target.value)}
              placeholder="e.g. 'a tired night-shift security guard with a flashlight, grainy VHS look'" />
            <span className="field-hint">Right after you create it, the bot designs a recurring character and house style that every video shares. Leave blank to let it decide.</span>
          </label>

          <BotSettingsFields settings={settings} onChange={setSettings} subscription={subscription} />

          {error && <div className="alert" role="alert">{error}</div>}
          <div>
            <button className="btn btn-primary" disabled={busy || !name.trim() || subscription?.status !== 'active'}>
              {busy ? 'Creating…' : `Create ${name.trim() || 'bot'} →`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
