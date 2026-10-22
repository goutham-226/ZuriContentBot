-- Test accounts (password for both: demo1234). Dev only — never run in production.
INSERT INTO users (id, email, name, password_hash) VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo@creatorfriendly.ai', 'Demo Creator',
   '$2b$10$6a3M0ZhqI7KxVDnWpApEduNkvI4eJYXaLFhIAMFgDhJXBYLlyyTvS'),
  ('00000000-0000-4000-8000-000000000002', 'nosub@creatorfriendly.ai', 'No-Plan Tester',
   '$2b$10$6a3M0ZhqI7KxVDnWpApEduNkvI4eJYXaLFhIAMFgDhJXBYLlyyTvS')
ON CONFLICT (email) DO NOTHING;

-- Demo user is on Pro with a full month of credits (1,170). The second account has no
-- subscription (there is no free tier), so it exercises the paywall.
INSERT INTO subscriptions (user_id, plan_id, status, credits_remaining) VALUES
  ('00000000-0000-4000-8000-000000000001', 'pro', 'active', 1170)
ON CONFLICT (user_id) DO NOTHING;

-- Cap the demo account at $10 of real Replicate spend (enough for a few 1-minute videos)
UPDATE users SET spend_cap_cents = 1000 WHERE email = 'demo@creatorfriendly.ai';
