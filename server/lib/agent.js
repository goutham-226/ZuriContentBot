import { generateText } from './replicate.js';
import { signalsDigest, readingDigest, sourceIndex } from './research.js';
import { LLM_BUDGET, CHARS_PER_TOKEN, RUN_ASSUMPTIONS, llmCost } from './costs.js';

// Pulls the first JSON object out of a model reply (tolerates prose / code fences)
function parseJson(text) {
  const cleaned = text.replace(/```(?:json)?/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Model reply contained no JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Builds a prompt that fits the pass's input token cap. `context` is the bulky,
// trimmable research; `template` holds the instructions and a {{CONTEXT}} slot.
function fitPrompt(template, context, pass) {
  const maxChars = Math.floor(LLM_BUDGET[pass].in * CHARS_PER_TOKEN);
  const room = Math.max(0, maxChars - template.length);
  const trimmed = context.length > room ? `${context.slice(0, room)}\n[…research trimmed to budget]` : context;
  return template.replace('{{CONTEXT}}', trimmed).slice(0, maxChars);
}

// Every model call goes through here: `spend` pre-charges the worst-case cost of
// the pass (so spend caps hold), then the reply is parsed, with one retry.
async function askJson(pass, template, context, { spend, temperature = 0.8 }) {
  const prompt = fitPrompt(template, context, pass);
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    await spend(llmCost(pass));
    const reply = await generateText(
      attempt === 0 ? prompt : `${prompt}\n\nIMPORTANT: Reply with ONE valid JSON object only. No commentary.`,
      { maxTokens: LLM_BUDGET[pass].out, temperature }
    );
    try {
      return parseJson(reply);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

function playbook(niche) {
  return `NICHE PLAYBOOK: ${niche.name}
Audience: ${niche.audience}
Why it works: ${niche.whyItWorks}
Proven hooks: ${niche.hooks.join(' | ')}
Formats: ${niche.formats.join(' | ')}
Story structure: ${niche.structure.join(' -> ')}
Visual style: ${niche.visualStyle}
Voice: ${niche.voice}
Pacing: ${niche.pacing}
Retention tricks: ${niche.retention.join(' | ')}
CTA: ${niche.cta}
Never: ${niche.avoid.join(' | ')}`;
}

function brandBrief(brand) {
  if (!brand) return '';
  const c = brand.character;
  return `CHANNEL IDENTITY (keep every video on-brand):
Channel: ${brand.channelName} (${brand.handle}) — ${brand.tagline}
Recurring character: ${c.name}, ${c.role}. Look: ${c.look}. Personality: ${c.personality}. Catchphrase: "${c.catchphrase}"
House style: ${brand.style.look}. Lighting: ${brand.style.lighting}. Camera: ${brand.style.camera}. Color grade: ${brand.style.colorGrade}
Signature opening: ${brand.signatureOpening}
Signature sign-off: ${brand.signatureSignoff}`;
}

function botBrief(bot) {
  const s = bot.settings || {};
  return [
    `You are "${bot.name}", an autonomous short-form content strategist for a faceless ${bot.niche.name} channel.`,
    s.styleNotes && `Channel owner's style notes: ${s.styleNotes}`,
    s.audienceNotes && `Channel owner's audience notes: ${s.audienceNotes}`,
    brandBrief(bot.brand),
  ]
    .filter(Boolean)
    .join('\n');
}

