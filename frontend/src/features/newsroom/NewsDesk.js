'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { displayNewsImage, filterEducationStories, newsDate, readSavedNews, SAVED_NEWS_LIMIT, savedNewsKey, usableEducationFeed } from '@/lib/education-news';
import styles from './NewsDesk.module.css';

const PAGE = 12;
const emptyFeed = { status: 'idle', articles: [], sources: [], updatedAt: null };
const statusText = (feed, loading) => loading ? 'Checking for updates…'
  : feed.status === 'idle' ? 'Loading the latest updates'
    : feed.status === 'unavailable' ? 'Updates temporarily unavailable'
      : feed.status === 'offline' ? 'Showing earlier updates'
        : feed.status === 'partial' ? 'Some publishers delayed' : 'Latest available updates';

// The /news newspaper. Stories come from /api/education-news (first paint from the server);
// topics and the cover-image policy from the admin-edited `news` content entry.
export default function NewsDesk({ config, initialFeed, today }) {
  const [feed, setFeed] = useState(initialFeed || emptyFeed);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState('all');
  const [showSaved, setShowSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [saved, setSaved] = useState([]);
  const [notice, setNotice] = useState('');
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const response = await window.fetch('/api/education-news', { cache: 'no-store', signal: AbortSignal.timeout(12000) });
      const next = usableEducationFeed(await response.json(), config);
      if (!next) throw new Error('News unavailable');
      setFeed(next);
    } catch {
      setFeed((previous) => ({ ...previous, status: previous.articles.length ? 'offline' : 'unavailable' }));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    if (initialFeed) return undefined;
    const timer = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timer);
  }, [initialFeed, refresh]);

  useEffect(() => {
    // Saved stories live in this browser only; read after mount so server and client markup match.
    const read = () => { try { setSaved(readSavedNews(window.localStorage, config)); } catch { /* storage blocked */ } };
    const timer = window.setTimeout(read, 0);
    const sync = (event) => { if (event.key === savedNewsKey) read(); };
    window.addEventListener('storage', sync);
    return () => { window.clearTimeout(timer); window.removeEventListener('storage', sync); };
  }, [config]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function toggleSave(story) {
    const removing = saved.some((record) => record.id === story.id);
    if (!removing && saved.length >= SAVED_NEWS_LIMIT) { setNotice('Your saved list is full. Remove a story to save another.'); return; }
    const next = removing ? saved.filter((record) => record.id !== story.id) : [story, ...saved];
    setSaved(next);
    try { window.localStorage.setItem(savedNewsKey, JSON.stringify(next)); setNotice(removing ? 'Story removed from saved.' : 'Story saved on this device.'); }
    catch { setNotice('Saved for this visit. Your browser could not store it for later.'); }
  }
  const choose = (patch) => { setLimit(PAGE); if ('topic' in patch) setTopic(patch.topic); if ('saved' in patch) setShowSaved(patch.saved); };
  const clear = () => { setQuery(''); choose({ topic: 'all' }); };

  const topics = config.topics;
  const topicOf = useCallback((id) => topics.find((item) => item.id === id), [topics]);
  const counts = useMemo(() => feed.articles.reduce((map, record) => map.set(record.category, (map.get(record.category) || 0) + 1), new Map()), [feed.articles]);
  const records = filterEducationStories(showSaved ? saved : feed.articles, { category: topic, query });
  const savedIds = new Set(saved.map((record) => record.id));
  const news = records.filter((record) => record.type === 'news');
  const reads = records.filter((record) => record.type === 'article');
  const lead = news.slice(0, 3).find((record) => record.description) || news[0];
  const rest = news.filter((record) => record !== lead);
  const brief = rest.slice(0, 5);
  const columns = rest.slice(5);
  const waiting = !feed.articles.length && (feed.status === 'idle' || loading);
  const storyProps = { config, topicOf, savedIds, onSave: toggleSave };

  let body;
  if (showSaved) body = records.length
    ? <section className={styles.block} aria-labelledby="saved-title">
      <header className={styles.blockHead}><h2 id="saved-title">Saved on this device</h2><span>{records.length} {records.length === 1 ? 'story' : 'stories'}</span></header>
      <p className={styles.blockNote}>Your reading list stays in this browser. Nothing is sent to Gyaan Vidhya.</p>
      <div className={styles.columnsClip}><div className={styles.columns}>{records.map((story) => <ColumnStory key={story.id} story={story} {...storyProps} />)}</div></div>
    </section>
    : <EmptyState icon="bookmark" title={saved.length ? 'No saved stories match this view.' : 'Keep a story for later.'}
      text={saved.length ? 'Try another topic or search phrase.' : 'Tap the bookmark on any story to build a reading list on this device.'}
      action={saved.length ? <button className="lux-button lux-button--outline" type="button" onClick={clear}>Clear filters</button> : <button className="lux-button lux-button--outline" type="button" onClick={() => choose({ saved: false })}>Back to the latest</button>} />;
  else if (waiting) body = <div className={styles.loading} role="status" aria-label="Loading education updates"><span className={`lux-skeleton ${styles.skLead}`} /><span className={styles.skLines}>{[1, 2, 3, 4].map((id) => <span key={id} className="lux-skeleton" />)}</span></div>;
  else if (!feed.articles.length) body = <EmptyState icon="newsFeed" title="We couldn’t load education updates." text="The publishers’ feeds did not answer. Please try again in a moment."
    action={<button className="lux-button lux-button--primary" type="button" onClick={refresh} disabled={loading}><Icon name="refresh" />Try again</button>} />;
  else if (!records.length) body = <EmptyState icon="search" title="No stories match this view." text="Try another topic or a shorter search phrase."
    action={<button className="lux-button lux-button--outline" type="button" onClick={clear}>Clear filters</button>} />;
  else body = <>
    {(lead || brief.length > 0) && <section className={styles.front} aria-labelledby="front-title">
      <h2 id="front-title" className="sr-only">Latest {topic === 'all' ? 'education' : topicOf(topic)?.label} stories</h2>
      {lead && <LeadStory story={lead} {...storyProps} />}
      {brief.length > 0 && <aside className={styles.brief} aria-labelledby="brief-title">
        <h3 id="brief-title" className={styles.briefTitle}><Icon name="newsClock" />In brief</h3>
        <ol>{brief.map((story, index) => <li key={story.id}><BriefStory story={story} index={index} {...storyProps} /></li>)}</ol>
      </aside>}
    </section>}
    {columns.length > 0 && <section className={styles.block} aria-labelledby="more-title">
      <header className={styles.blockHead}><h2 id="more-title">More from the desk</h2><span>{columns.length} {columns.length === 1 ? 'story' : 'stories'}</span></header>
      <div className={styles.columnsClip}><div className={styles.columns}>{columns.slice(0, limit).map((story) => <ColumnStory key={story.id} story={story} {...storyProps} />)}</div></div>
      {columns.length > limit && <button className={`lux-button lux-button--ghost ${styles.more}`} type="button" onClick={() => setLimit((value) => value + PAGE)}>Show more stories<span className={styles.moreCount}>{columns.length - limit} left</span></button>}
    </section>}
    {reads.length > 0 && <section className={`lux-surface-dark ${styles.reads}`} aria-labelledby="reads-title">
      <div className={styles.readsHead}><p className="lux-eyebrow lux-eyebrow--rule">Explainers &amp; analysis</p><h2 id="reads-title">Read &amp; understand</h2><p>Longer reads that explain the story behind a headline.</p></div>
      <ul className={styles.readsList}>{reads.slice(0, 6).map((story) => <li key={story.id}><ReadStory story={story} {...storyProps} /></li>)}</ul>
    </section>}
  </>;

  return <div className={styles.desk}>
    <header className={styles.masthead}>
      <div className={styles.dateline}>
        <span className={styles.today}><Icon name="newsPaper" />{today}</span>
        <div className={styles.tools}>
          <label className={styles.search}>
            <Icon name="search" /><span className="sr-only">Search the news</span>
            <input className="lux-field" type="search" value={query} maxLength={100} placeholder="Search headlines" onChange={(event) => { setQuery(event.target.value); setLimit(PAGE); }} />
          </label>
          <button type="button" className={`lux-chip ${styles.savedToggle}`} aria-pressed={showSaved} onClick={() => choose({ saved: !showSaved })}>
            <Icon name={showSaved ? 'bookmarkFilled' : 'bookmark'} /><span className={styles.savedLabel}>Saved</span><span className={styles.savedCount}>{saved.length}</span>
          </button>
        </div>
      </div>
      <div className={styles.nameplate}>
        <p className={styles.kicker}>Admissions · Exams · Results · Policy</p>
        <h1 className={styles.title}>The Education Desk<span className="sr-only"> — education news &amp; articles</span></h1>
        <p className={styles.motto}>Dated, sourced and linked to the original publisher.</p>
        <p className={styles.status} data-status={loading ? 'loading' : feed.status}>
          <i aria-hidden="true" />
          <span>{statusText(feed, loading)}{!loading && feed.updatedAt && ['ready', 'partial'].includes(feed.status) && <> · checked <time dateTime={feed.updatedAt}>{newsDate(feed.updatedAt, true)}</time> IST</>}</span>
          <button className={styles.refresh} type="button" onClick={refresh} disabled={loading} aria-label="Refresh education updates"><Icon name="refresh" /></button>
        </p>
      </div>
      <nav className={styles.sections} aria-label="News topics">
        <ul>{topics.map((item) => {
          const count = item.id === 'all' ? feed.articles.length : counts.get(item.id) || 0;
          return <li key={item.id}><button type="button" aria-pressed={topic === item.id} onClick={() => choose({ topic: item.id })}>{item.id === 'all' ? 'All' : item.label}{feed.articles.length > 0 && !showSaved && <span className={styles.sectionCount}>{count}</span>}</button></li>;
        })}</ul>
      </nav>
    </header>

    <div className={styles.body}>{body}</div>

    <footer className={styles.colophon}>
      <div>
        <h2>About these stories</h2>
        <p>Headlines and summaries come from public education feeds. Every story opens on the original publisher’s website with its publish date — confirm deadlines in the official notice.</p>
      </div>
      {feed.sources?.length > 0 && <ul className={styles.sources} aria-label="Publishers">{feed.sources.map((source) => <li key={source.id} data-state={source.state}>{source.name}<span>{source.state === 'fresh' ? 'Up to date' : 'Delayed'}</span></li>)}</ul>}
      <Link className="lux-link" href="/sources-and-editorial">Sources &amp; editorial approach<Icon name="arrow" /></Link>
      <span className="sr-only" role="status">{notice}</span>
    </footer>
    {notice && <p className={styles.toast} aria-hidden="true" key={notice}>{notice}</p>}
  </div>;
}

