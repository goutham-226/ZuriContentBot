import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

function AuthForm({ mode }) {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  // New accounts go straight to picking a plan (there is no free tier)
  const destination = location.state?.from || (isLogin ? '/bots' : '/pricing');
  if (user) return <Navigate to={destination} replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted small" style={{ marginBottom: '1.5rem' }}>
          {isLogin ? 'Sign in to check on your bots.' : 'Then pick a plan and build your first bot.'}
        </p>

        <form className="form" onSubmit={submit}>
          {!isLogin && (
            <label className="field">
              <span className="field-label">Name</span>
              <input className="input" value={form.name} onChange={set('name')} autoComplete="name" required />
            </label>
          )}
          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={isLogin ? undefined : 8}
              required
            />
          </label>
          {error && <div className="alert" role="alert">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'One sec…' : isLogin ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-alt">
          {isLogin ? <>New here? <Link to="/signup">Create an account</Link></> : <>Have an account? <Link to="/login">Sign in</Link></>}
        </p>

        {isLogin && import.meta.env.DEV && (
          <div className="test-creds">
            <strong>Test accounts (dev only)</strong>
            <div><code>demo@creatorfriendly.ai</code> / <code>demo1234</code> — Pro plan, 900 credits</div>
            <div><code>nosub@creatorfriendly.ai</code> / <code>demo1234</code> — no plan (paywall)</div>
            <button type="button" onClick={() => setForm({ ...form, email: 'demo@creatorfriendly.ai', password: 'demo1234' })}>
              Fill in the Pro account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export const LoginPage = () => <AuthForm mode="login" />;
export const SignupPage = () => <AuthForm mode="signup" />;
