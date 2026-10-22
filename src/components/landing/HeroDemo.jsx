import React, { useEffect, useState } from 'react';
import Mascot from './Mascot';
import Reel from './Reel';
import { useInView, prefersReducedMotion } from './useReveal';
import './HeroDemo.css';

// A looping, self-playing walkthrough of one bot run. Each step reveals one more
// message, so a visitor understands the product without reading a paragraph.
const STEPS = [
  { key: 'ask', ms: 1700 },
  { key: 'research', ms: 3400 },
  { key: 'facts', ms: 2600 },
  { key: 'ideas', ms: 3000 },
  { key: 'approve', ms: 2000 },
  { key: 'render', ms: 4800 },
  { key: 'done', ms: 6000 },
];
const LAST = STEPS.length - 1;

const SOURCES = ['Google Trends', 'Google News', 'Wikipedia', 'Smithsonian', 'Atlas Obscura'];
const IDEAS = [
  { title: 'The Mall Rules', score: 41, pick: true },
  { title: 'The 1518 Dancing Plague', score: 40 },
  { title: 'Room Zero', score: 37 },
];
const SEGMENTS = 4;

const Check = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function BotLine({ children }) {
  return (
    <div className="hd-msg hd-bot">
      <span className="hd-avatar"><Mascot size={22} /></span>
      <div className="hd-bubble">{children}</div>
    </div>
  );
}

export default function HeroDemo() {
  const [frameRef, inView] = useInView();
  const reduced = prefersReducedMotion();
  const [step, setStep] = useState(reduced ? LAST : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    const t = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEPS[step].ms);
    return () => clearTimeout(t);
  }, [step, inView, reduced]);

  const at = (key) => step >= STEPS.findIndex((s) => s.key === key);
  const now = STEPS[step].key;

  return (
    <div className="hd-frame" ref={frameRef}>
      <div className="hd-topbar">
        <span className="hd-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="hd-title">Zuri <span>· Scary Stories</span></span>
        <span className="hd-pill">1,170 credits</span>
      </div>

      <div className="hd-body">
        <div className="hd-chat" aria-live="off">
          <div className="hd-thread">
            <div className="hd-msg hd-user">
              <div className="hd-bubble">
                <span className="hd-typed" key={step === 0 ? 'typing' : 'typed'}>Make me a 1-minute horror reel.</span>
              </div>
            </div>

            {at('research') && (
              <BotLine>
                <p className="hd-label">{now === 'research' ? 'Researching the niche…' : 'Researched 38 sources, read 5 articles'}</p>
                <ul className="hd-sources">
                  {SOURCES.map((s, i) => (
                    <li key={s} style={{ animationDelay: `${i * 0.45}s` }}><Check /> {s}</li>
                  ))}
                </ul>
              </BotLine>
            )}

            {at('facts') && (
              <BotLine>
                <p className="hd-label">Fact sheet</p>
                <p className="hd-fact">“In July 1518, a woman began dancing in a Strasbourg street — within a week dozens had joined.” <span className="hd-cite">[S3]</span></p>
              </BotLine>
            )}

            {at('ideas') && (
              <BotLine>
                <p className="hd-label">3 ideas, scored. Which should I make?</p>
                <ul className="hd-ideas">
                  {IDEAS.map((idea, i) => (
                    <li key={idea.title} className={idea.pick ? 'pick' : ''} style={{ animationDelay: `${i * 0.25}s` }}>
                      <span className="hd-idea-title">{idea.title}{idea.pick && <em>Zuri's pick</em>}</span>
                      <span className="hd-bar"><span style={{ width: `${(idea.score / 50) * 100}%`, animationDelay: `${0.3 + i * 0.25}s` }} /></span>
                      <span className="hd-score">{idea.score}</span>
                      {idea.pick && <span className={`hd-approve ${at('approve') ? 'pressed' : ''}`}>Approve</span>}
                      {idea.pick && now === 'approve' && <span className="hd-cursor" aria-hidden="true" />}
                    </li>
                  ))}
                </ul>
              </BotLine>
            )}

            {at('render') && (
              <BotLine>
                <p className="hd-label">
                  {now === 'render' ? 'Filming one continuous shot…' : 'Filmed 4 segments, no cuts'}
                </p>
                <div className="hd-strip">
                  {Array.from({ length: SEGMENTS }, (_, i) => (
                    <React.Fragment key={i}>
                      <span className="hd-seg" style={{ animationDelay: `${i * 1.05}s` }}><span>{i + 1}</span></span>
                      {i < SEGMENTS - 1 && <span className="hd-link" style={{ animationDelay: `${i * 1.05 + 0.9}s` }} />}
                    </React.Fragment>
                  ))}
                </div>
              </BotLine>
            )}

            {at('done') && (
              <BotLine>
                <p className="hd-label hd-done"><Check /> Your reel is ready — voiced, captioned, on-brand.</p>
              </BotLine>
            )}
          </div>
        </div>

        <div className="hd-phone">
          {now === 'done' ? (
            <Reel
              scene="corridor"
              handle="@graveyardshift"
              captions="Rule number one: never answer the intercom after 3 a.m. Not even if it knows your name. Keep the lights on."
            />
          ) : (
            <div className="hd-phone-idle">
              <Mascot size={92} mood={now === 'ask' ? 'idle' : 'think'} />
              <p>
                {{
                  ask: 'Ready when you are',
                  research: 'Reading the internet…',
                  facts: 'Checking the facts…',
                  ideas: 'Waiting for your pick',
                  approve: 'Approved!',
                  render: 'Rendering…',
                }[now]}
              </p>
              {now === 'render' && (
                <div className="hd-phone-progress"><span /></div>
              )}
            </div>
          )}
        </div>
      </div>

      <ol className="hd-steps" aria-label="What Zuri does">
        {['Research', 'Facts', 'Ideas', 'You approve', 'Film', 'Ready'].map((label, i) => (
          <li key={label} className={step >= i + 1 ? 'on' : ''}>{label}</li>
        ))}
      </ol>
    </div>
  );
}
