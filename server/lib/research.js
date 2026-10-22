// Live research for a niche. Two layers:
//  1. Signals — what's viral right now: Google News, Google Trends,
//     YouTube search suggestions, Hacker News, the niche's blog feeds (Reddit is
//     available but switched off by default).
//  2. Reading — full text of the most promising articles + Wikipedia extracts
//     + "on this day" history, so the script can be built from real, sourced facts.
// Every source is best-effort: a blocked or slow source contributes nothing.

const UA = 'Mozilla/5.0 (compatible; CreatorFriendlyBot/1.0; +https://creatorfriendly.ai)';
const TIMEOUT_MS = 9000;

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z0-9#]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m);
const stripTags = (s = '') => decode(decode(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

// Minimal RSS + Atom parser
function parseFeed(xml, source) {
  const items = [...xml.matchAll(/<(item|entry)[\s>](.*?)<\/\1>/gs)].map(([, , body]) => {
    const tag = (name) => body.match(new RegExp(`<${name}[^>]*>(.*?)</${name}>`, 's'))?.[1] || '';
    const link = tag('link') || body.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    return {
      source,
      title: stripTags(tag('title')),
      url: decode(link).trim(),
      summary: stripTags(tag('description') || tag('summary') || tag('content')).slice(0, 300),
      date: tag('pubDate') || tag('updated') || tag('published'),
    };
  });
  return items.filter((i) => i.title);
}

// ---------- Reddit (off unless REDDIT_RESEARCH=on; app-only OAuth if keys are set, else RSS) ----------
const REDDIT_ON = process.env.REDDIT_RESEARCH === 'on';

let redditToken = null;
async function redditAuth() {
  const { REDDIT_CLIENT_ID: id, REDDIT_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) return null;
  if (redditToken && redditToken.expires > Date.now()) return redditToken.value;
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  redditToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return redditToken.value;
}

async function redditTop(subreddit) {
  const token = await redditAuth().catch(() => null);
  if (token) {
    const data = JSON.parse(await fetchText(`https://oauth.reddit.com/r/${subreddit}/top?t=week&limit=12`, { Authorization: `Bearer ${token}` }));
    return data.data.children.map(({ data: p }) => ({
      source: `r/${subreddit}`,
      title: p.title,
      url: `https://www.reddit.com${p.permalink}`,
      score: p.score,
      comments: p.num_comments,
      summary: (p.selftext || '').replace(/\s+/g, ' ').slice(0, 400),
    }));
  }
  // Unauthenticated RSS is heavily rate-limited, so callers run these one at a time
  return parseFeed(await fetchText(`https://www.reddit.com/r/${subreddit}/top/.rss?t=week`), `r/${subreddit}`)
    .slice(0, 12)
    .map((p) => ({ ...p, summary: '' }));
}

async function redditSequential(subreddits) {
  const out = [];
  for (const sub of subreddits) {
    try {
      out.push(...(await redditTop(sub)));
    } catch {
      /* rate-limited or blocked — skip */
    }
  }
  return out;
}

// ---------- News, trends, search ----------
const googleNews = async (q) =>
  parseFeed(await fetchText(`https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:7d`)}&hl=en-US&gl=US&ceid=US:en`), 'news').slice(0, 12);

async function googleTrends() {
  const xml = await fetchText('https://trends.google.com/trending/rss?geo=US');
  return [...xml.matchAll(/<item>(.*?)<\/item>/gs)].slice(0, 20).map(([, body]) => ({
    source: 'google trends',
    title: stripTags(body.match(/<title>(.*?)<\/title>/s)?.[1]),
    traffic: stripTags(body.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/s)?.[1]),
  }));
}

async function youtubeSuggestions(q) {
  const data = JSON.parse(await fetchText(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`));
  return (data[1] || []).map((title) => ({ source: 'youtube search', title }));
}

