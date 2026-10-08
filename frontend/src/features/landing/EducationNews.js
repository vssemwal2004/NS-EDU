'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { educationTopics } from '@/data/education-news';
import { displayNewsImage, filterEducationStories, newsDate, readSavedNews, safeNewsImage, savedNewsKey, validEducationStory } from '@/lib/education-news';
import styles from './EducationNews.module.css';

function NewsBackdrop() {
  return <div className={styles.backdrop} aria-hidden="true"><div className={styles.printGrid} /><svg viewBox="0 0 300 190" fill="none"><path d="M34 28h150v127H34zM184 50h45v105H67M51 45h91M51 55h114M51 114h40m-40 10h113m-113 10h90M108 73h55v29h-55ZM51 73h43v29H51zM212 163h58m-20-98v68m-10-55 10-13 10 13" /><path d="M242 28h31v31h-31zM250 39h14m-14 9h8M8 116h13m-7-6v13" /></svg><span className={styles.marginMark}>DISCOVER / UNDERSTAND / PLAN</span></div>;
}

function StoryCover({ story, featured = false }) {
  const [broken, setBroken] = useState(false);
  const src = displayNewsImage(story.imageUrl);
  const topic = educationTopics.find((item) => item.id === story.category);
  return <div className={`${styles.cover} ${featured ? styles.featureCover : ''}`} data-news-cover>{src && !broken ? <Image src={src} alt="" fill loading="lazy" sizes={featured ? '(max-width: 600px) 68px, (max-width: 1000px) 100px, 150px' : '(max-width: 600px) 68px, 100px'} onError={() => setBroken(true)} /> : <div className={styles.coverFallback} data-news-image-fallback><Icon name={topic?.icon || 'news'} /><span>{topic?.label || 'Education'}</span><i /></div>}</div>;
}

function Story({ story, featured, saved, onSave }) {
  const label = educationTopics.find((item) => item.id === story.category)?.label || 'Education';
  return <article className={`${styles.story} ${featured ? styles.featured : ''}`} data-news-story data-story-type={story.type}>
    <a className={styles.coverLink} href={story.url} target="_blank" rel="noopener noreferrer" aria-label={`Read ${story.title} on ${story.source} (opens in a new tab)`}><StoryCover key={story.imageUrl} story={story} featured={featured} /></a>
    <div className={styles.storyBody}><span className={styles.topicLabel}>{label}{story.type === 'article' && <span> / Article</span>}</span><h4><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}<span className="sr-only"> (opens publisher in a new tab)</span></a></h4>{featured && story.description && <p className={styles.excerpt}>{story.description}</p>}<div className={styles.metadata}><span>{story.source}</span><span aria-hidden="true">·</span><time dateTime={story.publishedAt} title={`${newsDate(story.publishedAt, true)} IST`}>{newsDate(story.publishedAt)}</time></div></div>
    <div className={styles.storyActions}><button type="button" className={styles.save} aria-pressed={saved} aria-label={`${saved ? 'Unsave' : 'Save'} ${story.title}`} onClick={() => onSave(story)}><Icon name={saved ? 'bookmarkFilled' : 'bookmark'} /></button></div>
  </article>;
}

const initialFeed = { status: 'idle', articles: [], sources: [], updatedAt: null };

