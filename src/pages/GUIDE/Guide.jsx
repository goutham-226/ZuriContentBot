import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../../components/Footer';
import './Guide.css';

const STEPS = [
  {
    title: 'Pick a plan and create a Zuri',
    body: (
      <>
        Go to <Link to="/bots/new">Create a Zuri</Link>, choose a niche, and give it a name (or keep Zuri). Pick a niche you can post in
        every day for months. Horror stories, history mysteries, finance tips and psychology facts are good starts.
        Browse the <Link to="/niches">niche library</Link> if you're unsure.
      </>
    ),
  },
  {
    title: 'Let it brand the channel',
    body: 'Right after you create it, the bot designs a channel identity: a recurring character (with a reference sheet), a house visual style, a caption color, a signature opening and sign-off. Every video reuses it, so viewers recognize your channel mid-scroll. Not right? Redesign it with a sentence of direction.',
  },
  {
    title: 'Ask for a video',
    body: 'Open the bot and press "Research & pitch ideas". Leave the topic blank to let the bot find the trend, or steer it with a few words. It scans Google Trends, news, YouTube searches and niche blogs, reads the best articles and Wikipedia, builds a fact sheet with sources, then pitches 3 ideas scored by a critic pass. You need enough credits for the length you pick before it starts.',
  },
  {
    title: 'Approve the one you like',
    body: 'Read the hooks and scores. Approve the bot\'s pick or any other, and add notes if you want ("end on a cliffhanger"). Not feeling any? Tell it what to change and it pitches again. Nothing is rendered or charged until you approve.',
  },
  {
    title: 'Let it produce',
    body: 'The bot writes the script, designs the opening frame, records the ElevenLabs voice-over, then films the video as one continuous shot: 15-second segments rendered in order, each continuing from the last. It mixes in sound effects and captions and delivers one 9:16 MP4. A 3-minute video takes a while, so you can close the tab.',
  },
  {
    title: 'Upscale, post, repeat',
    body: 'Clips are generated at 480p to keep each video cheap. Download the MP4, run it through an upscaler (CapCut is free; Topaz Video AI and DaVinci Resolve are great), then post with the caption and hashtags to TikTok, Reels and Shorts. Ask for the next one — the bot remembers past videos and won\'t repeat a topic.',
  },
];

const PLAYBOOK = [
  ['Post daily, at the same time', 'Algorithms reward consistency. One bot making one video a day beats five random uploads a week.'],
  ['Approve on the hook, not the topic', 'The first 2 seconds decide whether anyone watches. Pick the idea with the strongest opening line, even if another topic sounds bigger.'],
  ['Run one bot per channel', 'Keep each bot to one niche and one look. Viewers follow a feeling, not a topic. Use more bots for more channels.'],
  ['Turn winners into series', 'When a video takes off, steer the next request at the same topic ("part 2: what they found inside"). Series get bingeing viewers to follow.'],
  ['Lean on the character', 'Approve ideas that put your bot\'s recurring character front and center. A familiar face is what makes viewers recognize your channel mid-scroll.'],
  ['Test lengths', 'Start at 60 seconds. Once a series is working, try 90 seconds to 2 minutes — longer videos that hold viewers earn more on most platforms.'],
  ['Read the comments, feed the bot', 'Paste what your audience asks for into "Steer it". The best topic research is your own comment section.'],
  ['Spread across platforms', 'Post every video to TikTok, Instagram Reels and YouTube Shorts. Same work, three chances to go viral.'],
];

export default function Guide() {
  return (
    <>
      <div className="page container guide">
        <div className="section-head">
          <span className="eyebrow">Guide</span>
          <h1 className="section-title">Run a content machine <span className="gradient-text">that never runs dry</span></h1>
          <p className="section-description">Six steps from zero to a bot that produces a researched, voiced, captioned reel every time you ask.</p>
        </div>

        <ol className="guide-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="guide-step">
              <span className="guide-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="guide-playbook">
          <h2 className="section-title small-title">The playbook for viral content</h2>
          <p className="muted">The bot handles research and production. These habits turn its output into a growing channel.</p>
          <div className="grid-2">
            {PLAYBOOK.map(([title, body]) => (
              <div key={title} className="card">
                <h3 className="card-title">{title}</h3>
                <p className="muted small">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="guide-cta">
          <Link to="/bots/new" className="btn btn-primary">Build your first bot →</Link>
          <Link to="/pricing" className="btn btn-ghost">See pricing</Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