// Once per bot — designs the channel's recurring character and house style
export async function designBrand({ bot, notes, spend }) {
  const brand = await askJson(
    'brand',
    `${botBrief({ ...bot, brand: null })}

${playbook(bot.niche)}
${notes ? `Owner's direction for the identity: "${notes}"` : ''}

Task: design a distinctive, ORIGINAL channel identity for this bot so viewers recognize it within
one second of any video. It needs one recurring on-screen character (a host, narrator persona or
mascot that appears in most videos) and a consistent house visual style.
The character must be original — not resembling any real person, celebrity or existing franchise.
Describe the character's look concretely and permanently (age, build, face, hair, outfit, one
signature accessory or prop) so an image model can redraw the same person every time.
${bot.niche.id === 'kids-learning' ? 'This is a kids channel: use a friendly cartoon/3D-animation style character.' : ''}

{{CONTEXT}}

Reply as JSON:
{"channelName":"","handle":"@...","tagline":"",
 "character":{"name":"","role":"","look":"","personality":"","catchphrase":""},
 "style":{"look":"overall art direction","lighting":"","camera":"","colorGrade":"","palette":["#hex","#hex","#hex"]},
 "captionColor":"#hex accent for captions, readable on video",
 "signatureOpening":"how every video opens","signatureSignoff":"the ritual last line"}`,
    '',
    { spend, temperature: 0.95 }
  );
  if (!brand.character?.look || !brand.style?.look) throw new Error('Brand design was incomplete');
  return brand;
}

const subtopicList = (niche) => (niche.subtopics || []).join(', ');

// The research persona every pass shares
const MACHINE = (niche) => `You are Zuri's content research machine for a ${niche.name} short-form channel.
Your job is to mine credible sources for specific, true, surprising stories that become viral videos.
You care about stories (a person, a place, a moment, a twist), not general topics. You never invent
facts, and you deliberately spread your picks across this niche's sub-topics: ${subtopicList(niche)}.`;

// Pass 1 — story mining: read full articles + Wikipedia, pull out sourced facts
// and ready-made story leads, spread across sub-topics and sources
export async function extractFacts({ bot, signals, topicHint, spend }) {
  const sources = sourceIndex(signals);
  const reading = readingDigest(signals, sources);
  if (!reading) return { facts: [], stories: [], sources };
  const mined = await askJson(
    'facts',
    `${MACHINE(bot.niche)}
${topicHint ? `The owner wants this direction: "${topicHint}".` : `This run's focus sub-topics: ${(signals.focusTopics || []).join(', ')} — but use anything strong.`}

Read the source texts below like a researcher looking for video material.
1. Extract up to 15 specific, surprising, verifiable facts — names, dates, numbers, places, quotes.
   At most 3 facts from any single source. Only use what the texts state; never add outside knowledge.
2. Extract up to 8 story leads: concrete stories from these sources that would make a gripping
   ${bot.niche.name} video. Each lead must come from a different sub-topic where possible.
   Skip promotional, product or entertainment-industry news unless it is itself a great story.
Cite everything with the bracketed source id.

SOURCES:
{{CONTEXT}}

Reply as JSON:
{"facts":[{"fact":"","source":"S1","subtopic":""}],
 "stories":[{"headline":"","whyItWorks":"","source":"S1","subtopic":""}]}`,
    reading,
    { spend, temperature: 0.3 }
  );
  const cite = (list) =>
    (Array.isArray(list) ? list : [])
      .map((f) => ({ ...f, source: String(f.source || '').replace(/[[\]]/g, '') }))
      .filter((f) => sources.some((src) => src.id === f.source))
      .map((f) => ({ ...f, url: sources.find((src) => src.id === f.source).url }));
  const facts = cite(mined.facts).filter((f) => String(f.fact || '').trim()).map((f) => ({ ...f, fact: String(f.fact).trim() }));
  const stories = cite(mined.stories).filter((st) => String(st.headline || '').trim());
  return { facts, stories, sources };
}

const factSheet = (facts) =>
  facts.length
    ? `FACT SHEET (verified, cite as [S#]):\n${facts.map((f) => `- ${f.fact} [${f.source}]${f.subtopic ? ` (${f.subtopic})` : ''}`).join('\n')}`
    : 'FACT SHEET: (none gathered)';

const storyLeads = (stories = []) =>
  stories.length ? `STORY LEADS:\n${stories.map((st) => `- ${st.headline} [${st.source}] (${st.subtopic || 'general'}) — ${st.whyItWorks || ''}`).join('\n')}` : '';

// Pass 2 — analyst: signals + facts + leads -> trends and 8 angles across sub-topics
export async function analyzeTrends({ bot, signals, facts, stories, sources, topicHint, recentTitles, spend }) {
  return askJson(
    'analyze',
    `${MACHINE(bot.niche)}

${botBrief(bot)}

${playbook(bot.niche)}

${factSheet(facts)}

${storyLeads(stories)}

${topicHint ? `The owner asked for this direction: "${topicHint}"` : ''}
${recentTitles.length ? `Already made (do NOT repeat): ${recentTitles.join(' | ')}` : ''}

Task: identify what is resonating RIGHT NOW and why, then list 8 video angles. Rules:
- Each angle is a specific story, not a vague theme. Prefer story leads and fact-sheet stories.
- DIVERSITY: the 8 angles must cover at least 5 different sub-topics, and no more than 2 may share
  one sub-topic${topicHint ? ' (within the owner\'s direction)' : ''}. Mix eras, places, tones and formats.

LIVE RESEARCH:
{{CONTEXT}}

Reply as JSON:
{"trends":[{"signal":"what you saw","insight":"why audiences care"}],
 "angles":[{"angle":"specific story","subtopic":"","basedOn":"lead/fact [S#] or evergreen pattern","emotion":"","hookIdea":"first line"}]}`,
    signalsDigest(signals, sources),
    { spend, temperature: 0.9 }
  );
}

const SCORE_KEYS = ['hook', 'curiosity', 'emotion', 'visuals', 'novelty'];

// Pass 3 — writer pitches 4 ideas; Pass 4 — critic scores them (scores only, so
// it's fast) and keeps the best 3 from different sub-topics
export async function pitchIdeas({ bot, research, durationSec, feedback, rejected, spend, onCritic }) {
  const pitches = await askJson(
    'pitch',
    `${MACHINE(bot.niche)}

${botBrief(bot)}

${playbook(bot.niche)}

${feedback ? `The owner rejected the last ideas with this feedback — follow it: "${feedback}"` : ''}
${rejected?.length ? `Rejected ideas (do not reuse): ${rejected.join(' | ')}` : ''}

Task: develop the 4 strongest angles into video pitches for a ${durationSec}-second vertical video
(Reels / TikTok / Shorts) on this channel. The 4 pitches MUST come from 4 different sub-topics.
Every pitch needs a scroll-stopping hook line for the first 2 seconds, a curiosity gap paid off only
at the end, and visuals an AI video model can render well (cinematic, concrete — no on-screen text,
logos or real celebrities). Feature the channel's recurring character where it fits. Ground claims in
the fact sheet and list the source ids you used. Keep every field short.

{{CONTEXT}}

Reply as JSON:
{"ideas":[{"title":"","subtopic":"","hook":"exact first spoken line","premise":"2 sentences",
 "beats":["4-5 short beats"],"payoff":"the ending reveal","emotion":"","visualStyle":"one line",
 "whyViral":"one sentence tied to the research","sources":["S1"],"caption":"post caption","hashtags":["#tag"]}]}`,
    `${factSheet(research.facts || [])}\n\n${storyLeads(research.stories)}\n\nTREND ANALYSIS:\n${JSON.stringify(research.trends)}\n\nCANDIDATE ANGLES:\n${JSON.stringify(research.angles)}`,
    { spend, temperature: 0.95 }
  );
  const all = (pitches.ideas || []).filter((i) => i && i.title);
  if (!all.length) throw new Error('The writer pass returned no ideas');
  await onCritic?.();

  const judged = await askJson(
    'critic',
    `You are a ruthless short-form critic who has studied thousands of viral ${bot.niche.name} videos.
Score each pitch 1-10 on: hook (stops the scroll in 2s), curiosity (must watch to the end),
emotion (strength of feeling), visuals (AI-renderable and striking), novelty (not saturated).
Penalize factual claims not backed by the cited sources. Write a punchier hook if you can.
Then keep the best 3 — they must be from 3 different sub-topics — and recommend one.

PITCHES (numbered from 0):
{{CONTEXT}}

Reply as JSON (do not repeat the pitches):
{"scores":[{"index":0,"hook":0,"curiosity":0,"emotion":0,"visuals":0,"novelty":0,"betterHook":"","verdict":"one line"}],
 "keep":[0,1,2],"recommended":0}`,
    JSON.stringify(all.map((p, i) => ({ index: i, title: p.title, subtopic: p.subtopic, hook: p.hook, premise: p.premise, payoff: p.payoff, sources: p.sources }))),
    { spend, temperature: 0.4 }
  );

  const scoreOf = (i) => (judged.scores || []).find((sc) => Number(sc.index) === i) || {};
  const total = (i) => SCORE_KEYS.reduce((n, k) => n + (Number(scoreOf(i)[k]) || 0), 0);
  // Trust the critic's picks, but enforce distinct sub-topics and fill gaps by score
  const order = [...new Set([...(judged.keep || []).map(Number), ...all.map((_, i) => i).sort((x, y) => total(y) - total(x))])]
    .filter((i) => all[i]);
  const keep = [];
  const usedTopics = new Set();
  for (const i of order) {
    const topic = String(all[i].subtopic || i).toLowerCase();
    if (usedTopics.has(topic)) continue;
    usedTopics.add(topic);
    keep.push(i);
    if (keep.length === 3) break;
  }
  for (const i of order) if (keep.length < 3 && !keep.includes(i)) keep.push(i);

  const sources = research.sources || [];
  const ideas = keep.map((i) => {
    const sc = scoreOf(i);
    return {
      ...all[i],
      hook: String(sc.betterHook || '').trim() || all[i].hook,
      verdict: sc.verdict,
      sources: (all[i].sources || []).map((id) => sources.find((src) => src.id === String(id).replace(/[[\]]/g, ''))).filter(Boolean),
      scores: Object.fromEntries(SCORE_KEYS.map((k) => [k, Math.max(0, Math.min(10, Number(sc[k]) || 0))])),
    };
  });
  const rec = keep.indexOf(Number(judged.recommended));
  const recommended = rec >= 0 ? rec : ideas.reduce((best, idea, i, arr) => (SCORE_KEYS.reduce((n, k) => n + idea.scores[k], 0) > SCORE_KEYS.reduce((n, k) => n + arr[best].scores[k], 0) ? i : best), 0);
  return { ideas, recommended };
}

// Every video is a chain of fixed-length clips (15s each)
export const segmentCount = (durationSec) => Math.max(1, Math.round(durationSec / RUN_ASSUMPTIONS.clipSeconds));

// Narration goes to TTS as plain prose: bracketed emotion tags made ElevenLabs
// whisper and sigh mid-sentence, which sounded like a second voice
export const cleanNarration = (text) =>
  String(text || '').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();

// Pass 5 — scriptwriter: one continuous shot, split into 15s segments, with every
// segment's picture written to match its own narration
export async function writeScript({ bot, idea, durationSec, notes, facts, spend }) {
  const count = segmentCount(durationSec);
  const clip = RUN_ASSUMPTIONS.clipSeconds;
  const half = Math.round(clip / 2);
  const script = await askJson(
    'script',
    `${botBrief(bot)}

${playbook(bot.niche)}

${notes ? `Owner's notes on the approved idea: "${notes}"` : ''}

Write the voice-over and shot plan for a ${durationSec}-second vertical video, filmed as ONE CONTINUOUS
SHOT in exactly ${count} consecutive ${clip}-second segments. An AI video model films each segment
from its narration audio, continuing directly from the last frame of the previous segment.

THE PICTURE MUST MATCH THE WORDS. This is the most important rule.
- Whatever the narration says during a moment is what the viewer sees at that moment. If the
  narration says "children crushed lead with bare hands", the frame shows a child crushing lead.
- Split each segment into two halves: firstHalf covers seconds 0-${half} and the first sentence(s) of that
  segment's narration; secondHalf covers ${half}-${clip} and the rest.

WHAT THE VIDEO MODEL CAN FILM (stay inside this):
- One continuous camera move per segment (slow push-in, pull-back, pan, tilt, orbit, follow).
- One or two simple, physical actions per half. Concrete nouns, visible actions.
- No cuts, dissolves, overlays, split screens, flashbacks, montages, on-screen text, maps or charts.
- The whole video lives in ONE connected setting the camera can travel through (a mine, its tunnels,
  a chamber beyond). When the narration mentions other places or people, show them inside this
  setting: a figure working nearby, an object, a painting, a shadow on the wall.
- The recurring character is a voice-over narrator. On screen they may act, point, examine things,
  but never talk to camera. Feature them in the first and last segment.

NARRATION:
- Plain spoken English, 28-34 words per segment (~2.4 words per second). No stage directions,
  no bracketed tags, no ellipses, no emojis.
- Segment 1 opens with the hook line in the channel's signature opening style. The last segment
  delivers the payoff, the CTA and the signature sign-off.
- Every factual claim (names, dates, numbers) must come from the fact sheet. Do not invent facts.

SOUND EFFECTS (sfx): environmental sounds that match the picture — wind, fire, water, metal,
footsteps, crowds far away. NEVER voices, breathing, coughing, laughing, screaming or music.

Also write openingFrame: a precise description of the very first frame (subject, setting, lighting,
lens, mood) in the channel's house style, vertical 9:16, no text, no logos, no real people's names.
It must show what the first words of the narration describe.

{{CONTEXT}}

Reply as JSON:
{"openingFrame":"",
 "segments":[{"narration":"","camera":"the one camera move","firstHalf":"what is on screen 0-${half}s","secondHalf":"what is on screen ${half}-${clip}s","featuresCharacter":true,"sfx":""}],
 "caption":"","hashtags":["#tag"],"coverText":"3-5 word cover title"}`,
    `APPROVED IDEA:\n${JSON.stringify(idea)}\n\n${factSheet(facts || [])}`,
    { spend, temperature: 0.7 }
  );

  if (!Array.isArray(script.segments) || script.segments.length === 0 || !script.openingFrame) {
    throw new Error('Script was missing segments or the opening frame');
  }
  // Exactly `count` clips: the clip count drives the video bill and the video length
  while (script.segments.length < count) {
    const last = script.segments.at(-1);
    script.segments.push({ ...last, narration: '', firstHalf: last.secondHalf, secondHalf: 'The camera slowly settles and holds on the scene.' });
  }
  script.segments = script.segments.slice(0, count).map((seg) => ({
    ...seg,
    narration: cleanNarration(seg.narration),
    seconds: clip,
  }));
  return script;
}