function EmptyState({ icon, title, text, action }) {
  return <div className={`lux-state ${styles.empty}`}><Icon name={icon} /><h2 className="lux-title">{title}</h2><p>{text}</p>{action}</div>;
}

function Headline({ story, as: Tag = 'h3', className }) {
  return <Tag className={className}><a href={story.url} target="_blank" rel="noopener noreferrer">{story.title}<span className="sr-only"> (opens publisher in a new tab)</span></a></Tag>;
}

function Kicker({ story, topicOf }) {
  return <p className={styles.storyKicker}>{topicOf(story.category)?.label || 'Education'}{story.type === 'article' && <span> · Article</span>}</p>;
}

function Byline({ story, withTime = false }) {
  return <p className={styles.byline}><span>{story.source}</span><span aria-hidden="true">·</span><time dateTime={story.publishedAt} title={`${newsDate(story.publishedAt, true)} IST`}>{newsDate(story.publishedAt, withTime)}</time></p>;
}

function SaveButton({ story, savedIds, onSave }) {
  const saved = savedIds.has(story.id);
  return <button type="button" className={styles.save} aria-pressed={saved} aria-label={`${saved ? 'Unsave' : 'Save'} ${story.title}`} onClick={() => onSave(story)}><Icon name={saved ? 'bookmarkFilled' : 'bookmark'} /></button>;
}

