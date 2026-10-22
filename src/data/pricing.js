// Customer-facing plans, credit packs and credit rules. Shipped to the browser —
// never put provider costs or margins here (they live in server/lib/costs.js).

// Every clip is generated at 480p: it's the cost-effective tier, and users upscale before posting
export const RESOLUTION = '480p';

export const DURATIONS = [60, 90, 120, 180];

// 1 credit = 1 second of finished video
export const creditsFor = (durationSec) => durationSec;

export const PLANS = [
  {
    id: 'creator',
    name: 'Creator',
    price: 29,
    credits: 410,
    pitchesPerMonth: 40,
    tagline: 'One channel, posting most days.',
    concurrentRenders: 1,
    maxDuration: 120,
    bots: 3,
    features: ['410 credits / month (≈ 7 one-minute videos)', '40 researched idea rounds / month', 'Videos up to 2 minutes', '3 branded bots', 'ElevenLabs v3 voice-over + captions'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    credits: 1170,
    pitchesPerMonth: 120,
    tagline: 'Daily posting across a few channels.',
    popular: true,
    concurrentRenders: 2,
    maxDuration: 180,
    bots: 10,
    features: ['1,170 credits / month (≈ 19 one-minute videos)', '120 researched idea rounds / month', 'Videos up to 3 minutes', '10 branded bots', '2 renders at once'],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 249,
    credits: 3750,
    pitchesPerMonth: 400,
    tagline: 'Faceless channel networks and agencies.',
    concurrentRenders: 5,
    maxDuration: 180,
    bots: 50,
    features: ['3,750 credits / month (≈ 62 one-minute videos)', '400 researched idea rounds / month', 'Videos up to 3 minutes', '50 branded bots', '5 renders at once'],
  },
];

// null when the user has no subscription — there is no free tier
export const getPlan = (id) => PLANS.find((p) => p.id === id) || null;

// One-time credit top-ups. They never expire, are used after the monthly credits,
// and need an active plan (there is no free tier).
export const CREDIT_PACKS = [
  { id: 'pack-300', credits: 300, price: 18.99 },
  { id: 'pack-900', credits: 900, price: 56.99, popular: true },
  { id: 'pack-2400', credits: 2400, price: 149.99 },
];

export const getPack = (id) => CREDIT_PACKS.find((p) => p.id === id) || null;