export default function EducationNews() {
  const sectionRef = useRef(null);
  const requestRef = useRef(null);
  const [feed, setFeed] = useState(initialFeed);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [limit, setLimit] = useState(3);
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
      setFeed({ ...payload, articles: payload.articles.filter(validEducationStory).map((record) => ({ ...record, imageUrl: safeNewsImage(record.imageUrl) })) });
    } catch {
      if (controller.signal.reason === 'unmount') return;
      setFeed((previous) => ({ ...previous, status: previous.articles.length ? 'offline' : 'unavailable' }));
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      if (controller.signal.reason !== 'unmount') setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = false;
    const start = () => { active = true; loadFeed(); };
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { start(); observer.disconnect(); }
    }, { rootMargin: '500px' });
    observer.observe(sectionRef.current);
    const interval = window.setInterval(() => { if (active && document.visibilityState === 'visible') loadFeed(); }, 600000);
    return () => { observer.disconnect(); window.clearInterval(interval); requestRef.current?.abort('unmount'); };
  }, [loadFeed]);

  useEffect(() => {
    // Keep server/first client render identical; browser storage is optional.
    let mounted = true;
    Promise.resolve().then(() => {
      if (!mounted) return;
      try { setSaved(readSavedNews(window.localStorage)); } catch { /* Restricted browser storage. */ }
    });
    const sync = (event) => { if (event.key === savedNewsKey) { try { setSaved(readSavedNews(window.localStorage)); } catch { /* Ignore unavailable storage. */ } } };
    window.addEventListener('storage', sync);
    return () => { mounted = false; window.removeEventListener('storage', sync); };
  }, []);

  function changeView(value) { setView(value); setLimit(3); }
  function changeCategory(value) { setCategory(value); setLimit(3); }
  function toggleSave(story) {
    const removing = saved.some((record) => record.id === story.id);
    if (!removing && saved.length >= 60) { setSaveNotice('Your saved list is full. Remove a story to save another.'); return; }
    const next = removing ? saved.filter((record) => record.id !== story.id) : [story, ...saved];
    setSaved(next);
    try { window.localStorage.setItem(savedNewsKey, JSON.stringify(next)); setSaveNotice(removing ? 'Story removed from saved.' : 'Story saved on this device.'); }
    catch { setSaveNotice('Saved for this visit. Your browser could not store it for later.'); }
  }

  const eligible = filterEducationStories(view === 'saved' ? saved : feed.articles, { category, query, sort });
  const records = eligible.filter((record) => view === 'articles' ? record.type === 'article' : view === 'saved' ? true : record.type === 'news');
  const reading = eligible.filter((record) => record.type === 'article').slice(0, 3);
  const savedIds = new Set(saved.map((record) => record.id));
  const hasFeed = feed.articles.length > 0;
  const unavailable = feed.status === 'unavailable';
  const emptyTitle = view === 'saved' && !saved.length ? 'Keep a story for later.' : unavailable && view !== 'saved' ? 'We couldn’t load education updates.' : !hasFeed && view !== 'saved' ? 'No education updates available yet.' : 'No stories match this view.';
  const emptyHelp = view === 'saved' && !saved.length ? 'Tap the bookmark on any story to build your reading list.' : unavailable && view !== 'saved' ? 'Please try refreshing in a moment.' : !hasFeed && view !== 'saved' ? 'Check back soon or refresh for the latest available stories.' : 'Try another topic or search phrase.';
  const heading = view === 'articles' ? 'Read & understand' : view === 'saved' ? 'Saved on this device' : 'The latest in education';

  return <section ref={sectionRef} id="education-news" className={styles.section} aria-labelledby="education-news-title" data-news-section>
    <NewsBackdrop />
    <div className={`container ${styles.container}`}>
      <header className={styles.heading}>
        <div className={styles.headingCopy}><p className={styles.eyebrow}><span /><Icon name="news" />THE EDUCATION DESK</p><h2 id="education-news-title">Education, <span>in focus.</span></h2><p className={styles.description}>The latest updates and useful reads for your next step.</p></div>
        <div className={styles.feedState}><span className={styles.status} data-feed-status={feed.status}><span aria-hidden="true" />{loading ? 'Checking for updates…' : feed.status === 'idle' ? 'Education news & articles' : feed.status === 'unavailable' ? 'Updates temporarily unavailable' : feed.status === 'offline' ? 'Showing earlier updates' : feed.status === 'partial' ? 'Some sources delayed' : 'Latest available updates'}</span>{feed.updatedAt && <p>Checked <time dateTime={feed.updatedAt}>{newsDate(feed.updatedAt, true)} IST</time></p>}<button type="button" className={styles.refresh} onClick={loadFeed} disabled={loading}><Icon name="refresh" /><span>{loading ? 'Refreshing' : 'Refresh updates'}</span></button></div>
      </header>
      <div className={styles.toolbar}>
        <nav className={styles.views} aria-label="Education content">{[['all', 'Overview'], ['news', 'News'], ['articles', 'Articles'], ['saved', 'Saved']].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => changeView(id)}>{id === 'saved' && <Icon name="bookmark" />}{label}{id === 'saved' && saved.length > 0 && <span>{saved.length}</span>}</button>)}</nav>
        <div className={styles.searchAndSort}><label className={styles.search}><Icon name="search" /><span className="sr-only">Search education updates</span><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(3); }} maxLength={100} placeholder="Search any education topic" /></label><label className={styles.sort}><span className="sr-only">Sort education updates</span><select value={sort} onChange={(event) => { setSort(event.target.value); setLimit(3); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><Icon name="chevron" /></label></div>
      </div>
      <div className={styles.topics}><nav aria-label="Education topics">{educationTopics.map((topic) => <button key={topic.id} type="button" aria-pressed={category === topic.id} onClick={() => changeCategory(topic.id)}>{topic.label}</button>)}</nav><span className={styles.topicHint} aria-hidden="true"><Icon name="arrow" /></span></div>
      <div className={styles.contentGrid}>
        <div className={styles.newsColumn}>
          <div className={styles.columnHeading}><h3>{heading}</h3>{(hasFeed || view === 'saved') && <span>{records.length} {records.length === 1 ? 'story' : 'stories'}</span>}</div>
          {view === 'saved' && <p className={styles.savedHelp}>Your reading list stays in this browser.</p>}
          {!records.length && (feed.status === 'idle' || loading) && view !== 'saved' ? <div className={styles.skeleton} role="status" aria-label="Loading education updates">{[1, 2, 3].map((id) => <div key={id}><i /><span><b /><b /><b /></span></div>)}</div> : records.length ? <div className={styles.stories}>{records.slice(0, limit).map((record, index) => <Story key={record.id} story={record} featured={index === 0} saved={savedIds.has(record.id)} onSave={toggleSave} />)}</div> : <div className={styles.empty}><Icon name={view === 'saved' ? 'bookmark' : 'news'} /><h4>{emptyTitle}</h4><p>{emptyHelp}</p>{(query || category !== 'all') && <button className="button button--outline" type="button" onClick={() => { setQuery(''); changeCategory('all'); }}>Clear filters</button>}</div>}
          {records.length > limit && <button className={styles.more} type="button" onClick={() => setLimit((value) => value + 6)}>Show more {view === 'articles' ? 'articles' : view === 'saved' ? 'saved stories' : 'updates'}<Icon name="arrow" /></button>}
        </div>
        <aside className={styles.readingColumn} aria-label={view === 'all' ? 'Education articles' : 'Explore education topics'}>
          {view === 'all' ? <><div className={styles.columnHeading}><h3>Read & understand</h3><button type="button" className={styles.viewArticles} onClick={() => changeView('articles')}>All articles<Icon name="arrow" /></button></div>{reading.length ? <div className={styles.reading}>{reading.map((record) => <Story key={record.id} story={record} saved={savedIds.has(record.id)} onSave={toggleSave} />)}</div> : <p className={styles.readingEmpty}>{loading || feed.status === 'idle' ? 'Finding useful reads…' : 'No articles for this topic yet. Try All education.'}</p>}</> : <><div className={styles.columnHeading}><h3>Across education</h3></div><div className={styles.topicDirectory}>{educationTopics.slice(1).map((topic) => <button key={topic.id} type="button" aria-pressed={category === topic.id} onClick={() => changeCategory(topic.id)}><span><Icon name={topic.icon} />{topic.label}</span><Icon name="arrow" /></button>)}</div></>}
          <div className={styles.readingNote}><Icon name="book" /><div><strong>A little clarity goes a long way.</strong><p>Explore the story behind the headline. Save what matters to you.</p></div></div>
        </aside>
      </div>
      <footer className={styles.footer}><p><Icon name="external" />Stories open on the original publisher’s website.</p>{feed.sources?.some((source) => source.state !== 'fresh') && <p>Some publishers couldn’t refresh. Available stories remain dated.</p>}<span className="sr-only" role="status">{saveNotice}</span>{saveNotice && <p className={styles.saveNotice} aria-hidden="true">{saveNotice}</p>}</footer>
    </div>
  </section>;
}
