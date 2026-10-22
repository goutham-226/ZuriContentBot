import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, formatDuration } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { PLANS, CREDIT_PACKS, DURATIONS, creditsFor } from '../../data/pricing';
import Mascot from '../../components/landing/Mascot';
import Footer from '../../components/Footer';
import '../../components/landing/Sections.css';
import './Pricing.css';

const FAQ = [
  ['What is a credit?', 'One credit is one second of finished video. Research, fact-checking and idea pitches never use credits — only videos you approve do.'],
  ['When are credits used?', 'When you approve an idea, its credits are set aside. If the video comes out shorter, the difference comes back to you, and if anything fails you get everything back. The bot won’t start a video your balance can’t cover.'],
  ['Why 480p?', 'It keeps every video affordable. You get a 720×1280 MP4 with sharp captions — run it through an upscaler like CapCut, Topaz Video AI or DaVinci Resolve before posting for a crisp result.'],
  ['Do credits roll over?', 'Monthly plan credits reset every 30 days. Credits from packs never expire and are used after your monthly credits.'],
  ['What is an idea round?', 'Each time the bot researches and pitches ideas — or re-pitches after your feedback — counts as one round. Rounds don’t use credits.'],
  ['Can I change plans?', 'Any time. Switching starts a fresh 30-day period with the new plan’s credits.'],
];

export default function Pricing() {
  const { user, subscription, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState(location.hash === '#packs' ? 'packs' : 'plans');

  useEffect(() => {
    if (location.hash === '#packs') setTab('packs');
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const current = subscription?.status === 'active' ? subscription.planId : null;

  const purchase = async (path, body, id, message) => {
    if (!user) return navigate('/signup', { state: { from: '/pricing' } });
    setError('');
    setNotice('');
    setBusy(id);
    try {
      await api(path, { method: 'POST', body });
      await refresh();
      setNotice(`${message} (Test mode: no card was charged.)`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const cancelPlan = async () => {
    if (!window.confirm('Cancel your plan? Bots will stop rendering.')) return;
    await api('/billing/cancel', { method: 'POST' });
    await refresh();
  };

  return (
    <>
      <div className="page container pricing-page">
        <header className="pricing-hero">
          <Mascot size={84} />
          <h1 className="hero-h1 pricing-h1">Pricing</h1>
          <p className="lp-lead">
            Every plan includes research, fact-checking, idea pitches, your channel identity, ElevenLabs
            voice-over, sound effects and captions. Credits are seconds of finished video.
          </p>
          <div className="segmented pricing-toggle" role="tablist">
            <button role="tab" aria-pressed={tab === 'plans'} onClick={() => setTab('plans')}>Monthly plans</button>
            <button role="tab" aria-pressed={tab === 'packs'} onClick={() => setTab('packs')}>Credit packs</button>
          </div>
        </header>

        {notice && <div className="alert info" role="status" style={{ marginBottom: '1.5rem' }}>{notice} <Link to="/bots">Go to your bots →</Link></div>}
        {error && <div className="alert" role="alert" style={{ marginBottom: '1.5rem' }}>{error}</div>}

        {tab === 'plans' ? (
          <>
            <div className="plan-row" key="plans">
              {PLANS.map((plan, i) => {
                const isCurrent = current === plan.id;
                return (
                  <article key={plan.id} className={`pcard pricing-card ${plan.popular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`} style={{ animationDelay: `${i * 0.08}s` }}>
                    {plan.popular && <span className="plan-flag">Most popular</span>}
                    <h2 className="pcard-name">{plan.name}</h2>
                    <p className="muted small">{plan.tagline}</p>
                    <p className="pcard-price"><span>${plan.price}</span> / month</p>
                    <button
                      className={`btn ${plan.popular ? 'btn-primary' : 'btn-ghost'}`}
                      disabled={isCurrent || busy === plan.id}
                      onClick={() => purchase('/billing/checkout', { planId: plan.id }, plan.id, `You're on ${plan.name} with ${plan.credits.toLocaleString()} credits.`)}
                    >
                      {isCurrent ? 'Current plan' : busy === plan.id ? 'Activating…' : current ? `Switch to ${plan.name}` : `Get ${plan.name}`}
                    </button>
                    <ul>{plan.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  </article>
                );
              })}
            </div>
            <p className="muted small plans-note">
              Test mode — choosing a plan activates it without a card.
              {current && <> · <button className="link-btn" onClick={cancelPlan}>Cancel plan</button></>}
            </p>
          </>
        ) : (
          <section id="packs" key="packs">
            <div className="plan-row">
              {CREDIT_PACKS.map((pack, i) => (
                <article key={pack.id} className={`pcard pricing-card ${pack.popular ? 'popular' : ''}`} style={{ animationDelay: `${i * 0.08}s` }}>
                  {pack.popular && <span className="plan-flag">Best value</span>}
                  <h2 className="pack-credits">{pack.credits.toLocaleString()} <span>credits</span></h2>
                  <p className="muted small">≈ {Math.floor(pack.credits / 60)} one-minute videos · never expire</p>
                  <p className="pcard-price"><span>${pack.price}</span> one-time</p>
                  <button
                    className={`btn ${pack.popular ? 'btn-primary' : 'btn-ghost'}`}
                    disabled={busy === pack.id || Boolean(user && !current)}
                    onClick={() => purchase('/billing/credits', { packId: pack.id }, pack.id, `Added ${pack.credits.toLocaleString()} credits.`)}
                  >
                    {busy === pack.id ? 'Adding…' : 'Buy pack'}
                  </button>
                </article>
              ))}
            </div>
            <p className="muted small plans-note">
              {user && !current ? 'Choose a monthly plan first — packs top up an active plan.' : 'Pack credits are used after your monthly credits run out.'}
            </p>
          </section>
        )}

        <section id="credits" className="lp-section">
          <div className="lp-head">
            <h2 className="lp-h2">How credits work</h2>
            <p className="lp-lead">One credit is one second of finished video. You only spend credits when you approve an idea.</p>
          </div>
          <div className="credit-scale">
            {DURATIONS.map((d) => (
              <div key={d} className="credit-tile">
                <span className="credit-len">{formatDuration(d)}</span>
                <span className="credit-amt">{creditsFor(d)} <small>credits</small></span>
                <span className="credit-bar"><span style={{ width: `${(d / 180) * 100}%` }} /></span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-faq">
          <div className="lp-head"><h2 className="lp-h2">Questions</h2></div>
          <div className="faq-list">
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq-item">
                <summary>{q}<span aria-hidden="true" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
