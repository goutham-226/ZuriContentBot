<div align="center">

<img src="public/logo.svg" alt="Zuri logo" width="96" />

# Zuri Content Bot

**An AI content bot that researches trends, pitches ideas, and films voiced, captioned 1–3 minute vertical reels.**

![Vibe Coded](https://img.shields.io/badge/vibe-coded-ff69b4?style=for-the-badge&logo=sparkles&logoColor=white)
![Made for Fun](https://img.shields.io/badge/made%20for-fun-yellow?style=for-the-badge)
![Status](https://img.shields.io/badge/status-experimental-orange?style=for-the-badge)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-required-007808?logo=ffmpeg&logoColor=white)
![Replicate](https://img.shields.io/badge/AI-Replicate-000000?logo=replicate&logoColor=white)
![Last commit](https://img.shields.io/github/last-commit/goutham-226/ZuriContentBot)
![Repo size](https://img.shields.io/github/repo-size/goutham-226/ZuriContentBot)

</div>

> [!NOTE]
> **This is a vibe-coded project.** Unlike my other repos, I didn't hand-write this one line by line. I built it
> for fun by working with AI coding assistants, describing what I wanted and iterating on the result. Treat it as
> a playground and experiment, not production-grade code. Billing runs in test mode, and the seeded accounts are
> for local development only.

## What is it?

Zuri (the product is called **CreatorFriendly.AI** in the UI) is an automated short-form content machine. You pick
a niche, name your bot, and ask it for a video. The bot then:

1. **Builds a channel identity.** It designs a recurring character, a house visual style, a caption color, and a
   signature opening and sign-off, so every video looks like it comes from the same channel.
2. **Researches what's trending right now** across Reddit, Google News, Google Trends, YouTube suggestions, Hacker
   News, niche blogs and Wikipedia. It reads the top articles in full and pulls out a fact sheet with a source for
   every fact.
3. **Pitches 3 ideas.** An analyst pass finds angles, a writer pitches 6 ideas, and a critic scores them on hook,
   curiosity, emotion, visuals and novelty and keeps the best 3.
4. **Waits for you.** Nothing expensive happens until you approve a pitch or send feedback for new ones.
5. **Produces the reel.** It writes the script from the fact sheet, records the voice-over first, then films one
   continuous shot in ~15s clips that follow the narration. It adds foley sound effects, burns in captions and
   mixes everything to -14 LUFS as a 9:16 video.

It also includes a full SaaS shell: auth, subscriptions, credits, rate limits, per-user real-spend caps and a
landing page with an animated mascot.

Supported devices: laptops, tablets and desktops (≥768px wide). Phones see a "use a bigger screen" notice.

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 6, Font Awesome / React Icons |
| Backend | Node.js 22, Express 5, cookie sessions, bcrypt |
| Database | PostgreSQL 16 (Docker Compose); videos are stored as `bytea` |
| AI models | Replicate: Qwen3 235B (text), Flux Schnell (images), ElevenLabs v3 (voice), P-Video 2 Pro (video), MMAudio (foley) |
| Media | ffmpeg / ffprobe for slicing, mixing, captions and loudness |

## Project structure

```
├── src/                 React frontend (landing, bots, runs, pricing, guide, auth)
│   ├── components/      Navbar, footer, landing sections, mascot
│   ├── data/            Niches and pricing / cost model (shared with the server)
│   └── lib/             API client and auth context
├── server/
│   ├── index.js         Express API
│   ├── lib/             Pipeline, research, Replicate, ffmpeg, billing, auth, rate limits
│   └── db/              schema.sql + seed.sql (applied on first DB start)
├── public/              Static assets
├── docker-compose.yml   Local Postgres
└── .env.example         Environment template
```

## Environment variables

Copy `.env.example` to `.env`. Only `REPLICATE_API_TOKEN` is required. `.env` is gitignored, so never commit
real keys.

| Variable | Required | Purpose |
| --- | --- | --- |
| `REPLICATE_API_TOKEN` | ✅ | Replicate API token for all AI models |
| `DATABASE_URL` | — | Postgres connection (defaults to the local Docker DB) |
| `PORT` | — | API port (default `3001`) |
| `TEXT_MODEL` / `IMAGE_MODEL` / `VOICE_MODEL` / `VIDEO_MODEL` / `SFX_MODEL` | — | Override the default Replicate models |
| `REDDIT_RESEARCH` | — | `on` to include Reddit in research (default `off`) |
| `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | — | Reddit OAuth app credentials (otherwise rate-limited RSS) |

## Pipeline

| Step | What happens | Model / tool |
| --- | --- | --- |
| Channel identity | Once per bot: recurring character (+ reference sheet), house style, caption color, signature opening/sign-off | Qwen + 2 Flux images |
| Research | Reddit (OAuth or RSS), Google News, Google Trends, YouTube search suggestions, Hacker News (tech), niche blog feeds, Wikipedia search, Wikipedia "on this day"; the top 5 articles are read in full | `server/lib/research.js` |
| Fact sheet | Up to 15 surprising facts extracted from the read articles, each cited to a source | Qwen |
| Analyst | Trends + 8 candidate angles from signals and facts | Qwen |
| Pitch + critic | 6 pitches, critic scores hook/curiosity/emotion/visuals/novelty, keeps the best 3 with sources | Qwen |
| **Approval** | Owner approves one (credits reserved) or sends feedback for new pitches | — |
| Script | Narration + storyboard built only from the fact sheet, in the channel's style | Qwen |
| Voice-over | Generated **before any video**, one take per segment, plain prose (no emotion tags), steady voice settings; sped up if it would run past 13.8s, then sliced to exactly 14.9s | `elevenlabs/v3` + ffmpeg |
| Opening frame | One keyframe matching the first words of the narration, in the house style | `black-forest-labs/flux-schnell` |
| Video | **One continuous shot** of ~15s clips rendered in order, 480p speed mode. Each clip is filmed **from its own narration slice** (`keep_audio`), so the picture follows the words. Clip *n* starts on clip *n-1*'s last frame and gets it as reference video; every clip also gets the character sheet + style frame. The script gives each clip one camera move and a first-half / second-half shot plan tied to its narration | `prunaai/p-video-2-pro-reference` |
| Sound effects | Foley generated from each finished clip (no voices, breathing or music), while the next clip renders | `zsxkib/mmaudio` |
| Edit | Clean narration over the foley bed (gently ducked), concat, captions in the lower third in the brand color, -14 LUFS | ffmpeg |

Users cannot add reference media; the pipeline chooses every reference. Per clip that is at most
3 images (first frame, character sheet, style frame), 1 video (14.9s max) and 1 audio (14.9s max, used
as the clip's soundtrack), within the model's 9-image / 15s-video / 15s-audio limits.

Each LLM pass has a hard token cap (`LLM_BUDGET` in `src/data/pricing.js`): the research context is
trimmed to fit the input cap and the output cap is sent as `max_tokens`.

## Running locally

Requires Node 22+, Docker, and ffmpeg/ffprobe on the PATH.

```bash
cp .env.example .env          # add your REPLICATE_API_TOKEN
npm install
npm run db:up                 # Postgres 16 on 127.0.0.1:5432, schema + seed applied on first start
npm run server                # API on :3001
npm run dev                   # Vite on :5173 (proxies /api and /media to :3001)
```

`npm run db:reset` wipes the database volume and re-seeds.

### Test accounts (dev seed — password `demo1234`)

| Email | State |
| --- | --- |
| `demo@creatorfriendly.ai` | Pro plan, 1,170 credits, **$10 real-spend cap** |
| `nosub@creatorfriendly.ai` | No plan — shows the paywall |

The spend cap (`users.spend_cap_cents`) is enforced on every Replicate call: each call is pre-charged
at its worst-case cost and refused if it would cross the cap. Reset spend with
`UPDATE users SET spent_cents = 0 WHERE email = 'demo@creatorfriendly.ai';`

Billing runs in **test mode**: choosing a plan or a credit pack on `/pricing` applies it immediately.
Replace `checkout()` / `buyPack()` in `server/lib/billing.js` with Stripe before charging money.

## Where things are stored

| What | Where |
| --- | --- |
| Finished videos | Postgres, `videos` table (`bytea`), streamed by `GET /api/runs/:id/video` to the signed-in owner only, with Range support for seeking; `?download=<name>` saves it as a file |
| Opening frame + segment thumbnails | `server/media/<run id>/` |
| Channel identity images | `server/media/brands/<bot id>/` |
| Clips, voice slices, references | Deleted after each video is finished |

The database lives in the `pgdata` Docker volume, so `npm run db:reset` deletes every video too.

## Auth, rate limits, subscriptions

- Sessions: httpOnly cookie, `sessions` table (30 days). Passwords hashed with bcrypt.
- Rate limits (Postgres fixed windows): 300 API calls/min per user, 10 logins per 15 min per IP+email,
  5 sign-ups/hour per IP, 10 identity redesigns/day.
- Plan limits: bots, max video length, concurrent renders, idea rounds per month. No free tier.
- Credits: 1 credit = 1 second of finished video.
  The bot refuses to start research if the balance can't cover the requested length. Credits are
  reserved on approval (monthly first, then purchased), the unused part is refunded to the pool it
  came from, and everything is refunded on failure or server restart.
- Credit packs never expire and need an active plan.

## Costs and margins

Replicate list prices (Oct 2026, `UNIT_COSTS` in `src/data/pricing.js`):

| Item | Price |
| --- | --- |
| p-video-2-pro-reference, 480p | $0.015/s output, $0.005 per reference image, $0.03/s reference video, $0.0015/s reference audio (all per clip) |
| elevenlabs/v3 | ~$0.10 per 1,000 characters |
| zsxkib/mmaudio | ~$0.012 per 15s clip |
| flux-schnell | $0.003 per image |
| Qwen3 235B | $0.30 / $1.20 per M tokens (estimate), capped per pass |

A 15s clip costs about $0.26 for the first and $0.71 for each later one (the 15s reference video
is about 2/3 of that). Cost of one video: 1 min **$2.50**, 3 min **$8.39**. Sending only the last 5s
of the previous clip as reference (`RUN_ASSUMPTIONS.referenceSeconds`) would cut that by roughly 40%.
Worst-case LLM cost per idea round $0.021 (re-pitch $0.012); channel identity $0.008 per bot.

Credits are priced at the 3-minute rate (the most expensive per second), so margins hold at every
length. At full usage, after card fees (2.9% + $0.30), hosting ($60/mo spread over 50 subscribers,
R2 storage) and the full monthly allowance of idea rounds:

| Plan | Price | Credits | Worst-case cost | Margin |
| --- | --- | --- | --- | --- |
| Creator | $29/mo | 410 | $22.31 | 23% |
| Pro | $79/mo | 1,170 | $60.91 | 23% |
| Studio | $249/mo | 3,750 | $192.27 | 23% |

| Credit pack | Price | Cost | Margin |
| --- | --- | --- | --- |
| 300 credits | $18.99 | $14.83 | 22% |
| 900 credits | $56.99 | $43.89 | 23% |
| 2,400 credits | $149.99 | $116.48 | 22% |

Run `planEconomics()` / `packEconomics()` after changing any price.

## Disclaimer

This is a hobby project made for fun. It is not affiliated with any of the model providers or platforms
mentioned, and AI-generated videos can contain mistakes, so check facts before publishing anything it makes.

