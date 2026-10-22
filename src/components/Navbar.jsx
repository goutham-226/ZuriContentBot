import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Wordmark } from './Logo';
import { useAuth } from '../lib/auth';
import './Navbar.css';

const links = [
  { to: '/bots', label: 'My bots' },
  { to: '/niches', label: 'Niches' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/guide', label: 'Guide' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscription, logout } = useAuth();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const credits = subscription?.status === 'active' ? subscription.credits : null;

  return (
    <header className={`navbar ${scrolled || isOpen ? 'is-solid' : ''}`}>
      <nav className="navbar-inner container">
        <Link to="/" className="navbar-logo" aria-label="CreatorFriendly.AI home">
          <Wordmark />
        </Link>

        <div className="navbar-links">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} className="nav-link">{label}</NavLink>
          ))}
        </div>

        <div className="navbar-actions">
          {user ? (
            <>
              {credits !== null ? (
                <Link to="/pricing" className="credit-pill" title="Credits you can spend now: monthly + purchased (1 credit = 1 second of video)">
                  <span className="credit-dot" /> {credits.toLocaleString()} credits
                </Link>
              ) : (
                <Link to="/pricing" className="credit-pill warn">Choose a plan</Link>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Sign in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>

        <button
          className={`menu-btn ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
          aria-expanded={isOpen}
        >
          <span></span>
          <span></span>
        </button>
      </nav>

      {isOpen && (
        <div className="mobile-menu container">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} className="mobile-link">{label}</NavLink>
          ))}
          {user ? (
            <>
              <span className="mobile-link">{credits !== null ? `${credits.toLocaleString()} credits left` : 'No active plan'}</span>
              <button className="btn btn-ghost" onClick={handleLogout}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="mobile-link">Sign in</NavLink>
              <Link to="/signup" className="btn btn-primary">Get started →</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
