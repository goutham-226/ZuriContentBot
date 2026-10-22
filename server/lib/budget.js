import { one, query } from './db.js';
import { HttpError } from './auth.js';

// Real provider spend (Replicate) per user, in cents. Accounts with a cap
// (e.g. the test account) can never be charged past it.

export async function getBudget(userId) {
  const row = await one('SELECT spend_cap_cents, spent_cents FROM users WHERE id = $1', [userId]);
  if (!row || row.spend_cap_cents === null) return null;
  return { capCents: row.spend_cap_cents, spentCents: row.spent_cents, leftCents: Math.max(0, row.spend_cap_cents - row.spent_cents) };
}

// Pre-flight check before starting work that will cost roughly `usd`. The message
// never mentions amounts: provider costs are internal.
export async function assertBudget(userId, usd) {
  const budget = await getBudget(userId);
  if (budget && Math.ceil(usd * 100) > budget.leftCents) {
    throw new HttpError(402, 'This account has reached its usage limit, so the bot can’t start this. Contact support to raise it.');
  }
}

export class SpendCapError extends Error {
  name = 'SpendCapError';
}

// Atomically records spend before a provider call; throws if it would cross the cap
export async function charge(userId, usd, runId = null) {
  const cents = Math.max(1, Math.round(usd * 100));
  const row = await one(
    `UPDATE users SET spent_cents = spent_cents + $2
     WHERE id = $1 AND (spend_cap_cents IS NULL OR spent_cents + $2 <= spend_cap_cents)
     RETURNING spent_cents`,
    [userId, cents]
  );
  if (!row) throw new SpendCapError('Stopped: this account reached its usage limit partway through. Your credits were refunded.');
  if (runId) await query('UPDATE runs SET cost_cents = cost_cents + $2 WHERE id = $1', [runId, cents]);
}
