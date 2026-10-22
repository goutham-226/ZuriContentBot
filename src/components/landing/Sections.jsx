import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Mascot from './Mascot';
import Reel from './Reel';
import { useReveal, useInView, prefersReducedMotion } from './useReveal';
import { PLANS } from '../../data/pricing';
import { NICHES } from '../../data/niches';
import './Sections.css';

function Reveal({ as = 'div', className = '', children, ...rest }) {
  const Tag = as;
  const [ref, shown] = useReveal();
  return (
    <Tag ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

// ---------- Statement: talk to it like a teammate ----------
export function Statement() {
  return (
    <section className="container lp-section">
      <Reveal className="statement">
        <div className="statement-copy">
          <h2 className="lp-h2">Message Zuri like a teammate</h2>
          <p className="lp-lead">
            Ask for a video in plain words. Zuri does the research, pitches the ideas and comes back
            when it needs your yes. Nothing gets made without you.
          </p>
        </div>
        <div className="statement-pop" aria-hidden="true">
          <div className="statement-bubble">Found a great one. Want to see?</div>
          <Mascot size={170} />
        </div>
      </Reveal>
    </section>
  );
}

// ---------- Feature cards with live mini demos ----------
const Check = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function ResearchSnippet() {
  return (
    <div className="snip snip-research" aria-hidden="true">
      <span className="snip-scan" />
      {['Google Trends · today', 'Google News · 7 days', 'Wikipedia · 4 pages', 'Smithsonian · full article', 'YouTube · top searches'].map((s, i) => (
        <div key={s} className="snip-row" style={{ animationDelay: `${i * 0.6}s` }}>
          <span className="snip-tick"><Check /></span>{s}
        </div>
      ))}
      <div className="snip-fact">“Dancing mania struck Europe between the 14th and 17th centuries.” <b>[S2]</b></div>
    </div>
  );
}

function PitchSnippet() {
  return (
    <div className="snip snip-pitch" aria-hidden="true">
      {[['The Mall Rules', 82], ['Dancing Plague', 80], ['Room Zero', 74]].map(([t, w], i) => (
        <div key={t} className={`snip-idea ${i === 0 ? 'pick' : ''}`}>
          <span>{t}</span>
          <span className="snip-bar"><span style={{ width: `${w}%`, animationDelay: `${i * 0.3}s` }} /></span>
        </div>
      ))}
      <div className="snip-wait">
        <Mascot size={40} mood="think" />
        <span>Waiting for your pick</span>
        <span className="snip-approve">Approve</span>
      </div>
    </div>
  );
}

function ShotSnippet() {
  const tints = ['#16302a', '#1d2a3a', '#2e2440', '#3a2e14', '#16302a', '#1d2a3a', '#2e2440', '#3a2e14'];
  return (
    <div className="snip snip-shot" aria-hidden="true">
      <div className="snip-film">
        {tints.map((c, i) => (
          <React.Fragment key={i}>
            <span className="snip-frame" style={{ background: `linear-gradient(135deg, ${c}, #0b0b0b)` }}>
              <i>{(i % 4) * 15}s</i>
            </span>
            <span className="snip-join" />
          </React.Fragment>
        ))}
      </div>
      <p className="snip-note">Each 15-second segment picks up exactly where the last one ended.</p>
    </div>
  );
}

function BrandSnippet() {
  return (
    <div className="snip snip-brand" aria-hidden="true">
      <div className="snip-char">
        <svg viewBox="0 0 80 100" width="72" height="90">
          <rect width="80" height="100" rx="14" fill="#16302a" />
          <circle cx="40" cy="36" r="15" fill="#c9b79c" />
          <path d="M25 30 Q40 14 55 30 L55 26 Q40 8 25 26 Z" fill="#6b6b6b" />
          <path d="M14 100 Q14 62 40 60 Q66 62 66 100 Z" fill="#23304a" />
          <rect x="47" y="70" width="14" height="5" rx="2" fill="#fff44f" />
        </svg>
        <div>
          <strong>Walt Mercer</strong>
          <span>Night-shift guard · recurring host</span>
          <span className="snip-swatches"><i style={{ background: '#16302a' }} /><i style={{ background: '#7fa37a' }} /><i style={{ background: '#e8a33d' }} /><i style={{ background: '#fff44f' }} /></span>
        </div>
      </div>
      <p className="snip-caption"><span>KEEP THE</span> <span className="hl">LIGHTS ON.</span></p>
    </div>
  );
}

const FEATURES = [
  { title: 'Researches real facts', body: 'Reads what’s trending, the news, niche blogs and Wikipedia, then writes only from a fact sheet with sources.', demo: <ResearchSnippet /> },
  { title: 'Pitches, then waits for you', body: 'Three ideas, scored for hook, curiosity and novelty. Nothing is made until you approve one.', demo: <PitchSnippet /> },
  { title: 'Films one continuous shot', body: '1 to 3 minutes with no jump cuts. Every segment continues the last, voiced and captioned.', demo: <ShotSnippet /> },
  { title: 'Gives your channel a face', body: 'Each Zuri designs a recurring character, a house style and a sign-off that every video shares.', demo: <BrandSnippet /> },
];

export function Features() {
  return (
    <section className="container lp-section" id="features">
      <Reveal className="lp-head">
        <h2 className="lp-h2">A whole content team in one Zuri</h2>
        <p className="lp-lead">Researcher, strategist, writer, voice actor and editor — every time you ask for a video.</p>
      </Reveal>
      <div className="feature-grid-2">
        {FEATURES.map((f, i) => (
          <Reveal as="article" key={f.title} className="fcard" style={{ transitionDelay: `${(i % 2) * 0.1}s` }}>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <figure className="fcard-stage">{f.demo}</figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------- Niche showcase: tabs + live phone ----------
const SHOWCASE = [
  { id: 'scary-stories', scene: 'corridor', handle: '@graveyardshift', accent: '#fff44f', blurb: 'Rules horror and creepy encounters, told by a recurring night-shift guard.', captions: 'Rule number one: never answer the intercom after 3 a.m. Not even if it knows your name.' },
  { id: 'history-mysteries', scene: 'ruins', handle: '@lostledger', accent: '#ffd27a', blurb: 'Untold history and unsolved mysteries, built from sourced facts.', captions: 'In 1518, four hundred people danced in the streets of Strasbourg. Nobody could make them stop.' },
  { id: 'space-science', scene: 'stars', handle: '@deepfieldnotes', accent: '#ffb86b', blurb: 'What-ifs and new discoveries at the scale of the universe.', captions: 'There is a planet where it rains glass sideways at five thousand miles an hour.' },
  { id: 'finance-tips', scene: 'chart', handle: '@compoundclub', accent: '#7dffb0', blurb: 'One money move per video, with the number that makes it click.', captions: 'If you are twenty five with one thousand dollars, do this before anything else.' },
  { id: 'psychology-facts', scene: 'eye', handle: '@mindtells', accent: '#c9a7ff', blurb: 'Body language, biases and the reasons people do what they do.', captions: 'If someone does this while you talk, they already made up their mind.' },
];

export function Showcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ref, inView] = useInView();
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (paused || !inView || reduced) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % SHOWCASE.length), 7000);
    return () => clearTimeout(t);
  }, [active, paused, inView, reduced]);

  const item = SHOWCASE[active];
  const niche = (id) => NICHES.find((n) => n.id === id);

  return (
    <section className="container lp-section" ref={ref}>
      <Reveal className="showcase" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="showcase-copy">
          <h2 className="lp-h2">One Zuri per channel. Run as many as you like.</h2>
          <p className="lp-lead">Pick from 24 researched niches. Each Zuri learns its niche's hooks, pacing and look.</p>
          <div className="showcase-tabs" role="tablist" aria-label="Example bots">
            {SHOWCASE.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={i === active}
                className={`showcase-tab ${i === active ? 'on' : ''}`}
                onClick={() => setActive(i)}
              >
                {niche(s.id)?.name}
                {i === active && !paused && !reduced && <span className="tab-timer" key={active} />}
              </button>
            ))}
          </div>
          <p className="showcase-blurb" key={item.id}>{item.blurb}</p>
          <Link to="/niches" className="btn btn-ghost btn-sm">Browse all 24 niches</Link>
        </div>
        <div className="showcase-phone" key={item.id}>
          <Reel scene={item.scene} captions={item.captions} handle={item.handle} accent={item.accent} playing={inView && !reduced} />
        </div>
      </Reveal>
    </section>
  );
}

