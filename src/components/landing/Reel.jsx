import React, { useEffect, useMemo, useState } from 'react';
import Mascot from './Mascot';
import './Reel.css';

// Five illustrated "shots" so the demo phone looks like a finished, branded video
function Scene({ kind }) {
  switch (kind) {
    case 'corridor':
      return (
        <svg viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" className="scene">
          <defs>
            <linearGradient id="sc-c" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0d1f1c" />
              <stop offset="1" stopColor="#020605" />
            </linearGradient>
          </defs>
          <rect width="180" height="320" fill="url(#sc-c)" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} className="flicker" style={{ animationDelay: `${i * 0.7}s` }} x={72 - i * 4} y={60 + i * 26} width={36 + i * 8} height="4" rx="2" fill="#bdf7d9" opacity="0.7" />
          ))}
          <path d="M0 320 L72 150 L108 150 L180 320 Z" fill="#081311" />
          <path d="M0 0 L72 150 M180 0 L108 150 M0 320 L72 150 M180 320 L108 150" stroke="#1d3a33" strokeWidth="1.5" />
          <rect x="72" y="118" width="36" height="32" fill="#020605" stroke="#1d3a33" />
          <g className="walker">
            <circle cx="90" cy="196" r="7" fill="#020605" />
            <rect x="83" y="203" width="14" height="30" rx="6" fill="#020605" />
          </g>
        </svg>
      );
    case 'stars':
      return (
        <svg viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" className="scene">
          <defs>
            <radialGradient id="sc-s" cx="0.3" cy="0.2" r="1">
              <stop offset="0" stopColor="#1b2350" />
              <stop offset="1" stopColor="#03040c" />
            </radialGradient>
            <linearGradient id="sc-p" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffb86b" />
              <stop offset="1" stopColor="#8a3b12" />
            </linearGradient>
          </defs>
          <rect width="180" height="320" fill="url(#sc-s)" />
          {Array.from({ length: 28 }, (_, i) => (
            <circle key={i} className="twinkle" style={{ animationDelay: `${(i % 7) * 0.4}s` }} cx={(i * 53) % 180} cy={(i * 97) % 300} r={i % 5 === 0 ? 1.4 : 0.8} fill="#fff" />
          ))}
          <g className="orbit">
            <circle cx="96" cy="170" r="44" fill="url(#sc-p)" />
            <ellipse cx="96" cy="170" rx="74" ry="14" fill="none" stroke="#ffd9a8" strokeWidth="3" opacity="0.7" />
          </g>
        </svg>
      );
    case 'ruins':
      return (
        <svg viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" className="scene">
          <defs>
            <linearGradient id="sc-r" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ff9a5a" />
              <stop offset="0.55" stopColor="#7a2e3a" />
              <stop offset="1" stopColor="#1c0d14" />
            </linearGradient>
          </defs>
          <rect width="180" height="320" fill="url(#sc-r)" />
          <circle className="sun" cx="90" cy="150" r="30" fill="#ffd27a" opacity="0.9" />
          {[20, 52, 112, 144].map((x, i) => (
            <rect key={x} x={x} y={150 + (i % 2) * 20} width="16" height={170 - (i % 2) * 20} fill="#1c0d14" />
          ))}
          <rect x="10" y="140" width="80" height="12" fill="#1c0d14" />
          <rect x="0" y="270" width="180" height="50" fill="#12080d" />
        </svg>
      );
    case 'chart':
      return (
        <svg viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" className="scene">
          <rect width="180" height="320" fill="#06140d" />
          {[80, 130, 180, 230].map((y) => (
            <line key={y} x1="0" x2="180" y1={y} y2={y} stroke="#123321" />
          ))}
          <path className="draw" d="M10 250 L40 232 L62 240 L88 196 L110 205 L136 150 L170 96" fill="none" stroke="#7dffb0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="pulse-dot-svg" cx="170" cy="96" r="6" fill="#7dffb0" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice" className="scene">
          <defs>
            <radialGradient id="sc-b" cx="0.5" cy="0.45" r="0.8">
              <stop offset="0" stopColor="#3b1d5e" />
              <stop offset="1" stopColor="#0b0613" />
            </radialGradient>
          </defs>
          <rect width="180" height="320" fill="url(#sc-b)" />
          {[18, 34, 52, 72].map((r, i) => (
            <circle key={r} className="ripple" style={{ animationDelay: `${i * 0.5}s` }} cx="90" cy="150" r={r} fill="none" stroke="#c9a7ff" strokeWidth="1.5" />
          ))}
          <ellipse cx="90" cy="150" rx="26" ry="16" fill="#f3e9ff" />
          <circle className="iris" cx="90" cy="150" r="10" fill="#2b0f4a" />
        </svg>
      );
  }
}

// Splits a caption script into 3-word chunks, the way the real renderer does
const chunk = (text) => {
  const words = text.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; i += 3) out.push(words.slice(i, i + 3).join(' '));
  return out;
};

export default function Reel({ scene, captions, handle, accent = '#fff44f', playing = true, label }) {
  const chunks = useMemo(() => chunk(captions), [captions]);
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
  }, [captions]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((n) => (n + 1) % chunks.length), 900);
    return () => clearInterval(t);
  }, [playing, chunks.length]);

  return (
    <div className={`reel ${playing ? 'is-playing' : ''}`} aria-label={label || `Example reel: ${captions}`} role="img">
      <div className="reel-progress"><span key={captions} style={{ animationDuration: `${chunks.length * 0.9}s` }} /></div>
      <div className="reel-scene"><Scene kind={scene} /></div>
      <p className="reel-caption" key={i} style={{ color: i % 2 ? accent : '#fff' }}>{chunks[i]}</p>
      <div className="reel-side" aria-hidden="true">
        {['M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z', 'M4 5h16v11H8l-4 4z', 'M14 4l7 7-7 7v-4c-6 0-9 2-11 5 1-6 4-10 11-11z'].map((d) => (
          <svg key={d} viewBox="0 0 24 24" width="22" height="22"><path d={d} fill="#fff" opacity="0.92" /></svg>
        ))}
      </div>
      <div className="reel-meta">
        <span className="reel-avatar"><Mascot size={26} /></span>
        <span>{handle}</span>
      </div>
    </div>
  );
}
