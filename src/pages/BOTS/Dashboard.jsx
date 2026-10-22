import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { getNiche } from '../../data/niches';
import Logo from '../../components/Logo';
import './Bots.css';

export function PlanBanner() {
  const { subscription } = useAuth();
  if (subscription?.status === 'active') return null;
  return (
    <div className="alert info" style={{ marginBottom: '1.5rem' }}>
      {subscription?.status === 'canceled' ? 'Your plan is canceled.' : "You don't have a plan yet."}{' '}
      Bots need an active plan to research and render. <Link to="/pricing">Choose a plan →</Link>
    </div>
  );
}

const timeAgo = (date) => {
  if (!date) return 'Never';
  const mins = Math.round((Date.now() - new Date(date)) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

export default function Dashboard() {
  const { subscription } = useAuth();
  const [bots, setBots] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/bots').then((d) => setBots(d.bots)).catch((e) => setError(e.message));
  }, []);

  const atLimit = subscription && bots && bots.length >= subscription.limits.bots;

  return (
    <div className="page container">
      <div className="page-head">
        <div>
          <h1 className="page-title">Your bots</h1>
          <p className="page-sub">
            Each bot is a content machine for one niche. Open one and ask it for a new video.
          </p>
        </div>
        {subscription?.status === 'active' && (
          <Link to="/bots/new" className={`btn btn-primary ${atLimit ? 'is-disabled' : ''}`} aria-disabled={atLimit}>
            + New bot
          </Link>
        )}
      </div>

      <PlanBanner />
      {error && <div className="alert">{error}</div>}
      {atLimit && (
        <div className="alert info" style={{ marginBottom: '1.5rem' }}>
          You're using all {subscription.limits.bots} bots on {subscription.planName}. <Link to="/pricing">Upgrade</Link> for more.
        </div>
      )}

      {bots && bots.length === 0 && (
        <div className="empty">
          <Logo size={44} />
          <h2 className="card-title">No bots yet</h2>
          <p>Pick a niche and give your bot a name. It will research, pitch ideas, and make videos when you ask.</p>
          <Link to="/bots/new" className="btn btn-primary">Create your first bot</Link>
        </div>
      )}

      {bots && bots.length > 0 && (
        <div className="grid-3">
          {bots.map((bot) => {
            const niche = getNiche(bot.niche_id);
            return (
              <Link key={bot.id} to={`/bots/${bot.id}`} className="card bot-card">
                {bot.brand?.characterImage ? (
                  <img className="bot-avatar photo" src={bot.brand.characterImage} alt="" />
                ) : (
                  <div className="bot-avatar" aria-hidden="true">{bot.name.slice(0, 1).toUpperCase()}</div>
                )}
                <h2 className="card-title">{bot.name}</h2>
                <p className="muted small">{niche?.name || bot.niche_id}{bot.brand ? ` · ${bot.brand.channelName}` : ''}</p>
                <div className="bot-meta">
                  <span>{bot.videos} video{bot.videos === 1 ? '' : 's'}</span>
                  <span>Last run: {timeAgo(bot.last_run_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