// ---------- How it works ----------
const STEPS = [
  { title: 'Create a Zuri, pick a niche', body: 'It designs its channel identity in about a minute.' },
  { title: 'Ask for a video', body: 'Choose 1 to 3 minutes. It researches and pitches three ideas.' },
  { title: 'Approve the best one', body: 'Add a note if you like. Nothing is made without your yes.' },
  { title: 'Upscale and post', body: 'Download the MP4, upscale it, post it everywhere.' },
];

export function HowItWorks() {
  const [ref, shown] = useReveal({ threshold: 0.3 });
  return (
    <section className="container lp-section">
      <div className="lp-head">
        <h2 className="lp-h2">From idea to upload in four steps</h2>
      </div>
      <ol ref={ref} className={`how ${shown ? 'in' : ''}`}>
        {STEPS.map((s, i) => (
          <li key={s.title} style={{ transitionDelay: `${0.2 + i * 0.25}s` }}>
            <span className="how-dot">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------- Plans ----------
export function PlansTeaser() {
  return (
    <section className="container lp-section" id="plans">
      <Reveal className="lp-head">
        <h2 className="lp-h2">Pricing</h2>
        <p className="lp-lead">Credits are seconds of finished video. Research and ideas are included.</p>
      </Reveal>
      <div className="plan-row">
        {PLANS.map((p, i) => (
          <Reveal as="article" key={p.id} className={`pcard ${p.popular ? 'popular' : ''}`} style={{ transitionDelay: `${i * 0.08}s` }}>
            <h3>{p.name}</h3>
            <p className="pcard-price"><span>${p.price}</span> / month</p>
            <p className="pcard-credits">{p.credits.toLocaleString()} credits every month</p>
            <Link to="/pricing" className={`btn ${p.popular ? 'btn-primary' : 'btn-ghost'}`}>Get {p.name}</Link>
            <ul>
              {p.features.slice(1, 5).map((f) => <li key={f}>{f}</li>)}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ---------- FAQ ----------
const FAQS = [
  ['How is Zuri different from an AI video generator?', 'A generator makes whatever you type. Zuri does the whole job: it finds what’s trending in your niche, checks the facts, pitches ideas, and produces a finished, branded, voiced reel once you approve.'],
  ['Do I need to write prompts?', 'No. Ask for a video, optionally steer it with a few words, and pick from Zuri’s ideas. It writes every prompt itself.'],
  ['Will every video look like my channel?', 'Yes. Each Zuri designs a recurring character, house style, caption color and sign-off once, and every video reuses them.'],
  ['Why 480p?', 'It keeps each video affordable. Run the MP4 through an upscaler like CapCut, Topaz Video AI or DaVinci Resolve before posting for a crisp result.'],
  ['What happens if a render fails?', 'Your credits come straight back. Credits are only reserved when you approve an idea, and any unused part is refunded.'],
];

export function Faq() {
  return (
    <section className="container lp-section lp-faq">
      <Reveal className="lp-head">
        <h2 className="lp-h2">FAQs</h2>
      </Reveal>
      <div className="faq-list">
        {FAQS.map(([q, a]) => (
          <details key={q} className="faq-item">
            <summary>{q}<span aria-hidden="true" /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------- Closing CTA ----------
export function FinalCta() {
  return (
    <section className="container lp-section">
      <Reveal className="final-cta">
        <Mascot size={120} mood="happy" />
        <h2 className="lp-h2">Meet Zuri</h2>
        <p className="lp-lead">A content machine that researches, pitches and films while you do anything else.</p>
        <div className="lp-actions">
          <Link to="/bots/new" className="btn btn-primary">Create your Zuri</Link>
          <Link to="/guide" className="btn btn-ghost">Read the guide</Link>
        </div>
      </Reveal>
    </section>
  );
}