async function hackerNews() {
  const ids = JSON.parse(await fetchText('https://hacker-news.firebaseio.com/v0/topstories.json')).slice(0, 12);
  const items = await Promise.all(ids.map((id) => fetchText(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(JSON.parse).catch(() => null)));
  return items.filter((i) => i?.title).map((i) => ({ source: 'hacker news', title: i.title, url: i.url || `https://news.ycombinator.com/item?id=${i.id}`, score: i.score }));
}

async function blogFeed(url) {
  const host = new URL(url).hostname.replace(/^(www|feeds)\./, '');
  return parseFeed(await fetchText(url), host).slice(0, 8);
}

// Picks n distinct random items
const sample = (list, n) => [...list].sort(() => Math.random() - 0.5).slice(0, n);

// ---------- Facts: Wikipedia + on this day ----------
// Pages that are never good story material: index pages, and entertainment or
// institution pages that keyword search drags in
const WIKI_JUNK_TITLE = /^(List of|Lists of|Index of|Outline of|Timeline of)|\((TV series|film|video game|album|song|novel|band|TV program|[^)]*season[^)]*|[^)]*episode[^)]*)\)|disambiguation/i;
const WIKI_JUNK_TEXT = /^[^.]{0,160}\b(is an? [^.]{0,40}(actress|actor|singer|rapper|comedian|television personality|drag queen|YouTuber|influencer)|is an? [^.]{0,60}(television series|film|reality (competition|show)|album|video game|sitcom|college|university|school)\b)/i;

// Relevance-sorted search, then a random pick from the top matches so repeat runs
// on the same sub-topic still read different pages
async function wikipedia(query, pick = 4) {
  const params = new URLSearchParams({
    action: 'query', generator: 'search', gsrsearch: query, gsrlimit: '12', prop: 'extracts|info', inprop: 'url',
    exintro: '1', explaintext: '1', exchars: '1500', exlimit: 'max', format: 'json', origin: '*',
  });
  const data = JSON.parse(await fetchText(`https://en.wikipedia.org/w/api.php?${params}`));
  const pages = Object.values(data.query?.pages || {})
    .filter((p) => p.extract && p.extract.length > 200 && !WIKI_JUNK_TITLE.test(p.title) && !WIKI_JUNK_TEXT.test(p.extract))
    .sort((a, b) => a.index - b.index)
    .slice(0, 8);
  return sample(pages, pick).map((p) => ({ source: 'wikipedia', title: p.title, url: p.fullurl, text: p.extract }));
}

