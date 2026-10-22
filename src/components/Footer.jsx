import React from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from './Logo';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link to="/" className="navbar-logo">
              <Wordmark />
            </Link>
            <p className="footer-description">
              Automation bots that research, pitch and produce viral 1–3 minute reels for your niche.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <ul>
                <li><Link to="/bots">My bots</Link></li>
                <li><Link to="/niches">Niche library</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Learn</h4>
              <ul>
                <li><Link to="/guide">How to use it</Link></li>
                <li><Link to="/pricing#credits">How credits work</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} CreatorFriendly.AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
