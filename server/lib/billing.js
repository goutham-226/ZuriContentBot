import { one, query } from './db.js';
import { getPlan, getPack } from '../../src/data/pricing.js';
import { HttpError } from './auth.js';

// Returns the user's subscription with its plan, rolling the credit period
// forward if it has lapsed. null means no plan (there is no free tier).
export async function getSubscription(userId) {
  let sub = await one('SELECT * FROM subscriptions WHERE user_id = $1', [userId]);
  if (!sub) return null;
  const plan = getPlan(sub.plan_id);
  if (!plan) return null;

  if (sub.status === 'active' && new Date(sub.current_period_end) < new Date()) {
    // Test-mode renewal: a real billing provider would confirm payment first
    sub = await one(
      `UPDATE subscriptions SET credits_remaining = $2, current_period_start = now(),
         current_period_end = now() + interval '30 days', updated_at = now()
       WHERE user_id = $1 RETURNING *`,
      [userId, plan.credits]
    );
  }
  return { ...sub, plan };
}

export function serializeSubscription(sub, pitchesUsedThisPeriod = 0) {
  if (!sub) return null;
  return {
    planId: sub.plan_id,
    planName: sub.plan.name,
    status: sub.status,
    credits: sub.credits_remaining + sub.purchased_credits, // what can be spent right now
    monthlyCreditsLeft: sub.credits_remaining,
    purchasedCredits: sub.purchased_credits,
    monthlyCredits: sub.plan.credits,
    periodEnd: sub.current_period_end,
    pitchesUsed: pitchesUsedThisPeriod,
    limits: {
      bots: sub.plan.bots,
      pitchesPerMonth: sub.plan.pitchesPerMonth,
      concurrentRenders: sub.plan.concurrentRenders,
      maxDuration: sub.plan.maxDuration,
    },
  };
}

// Idea rounds (first pitch + every re-pitch) started since the period began
export async function pitchesUsed(userId, since) {
  const row = await one(
    `SELECT coalesce(sum(greatest(pitches, CASE WHEN status = 'researching' THEN 1 ELSE 0 END)), 0)::int AS n
     FROM runs WHERE user_id = $1 AND created_at >= $2`,
    [userId, since]
  );
  return row.n;
}

export const spendableCredits = (sub) => sub.credits_remaining + sub.purchased_credits;

export async function requireActivePlan(userId) {
  const sub = await getSubscription(userId);
  if (!sub || sub.status !== 'active') {
    throw new HttpError(402, 'You need an active plan to do that. Pick one on the pricing page.');
  }
  return sub;
}

// Test-mode checkout: switches plan immediately and grants that plan's credits.
// Swap this for a Stripe Checkout session + webhook before charging real money.
export async function checkout(userId, planId) {
  const plan = getPlan(planId);
  if (!plan) throw new HttpError(400, 'Unknown plan.');
  await query(
    `INSERT INTO subscriptions (user_id, plan_id, status, credits_remaining)
     VALUES ($1, $2, 'active', $3)
     ON CONFLICT (user_id) DO UPDATE SET plan_id = $2, status = 'active', credits_remaining = $3,
       current_period_start = now(), current_period_end = now() + interval '30 days', updated_at = now()`,
    [userId, plan.id, plan.credits]
  );
  return getSubscription(userId);
}

export async function cancel(userId) {
  await query(`UPDATE subscriptions SET status = 'canceled', updated_at = now() WHERE user_id = $1`, [userId]);
  return getSubscription(userId);
}

// Test-mode top-up: adds a credit pack immediately. Needs an active plan.
// Swap for a Stripe one-time payment + webhook before charging real money.
export async function buyPack(userId, packId) {
  const pack = getPack(packId);
  if (!pack) throw new HttpError(400, 'Unknown credit pack.');
  await requireActivePlan(userId);
  await query(
    'UPDATE subscriptions SET purchased_credits = purchased_credits + $2, updated_at = now() WHERE user_id = $1',
    [userId, pack.credits]
  );
  return getSubscription(userId);
}

// Atomically takes credits — monthly credits first, then purchased ones.
// Returns how many came from purchased credits, or null if the balance is too low.
export async function reserveCredits(userId, amount) {
  const row = await one(
    `WITH cur AS (SELECT credits_remaining FROM subscriptions WHERE user_id = $1 FOR UPDATE)
     UPDATE subscriptions s SET
       credits_remaining = s.credits_remaining - least(s.credits_remaining, $2),
       purchased_credits = s.purchased_credits - ($2 - least(s.credits_remaining, $2)),
       updated_at = now()
     FROM cur
     WHERE s.user_id = $1 AND s.status = 'active' AND s.credits_remaining + s.purchased_credits >= $2
     RETURNING $2 - least(cur.credits_remaining, $2) AS from_purchased`,
    [userId, amount]
  );
  return row ? row.from_purchased : null;
}

// Gives credits back, returning the purchased portion to the pool that never expires
export async function refundCredits(userId, amount, fromPurchased = 0) {
  if (amount <= 0) return;
  const toPurchased = Math.min(amount, fromPurchased);
  await query(
    `UPDATE subscriptions SET credits_remaining = credits_remaining + $2,
       purchased_credits = purchased_credits + $3, updated_at = now() WHERE user_id = $1`,
    [userId, amount - toPurchased, toPurchased]
  );
}
