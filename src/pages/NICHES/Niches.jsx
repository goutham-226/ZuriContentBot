import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NICHES, NICHE_CATEGORIES } from '../../data/niches';
import Footer from '../../components/Footer';
import './Niches.css';

function Row({ label, children }) {
  return (
    <div className="niche-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function Niches() {
  const [category, setCategory] = useState('All');
  const shown = category === 'All' ? NICHES : NICHES.filter((n) => n.category === category);

  return (
    <>
      <div className="page container">
        <div className="section-head">
          <span className="eyebrow">Niche library</span>
          <h1 className="section-title">{NICHES.length} short-form niches, <span className="gradient-text">researched</span></h1>
          <p className="section-description">
            Each bot starts from one of these playbooks — audience, proven hooks, story structure, visual style,
            pacing and what to avoid — and layers live trend research on top every time it runs.
          </p>
        </div>

        <div className="segmented niche-filter">
          {['All', ...NICHE_CATEGORIES].map((c) => (
            <button type="button" key={c} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>

        <div className="niche-cards">
          {shown.map((n) => (
            <details key={n.id} className="card niche-card">
              <summary>
                <div>
                  <span className="muted small">{n.category}</span>
                  <h2 className="card-title">{n.name}</h2>
                  <p className="muted small">{n.tagline}</p>
                </div>
                <div className="niche-tiers">
                  <span className="badge">Demand: {n.demand}</span>
                  <span className="badge">Competition: {n.competition}</span>
                  <span className="badge">Ad value: {n.rpm}</span>
                </div>
              </summary>
              <dl className="niche-detail">
                <Row label="Why it works">{n.whyItWorks}</Row>
                <Row label="Audience">{n.audience}</Row>
                <Row label="Proven hooks"><ul>{n.hooks.map((h) => <li key={h}>{h}</li>)}</ul></Row>
                <Row label="Formats">{n.formats.join(' · ')}</Row>
                <Row label="Structure">{n.structure.join(' → ')}</Row>
                <Row label="Visual style">{n.visualStyle}</Row>
                <Row label="Voice & pacing">{n.voice}. {n.pacing}.</Row>
                <Row label="Retention">{n.retention.join(' · ')}</Row>
                <Row label="Call to action">{n.cta}</Row>
                <Row label="Avoid">{n.avoid.join(' · ')}</Row>
                <Row label="Live sources">{n.feeds.map((f) => new URL(f).hostname.replace(/^(www|feeds)\./, '')).join(', ')}, Wikipedia, Google Trends + news for “{n.newsQuery}”</Row>
              </dl>
            </details>
          ))}
        </div>

        <div className="guide-cta">
          <Link to="/bots/new" className="btn btn-primary">Create a Zuri for a niche →</Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
