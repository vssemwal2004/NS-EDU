'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { displayNewsImage, filterEducationStories, isThumbnailOnly, newsDate, readSavedNews, safeNewsImage, savedNewsKey, validEducationStory } from '@/lib/education-news';
import { useContent } from '@/providers/ContentProvider';
import styles from './EducationNews.module.css';

// The homepage teaser of the Education Desk: one lead story, the latest few and three explainers.
// Searching, sorting and the full archive live on /news; this section only has to be worth a glance.
// Topics and the cover-image policy are admin-edited content (`news`); stories come from /api/education-news.
const LATEST = 4;
const READS = 3;

// The publisher's photo when the policy allows it, otherwise a plate in the topic's own colours —
// never an empty box, so a story without a picture still reads as deliberate.
function Cover({ story, config, sizes, variant }) {
  const [broken, setBroken] = useState(false);
  const src = displayNewsImage(story.imageUrl, config);
  const topic = config.topics.find((item) => item.id === story.category);
  return <div className={styles.cover} data-variant={variant} data-news-cover>
    {src && !broken ? <Image src={src} alt="" fill sizes={sizes} onError={() => setBroken(true)} />
      : <div className={styles.plate} data-topic={story.category} data-news-image-fallback><Icon name={topic?.icon || 'news'} /><span>{topic?.label || 'Education'}</span></div>}
  </div>;
}

function Meta({ story, withTime = false }) {
  return <p className={styles.meta}><span>{story.source}</span><span aria-hidden="true">·</span><time dateTime={story.publishedAt} title={`${newsDate(story.publishedAt, true)} IST`}>{newsDate(story.publishedAt, withTime)}</time></p>;
}

function Kicker({ story, config }) {
  return <p className={styles.kicker}>{config.topics.find((item) => item.id === story.category)?.label || 'Education'}{story.type === 'article' && <span> · Explainer</span>}</p>;
}

function Headline({ story, as: Tag = 'h3', className }) {
  return <Tag className={className}><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}<span className="sr-only"> (opens publisher in a new tab)</span></a></Tag>;
}

function Save({ story, saved, onSave }) {
  return <button type="button" className={styles.save} aria-pressed={saved} aria-label={`${saved ? 'Unsave' : 'Save'} ${story.title}`} onClick={() => onSave(story)}><Icon name={saved ? 'bookmarkFilled' : 'bookmark'} /></button>;
}

