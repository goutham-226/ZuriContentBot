import React, { useId } from 'react';
import './Mascot.css';

// Zuri, the mascot: a lemon squircle with a play-button antenna. It blinks, glances
// around and bobs (all CSS, paused for reduced-motion users). `mood` tweaks the eyes.
export default function Mascot({ size = 120, mood = 'idle', className = '' }) {
  const id = useId();
  return (
    <svg className={`mascot mascot--${mood} ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="20" y1="18" x2="104" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fbff9a" />
          <stop offset="0.55" stopColor="#fff44f" />
          <stop offset="1" stopColor="#f5c400" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff44f" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff44f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="mascot__bob">
        <circle className="mascot__halo" cx="60" cy="66" r="56" fill={`url(#${id}-glow)`} />
        <line x1="60" y1="30" x2="60" y2="16" stroke="#f5c400" strokeWidth="4" strokeLinecap="round" />
        <path className="mascot__antenna" d="M55 6 L67 12 L55 18 Z" fill="#fff44f" stroke="#f5c400" strokeWidth="2" strokeLinejoin="round" />
        <rect x="18" y="28" width="84" height="76" rx="30" fill={`url(#${id}-body)`} />
        <rect x="30" y="44" width="60" height="40" rx="20" fill="#12110a" />
        <g className="mascot__eyes">
          <ellipse className="mascot__eye" cx="48" cy="64" rx="6" ry="8" fill="#fff44f" />
          <ellipse className="mascot__eye" cx="72" cy="64" rx="6" ry="8" fill="#fff44f" />
        </g>
        <ellipse cx="34" cy="94" rx="7" ry="3.5" fill="#f5c400" opacity="0.6" />
        <ellipse cx="86" cy="94" rx="7" ry="3.5" fill="#f5c400" opacity="0.6" />
      </g>
    </svg>
  );
}
