import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { one, query } from './db.js';
import { hit } from './rateLimit.js';

const SESSION_COOKIE = 'cf_session';
const SESSION_DAYS = 30;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

async function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, expires]);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires,
  });
}

export async function signup(req, res) {
  await hit(`signup:${req.ip}`, 5, 3600, 'Too many sign-ups from this network. Try again later.');
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter your name and a valid email.');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

  const exists = await one('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists) throw new HttpError(409, 'An account with that email already exists.');

  const hash = await bcrypt.hash(password, 10);
  const user = await one(
    'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *',
    [email, name, hash]
  );
  await startSession(res, user.id);
  res.status(201).json({ user: publicUser(user) });
}

export async function login(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  await hit(`login:${req.ip}:${email}`, 10, 900, 'Too many login attempts. Wait 15 minutes and try again.');
  const user = await one('SELECT * FROM users WHERE email = $1', [email]);
  const ok = user && (await bcrypt.compare(String(req.body.password || ''), user.password_hash));
  if (!ok) throw new HttpError(401, 'Wrong email or password.');
  await startSession(res, user.id);
  res.json({ user: publicUser(user) });
}

export async function logout(req, res) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await query('DELETE FROM sessions WHERE token = $1', [token]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
}

// Attaches req.user when a valid session cookie is present
export async function loadUser(req, _res, next) {
  try {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      const user = await one(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = $1 AND s.expires_at > now()`,
        [token]
      );
      if (user) req.user = publicUser(user);
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.'));
  next();
}