async function onThisDay(date = new Date()) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const data = JSON.parse(await fetchText(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`));
  return (data.selected || []).slice(0, 12).map((e) => ({
    source: 'on this day',
    title: `${e.year}: ${e.text}`,
    url: e.pages?.[0]?.content_urls?.desktop?.page,
  }));
}

// Pulls readable paragraph text out of an article page
async function readArticle(item) {
  const html = await fetchText(item.url);
  const body = html
    .replace(/<(script|style|noscript|svg|header|footer|nav|aside|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const paragraphs = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(([, p]) => stripTags(p)).filter((p) => p.length > 70);
  const text = paragraphs.join('\n').slice(0, 3000);
  if (text.length < 300) throw new Error('No readable text');
  return { source: item.source, title: item.title, url: item.url, text };
}

const words = (s) => (s || '').toLowerCase().match(/[a-z]{4,}/g) || [];

// Article picks: the most niche-relevant first, but at most `perSite` from any one
// site, so a single blog's latest posts can't dominate the fact sheet
function pickArticles(items, focus, { total = 8, perSite = 2 } = {}) {
  const seen = new Set();
  const ranked = items
    .filter((i) => !seen.has(i.url) && seen.add(i.url)) // the same story often sits in several feeds
    // relevance first; a random tie-break so runs on the same day read different stories
    .map((i) => ({ i, rank: words(`${i.title} ${i.summary}`).filter((w) => focus.has(w)).length * 10 + Math.random() * 6 }))
    .sort((x, y) => y.rank - x.rank);
  const perHost = {};
  const picked = [];
  for (const { i } of ranked) {
    const host = new URL(i.url).hostname;
    if ((perHost[host] = (perHost[host] || 0) + 1) > perSite) continue;
    picked.push(i);
    if (picked.length === total) break;
  }
  return picked;
}

export async function gatherSignals(niche, topicHint) {
  const seed = topicHint || niche.newsQuery;
  const isTech = niche.id === 'ai-tech-news' || niche.category === 'Tech';
  const settle = (p) => p.catch(() => []);
  // Without a steer, research two random sub-topics so runs don't all land on
  // whatever the blogs happened to publish this week
  const focusTopics = topicHint ? [topicHint] : sample(niche.subtopics || [niche.newsQuery], 2);

  const [reddit, news, trends, searches, hn, blogs, wikiSets, history] = await Promise.all([
    REDDIT_ON ? redditSequential(niche.subreddits.slice(0, 3)) : [],
    settle(googleNews(seed)),
    settle(googleTrends()),
    settle(youtubeSuggestions(topicHint || niche.name)),
    isTech ? settle(hackerNews()) : [],
    Promise.all((niche.feeds || []).map((f) => settle(blogFeed(f)))).then((r) => r.flat()),
    Promise.all(focusTopics.map((t) => settle(wikipedia(t, topicHint ? 4 : 2)))),
    settle(onThisDay()),
  ]);
  // Two pages per sub-topic keeps Wikipedia from being all one subject
  const wiki = wikiSets.flat();

  // Read the most relevant blog/HN articles in full, spread across sites
  const focus = new Set(words(`${focusTopics.join(' ')} ${niche.newsQuery}`));
  const candidates = pickArticles(
    [...blogs, ...hn.filter((i) => !i.url.includes('ycombinator'))].filter((i) => i.url?.startsWith('http')),
    focus,
    { total: 10, perSite: 2 }
  );
  const articles = (await Promise.allSettled(candidates.map(readArticle)))
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value)
    .slice(0, 6);

  const groups = { reddit, news, trends, searches, hn, blogs, wiki, history, articles };
  return {
    fetchedAt: new Date().toISOString(),
    focusTopics,
    redditMode: !REDDIT_ON ? 'off' : process.env.REDDIT_CLIENT_ID ? 'oauth' : 'rss',
    counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
    ...groups,
  };
}

// Numbered source list so the model can cite facts as [S3]
export function sourceIndex(signals) {
  const list = [];
  const add = (item) => item.url && list.push({ id: `S${list.length + 1}`, title: item.title, url: item.url, source: item.source });
  [...signals.articles, ...signals.wiki, ...signals.history, ...signals.reddit.slice(0, 10), ...signals.news.slice(0, 8), ...signals.blogs.slice(0, 10)].forEach(add);
  return list;
}

// Compact text form of everything gathered, for the LLM prompt
export function signalsDigest(signals, sources = sourceIndex(signals)) {
  const sid = (url) => sources.find((s) => s.url === url)?.id;
  const cite = (item) => (sid(item.url) ? ` [${sid(item.url)}]` : '');
  const lines = [];
  const section = (title, items, fmt) => {
    if (!items.length) return;
    lines.push('', `${title}:`);
    for (const item of items) lines.push(`- ${fmt(item)}`);
  };
  section('TOP REDDIT POSTS THIS WEEK', signals.reddit.slice(0, 20), (p) => `[${p.source}] ${p.title}${p.score ? ` (${p.score} upvotes, ${p.comments} comments)` : ''}${p.summary ? ` — ${p.summary}` : ''}${cite(p)}`);
  section('NEWS (last 7 days)', signals.news, (n) => `${n.title}${cite(n)}`);
  section('GOOGLE TRENDS — what the US is searching today', signals.trends, (t) => `${t.title}${t.traffic ? ` (${t.traffic} searches)` : ''}`);
  section('YOUTUBE SEARCH SUGGESTIONS', signals.searches, (s) => s.title);
  section('HACKER NEWS FRONT PAGE', signals.hn, (h) => `${h.title} (${h.score} pts)`);
  section('NEW ON NICHE BLOGS', signals.blogs.slice(0, 16), (b) => `[${b.source}] ${b.title}${b.summary ? ` — ${b.summary.slice(0, 160)}` : ''}${cite(b)}`);
  section('ON THIS DAY IN HISTORY', signals.history, (h) => `${h.title}${cite(h)}`);
  return lines.join('\n').trim() || '(No live signals reachable — rely on the niche playbook and evergreen angles.)';
}

// Full-text reading material for the fact-extraction pass
export function readingDigest(signals, sources = sourceIndex(signals)) {
  const sid = (url) => sources.find((s) => s.url === url)?.id || '?';
  return [...signals.articles, ...signals.wiki]
    .map((a) => `[${sid(a.url)}] ${a.title} (${a.source})\n${a.text}`)
    .join('\n\n---\n\n');
}
