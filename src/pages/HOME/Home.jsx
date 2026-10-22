import React from 'react';
import { Link } from 'react-router-dom';
import HeroDemo from '../../components/landing/HeroDemo';
import { Statement, Features, Showcase, HowItWorks, PlansTeaser, Faq, FinalCta } from '../../components/landing/Sections';
import Footer from '../../components/Footer';
import './Home.css';

const Home = () => (
  <>
    <section className="hero container">
      <Link to="/guide" className="hero-pill">
        <span className="hero-pill-dot" /> Zuri now films continuous 1–3 minute reels <span aria-hidden="true">→</span>
      </Link>
      <h1 className="hero-h1">Meet Zuri</h1>
      <p className="hero-sub">
        Your content bot. Pick a niche and ask for a video — Zuri researches what's trending,
        pitches ideas, and films a voiced, captioned reel the moment you say yes.
      </p>
      <div className="hero-actions">
        <Link to="/bots/new" className="btn btn-primary">Create your Zuri</Link>
        <a href="#features" className="btn btn-ghost">See what Zuri does</a>
      </div>
      <div className="hero-demo">
        <HeroDemo />
      </div>
    </section>
    <Statement />
    <Features />
    <Showcase />
    <HowItWorks />
    <PlansTeaser />
    <Faq />
    <FinalCta />
    <Footer />
  </>
);

export default Home;