// Publisher photos appear only when the image policy allows them; otherwise a typographic plate.
function Cover({ story, config, topicOf, lead = false }) {
  const [broken, setBroken] = useState(false);
  const src = displayNewsImage(story.imageUrl, config);
  const topic = topicOf(story.category);
  if (src && !broken) return <div className={styles.cover}><Image src={src} alt="" fill sizes={lead ? '(max-width: 640px) 100vw, (max-width: 1100px) 92vw, 760px' : '(max-width: 640px) 100vw, 360px'} onError={() => setBroken(true)} /></div>;
  if (!lead) return null;
  return <div className={`${styles.cover} ${styles.plate}`} aria-hidden="true"><span className={styles.plateMark}>The Education Desk</span><Icon name={topic?.icon || 'news'} /><span className={styles.plateTopic}>{topic?.label || 'Education'}</span></div>;
}

function LeadStory({ story, savedIds, onSave, config, topicOf }) {
  return <article className={styles.lead}>
    <a className={styles.coverLink} href={story.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true"><Cover story={story} config={config} topicOf={topicOf} lead /></a>
    <div className={styles.leadBody}>
      <Kicker story={story} topicOf={topicOf} />
      <Headline story={story} className={styles.leadTitle} />
      {story.description && <p className={styles.dek}>{story.description}</p>}
      <div className={styles.storyFoot}><Byline story={story} withTime /><SaveButton story={story} savedIds={savedIds} onSave={onSave} /></div>
    </div>
  </article>;
}

function BriefStory({ story, index, savedIds, onSave, topicOf }) {
  return <article className={styles.briefStory}>
    <span className={styles.briefIndex} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <div><Kicker story={story} topicOf={topicOf} /><Headline story={story} className={styles.briefHeadline} /><Byline story={story} /></div>
    <SaveButton story={story} savedIds={savedIds} onSave={onSave} />
  </article>;
}

function ColumnStory({ story, savedIds, onSave, config, topicOf }) {
  return <article className={styles.column}>
    <Cover story={story} config={config} topicOf={topicOf} />
    <Kicker story={story} topicOf={topicOf} />
    <Headline story={story} className={styles.columnTitle} />
    {story.description && <p className={styles.columnDek}>{story.description}</p>}
    <div className={styles.storyFoot}><Byline story={story} /><SaveButton story={story} savedIds={savedIds} onSave={onSave} /></div>
  </article>;
}

function ReadStory({ story, savedIds, onSave, topicOf }) {
  return <article className={styles.read}>
    <Icon name="newsQuote" />
    <div><Kicker story={story} topicOf={topicOf} /><Headline story={story} className={styles.readTitle} /><Byline story={story} /></div>
    <SaveButton story={story} savedIds={savedIds} onSave={onSave} />
  </article>;
}