// The cover links to the story too, but only once for keyboard and screen-reader users: the headline.
const CoverLink = ({ story, children }) => <a className={styles.coverLink} href={story.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">{children}</a>;

function LeadStory({ story, saved, onSave, config }) {
  return <article className={styles.lead} data-news-story data-story-type={story.type}>
    <CoverLink story={story}><Cover story={story} config={config} variant="lead" sizes="(max-width: 860px) 100vw, 640px" /></CoverLink>
    <div className={styles.leadBody}>
      <Kicker story={story} config={config} />
      <Headline story={story} className={styles.leadTitle} />
      {story.description && <p className={styles.dek}>{story.description}</p>}
      <div className={styles.foot}><Meta story={story} withTime /><Save story={story} saved={saved} onSave={onSave} /></div>
    </div>
  </article>;
}

function ListStory({ story, saved, onSave, config }) {
  return <article className={styles.item} data-news-story data-story-type={story.type}>
    <CoverLink story={story}><Cover story={story} config={config} variant="thumb" sizes="(max-width: 600px) 96px, 128px" /></CoverLink>
    <div className={styles.itemBody}>
      <Kicker story={story} config={config} />
      <Headline story={story} className={styles.itemTitle} />
      <div className={styles.foot}><Meta story={story} /><Save story={story} saved={saved} onSave={onSave} /></div>
    </div>
  </article>;
}

function ReadCard({ story, saved, onSave, config }) {
  return <article className={styles.read} data-news-story data-story-type={story.type}>
    <CoverLink story={story}><Cover story={story} config={config} variant="card" sizes="(max-width: 600px) 78vw, 340px" /></CoverLink>
    <Kicker story={story} config={config} />
    <Headline story={story} className={styles.readTitle} />
    <div className={styles.foot}><Meta story={story} /><Save story={story} saved={saved} onSave={onSave} /></div>
  </article>;
}

const initialFeed = { status: 'idle', articles: [], sources: [], updatedAt: null };

export default function EducationNews() {
  const config = useContent('news');
  if (!config) return <section id="education-news" className={styles.section} aria-labelledby="education-news-title" data-news-section>
    <div className={`container ${styles.container}`}><header className={styles.head}><div><h2 id="education-news-title" className={styles.title}>Education news</h2><p className={styles.lede} role="status">Education updates are temporarily unavailable. Please refresh in a moment.</p></div></header></div>
  </section>;
  return <NewsTeaser config={config} />;
}

function NewsTeaser({ config }) {
  const sectionRef = useRef(null);
  const requestRef = useRef(null);
  const [feed, setFeed] = useState(initialFeed);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('all');
  const [saved, setSaved] = useState([]);
  const [saveNotice, setSaveNotice] = useState('');

  const loadFeed = useCallback(async () => {
    if (requestRef.current) return;
    const controller = new window.AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort('timeout'), 12000);
    setLoading(true);
    try {
      const response = await window.fetch('/api/education-news', { signal: controller.signal, cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.articles) || !['ready', 'partial'].includes(payload.status)) throw new Error('News unavailable');
      setFeed({ ...payload, articles: payload.articles.filter((record) => validEducationStory(record, config)).map((record) => ({ ...record, imageUrl: safeNewsImage(record.imageUrl) })) });
    } catch {
      if (controller.signal.reason === 'unmount') return;
      setFeed((previous) => ({ ...previous, status: previous.articles.length ? 'offline' : 'unavailable' }));
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      if (controller.signal.reason !== 'unmount') setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    let active = false;
    const start = () => { active = true; loadFeed(); };
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer.disconnect(); }
    }, { rootMargin: '1200px 0px' }); // ~1.5 screens early, so stories usually replace the skeleton before it is seen
    observer.observe(sectionRef.current);
    const interval = window.setInterval(() => { if (active && document.visibilityState === 'visible') loadFeed(); }, 600000);
    return () => { observer.disconnect(); window.clearInterval(interval); requestRef.current?.abort('unmount'); };
  }, [loadFeed]);

  useEffect(() => {
    // Keep server/first client render identical; browser storage is optional.
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      try { setSaved(readSavedNews(window.localStorage, config)); } catch { /* Restricted browser storage. */ }
    });
    const sync = (event) => { if (event.key === savedNewsKey) { try { setSaved(readSavedNews(window.localStorage, config)); } catch { /* Ignore unavailable storage. */ } } };
    window.addEventListener('storage', sync);
    return () => { mounted = false; window.removeEventListener('storage', sync); };
  }, [config]);

  function toggleSave(story) {
    const removing = saved.some((record) => record.id === story.id);
    if (!removing && saved.length >= 60) { setSaveNotice('Your saved list is full. Remove a story to save another.'); return; }
    const next = removing ? saved.filter((record) => record.id !== story.id) : [story, ...saved];
    setSaved(next);
    try { window.localStorage.setItem(savedNewsKey, JSON.stringify(next)); setSaveNotice(removing ? 'Story removed from saved.' : 'Story saved on this device.'); }
    catch { setSaveNotice('Saved for this visit. Your browser could not store it for later.'); }
  }

  const stories = filterEducationStories(feed.articles, { category });
  const news = stories.filter((record) => record.type === 'news');
  // The lead needs a full-size picture above all — a thumbnail stretched across the lead slot reads
  // as a broken image. Among those, one with a summary wins; then any picture; then the newest story.
  const pictured = (record) => displayNewsImage(record.imageUrl, config);
  const fullSize = news.slice(0, 10).filter((record) => pictured(record) && !isThumbnailOnly(record.imageUrl));
  const lead = fullSize.find((record) => record.description) || fullSize[0]
    || news.slice(0, 6).find((record) => pictured(record)) || news[0];
  const latest = news.filter((record) => record !== lead).slice(0, LATEST);
  const reads = stories.filter((record) => record.type === 'article').slice(0, READS);
  const savedIds = new Set(saved.map((record) => record.id));
  const props = (story) => ({ story, config, saved: savedIds.has(story.id), onSave: toggleSave });
  const waiting = !feed.articles.length && (feed.status === 'idle' || loading);

  let body;
  if (waiting) body = <div className={styles.skeleton} role="status" aria-label="Loading education updates"><span className="lux-skeleton" /><span className={styles.skeletonList}>{[1, 2, 3, 4].map((id) => <span key={id} className="lux-skeleton" />)}</span></div>;
  else if (!feed.articles.length) body = <div className={styles.empty}><Icon name="news" /><h3>We couldn’t load education updates.</h3><p>Please try refreshing in a moment.</p><button type="button" className="lux-button lux-button--outline" onClick={loadFeed} disabled={loading}><Icon name="refresh" />Try again</button></div>;
  else if (!lead) body = <div className={styles.empty}><Icon name="news" /><h3>No stories in this topic yet.</h3><p>New stories arrive through the day.</p><button type="button" className="lux-button lux-button--outline" onClick={() => setCategory('all')}>Show all topics</button></div>;
  else body = <>
    <div className={styles.front}>
      <LeadStory {...props(lead)} />
      {latest.length > 0 && <div className={styles.latest}>
        <h3 className={styles.columnTitle}>Latest</h3>
        {latest.map((story) => <ListStory key={story.id} {...props(story)} />)}
      </div>}
    </div>
    {reads.length > 0 && <div className={styles.reads}>
      <h3 className={styles.columnTitle}>Read &amp; understand</h3>
      <div className={styles.readsTrack}>{reads.map((story) => <ReadCard key={story.id} {...props(story)} />)}</div>
    </div>}
  </>;

  const status = loading ? 'Checking for updates…' : feed.status === 'unavailable' ? 'Updates unavailable' : feed.status === 'offline' ? 'Showing earlier updates' : feed.status === 'partial' ? 'Some sources delayed' : feed.updatedAt ? `Updated ${newsDate(feed.updatedAt, true)} IST` : 'Education news & explainers';

  return <section ref={sectionRef} id="education-news" className={styles.section} aria-labelledby="education-news-title" data-news-section>
    <div className={`container ${styles.container}`}>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}><Icon name="news" />The Education Desk</p>
          <h2 id="education-news-title" className={styles.title}>Education, <em>in focus.</em></h2>
        </div>
        <p className={styles.status} data-feed-status={feed.status}>
          <i aria-hidden="true" /><span>{status}</span>
          <button type="button" className={styles.refresh} onClick={loadFeed} disabled={loading} aria-label="Refresh education updates"><Icon name="refresh" /></button>
        </p>
      </header>
      <nav className={styles.topics} aria-label="Education topics">
        {config.topics.map((topic) => <button key={topic.id} type="button" aria-pressed={category === topic.id} onClick={() => setCategory(topic.id)}>{topic.id === 'all' ? 'All' : topic.label}</button>)}
      </nav>
      {body}
      <footer className={styles.footer}><p><Icon name="external" />Every story opens on the original publisher’s website.</p>{feed.sources?.some((source) => source.state !== 'fresh') && <p>Some publishers couldn’t refresh. Available stories remain dated.</p>}<span className="sr-only" role="status">{saveNotice}</span>{saveNotice && <p className={styles.notice} aria-hidden="true">{saveNotice}</p>}</footer>
    </div>
  </section>;
}
