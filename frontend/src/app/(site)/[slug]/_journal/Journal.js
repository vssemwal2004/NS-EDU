import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './journal.module.css';

// Long-form "journal" reading layout shared by the information pages (/[slug]) and /bot.
// Server-only: the table of contents is a sticky rail on desktop and a <details> disclosure on phones.
const isExternal = (href) => /^https?:\/\//i.test(href);
export const slugify = (text) => String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function readingMinutes(texts) {
  const words = texts.join(' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function JournalLink({ href, label, className = '' }) {
  if (!isExternal(href)) return <Link className={`lux-link ${className}`} href={href}>{label}<Icon name="arrow" /></Link>;
  return <a className={`lux-link ${className}`} href={href} target="_blank" rel="noopener noreferrer">{label}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>;
}

export function Masthead({ crumbs = [], eyebrow, title, standfirst, meta = [], children }) {
  return <header className={styles.masthead}>
    <div className={styles.mastInner}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <ol>
          <li><Link href="/">Home</Link></li>
          {crumbs.map((crumb) => <li key={crumb.href}><Link href={crumb.href}>{crumb.label}</Link></li>)}
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      {eyebrow && <p className="lux-eyebrow lux-eyebrow--rule">{eyebrow}</p>}
      <h1 id="page-title" className={styles.title}>{title}</h1>
      {standfirst && <p className={styles.standfirst}>{standfirst}</p>}
      {meta.length > 0 && <ul className={styles.meta} aria-label="About this page">{meta.map((item) => <li key={item.label} data-tone={item.tone}>{item.icon && <Icon name={item.icon} />}{item.label}</li>)}</ul>}
      {children}
    </div>
    <span className={styles.mastRule} aria-hidden="true" />
  </header>;
}

function TocList({ items }) {
  return <ol className={styles.tocList}>
    {items.map((item, index) => <li key={item.id}><a href={`#${item.id}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{item.label}</a></li>)}
  </ol>;
}

// Desktop rail (TOC + collection links) and the phone disclosure. Only one is displayed at a time.
export function JournalBody({ toc = [], collection, current, children, wide = false }) {
  const showToc = toc.length >= 2;
  return <div className={`${styles.shell} ${wide ? styles.shellWide : ''}`}>
    <aside className={styles.rail}>
      {showToc && <nav className={styles.toc} aria-label="On this page">
        <p className={styles.railTitle}><Icon name="pageList" />On this page</p>
        <TocList items={toc} />
      </nav>}
      {collection && <nav className={styles.collection} aria-label={collection.title}>
        <p className={styles.railTitle}>{collection.title}</p>
        <ul>{collection.links.map((link) => <li key={link.href}><Link href={link.href} aria-current={link.href === current ? 'page' : undefined}>{link.label}</Link></li>)}</ul>
      </nav>}
    </aside>
    <div className={styles.column}>
      {showToc && <details className={styles.tocMobile}>
        <summary><Icon name="pageList" /><span>On this page <small>{toc.length} sections</small></span><Icon name="chevron" /></summary>
        <nav aria-label="On this page"><TocList items={toc} /></nav>
      </details>}
      {children}
    </div>
  </div>;
}

export function Chapter({ id, index, title, children, className = '' }) {
  return <section id={id} className={`${styles.chapter} ${className}`} aria-labelledby={`${id}-title`}>
    {index != null && <p className={styles.chapterNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</p>}
    <h2 id={`${id}-title`} className={styles.chapterTitle}>{title}</h2>
    {children}
  </section>;
}

export function Prose({ children, lead = false }) {
  return <div className={`${styles.prose} ${lead ? styles.dropCap : ''}`}>{children}</div>;
}

export function LinkRow({ links }) {
  if (!links?.length) return null;
  return <ul className={styles.linkRow}>{links.map((link) => <li key={link.href}><JournalLink {...link} /></li>)}</ul>;
}

export function Callout({ icon = 'document', title, tone = 'note', children }) {
  return <aside className={styles.callout} data-tone={tone}>
    <Icon name={icon} />
    <div><strong>{title}</strong><p>{children}</p></div>
  </aside>;
}

export function CardGrid({ items, linkIcons = {} }) {
  return <ul className={styles.cards}>
    {items.map((item) => <li key={item.href}>
      <Link className={styles.card} href={item.href}>
        <span className={styles.cardIcon}><Icon name={item.icon || linkIcons[item.href] || 'arrow'} /></span>
        <span className={styles.cardText}><strong>{item.title || item.label}</strong>{item.text && <small>{item.text}</small>}</span>
        <Icon name="arrow" className={styles.cardArrow} />
      </Link>
    </li>)}
  </ul>;
}

export function ContinueReading({ title, links, current, linkIcons }) {
  const rest = links.filter((link) => link.href !== current);
  if (!rest.length) return null;
  return <section className={styles.continue} aria-labelledby="continue-title">
    <p className="lux-eyebrow lux-eyebrow--rule">Continue reading</p>
    <h2 id="continue-title" className={styles.continueTitle}>More in {title.replace(/^Gyaan Vidhya & /, '')}</h2>
    <CardGrid items={rest} linkIcons={linkIcons} />
  </section>;
}

export function Unavailable() {
  return <main id="main" tabIndex={-1} className={styles.page}>
    <div className="lux-state" role="status">
      <Icon name="refresh" />
      <h1 className="lux-display-3">Temporarily unavailable</h1>
      <p className="lux-lead">This page could not be loaded right now. Please refresh in a moment.</p>
      <Link className="lux-button lux-button--outline" href="/">Back to home</Link>
    </div>
  </main>;
}

export { styles as journalStyles };
