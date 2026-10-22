import React, { useId } from 'react';

// Original mark: an automation loop wrapped around a play button
const Logo = ({ size = 28 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-svg">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4ff8a" />
          <stop offset="0.5" stopColor="#fff44f" />
          <stop offset="1" stopColor="#ffd60a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <path d="M25 16A9 9 0 1 1 21.79 9.11" fill="none" stroke="#12110a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M19.2 10 L23 10.1 L22.2 6.3" fill="none" stroke="#12110a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.6 11.6 L20.6 16 L13.6 20.4 Z" fill="#12110a" stroke="#12110a" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
};

export const Wordmark = () => (
  <>
    <Logo />
    <span>CreatorFriendly<span className="logo-tld">.AI</span></span>
  </>
);

export default Logo;
