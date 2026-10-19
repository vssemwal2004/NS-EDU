import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { getContent } from '@/lib/api/content';
import { Callout, CardGrid, Chapter, ContinueReading, JournalBody, journalStyles, LinkRow, Masthead, Prose, readingMinutes, slugify, Unavailable } from './_journal/Journal';
import styles from './page.module.css';

// Page copy, card lists and footer groups are admin-edited content (`pages`, `site`).
const linkIcons = {
  '/about': 'spark', '/contact': 'pageMail', '/help': 'pageQuestion', '/report-correction': 'edit', '/sources-and-editorial': 'book', '/accessibility': 'guidesAccess',
  '/legal': 'pageScale', '/terms-and-conditions': 'document', '/privacy-policy': 'lock', '/cookie-policy': 'layers', '/disclaimer': 'coursesInfo',
  '/blog': 'news', '/scholarships': 'cap', '/career-guidance': 'compass', '/admission-checklist': 'guidesChecklist', '/news': 'news',
};
const botCard = { href: '/bot', icon: 'pageBot', title: 'For university websites', text: 'How GyaanVidhyaBot collects public facts, and how to opt out.' };

async function load(params) {
  const [{ slug }, { pages, site }] = await Promise.all([params, getContent(['pages', 'site'])]);
  const page = pages && Object.hasOwn(pages.pages, slug) ? pages.pages[slug] : null;
  return { slug, page, pages, site };
}

function groupFor(slug, { pages, site }) {
  const guideLinks = pages.guideLinks;
  const group = site?.footerGroups.find((item) => item.title !== 'Explore' && item.links.some((link) => link.href === `/${slug}`)) || guideLinks;
  const legal = group.title === 'Legal & privacy';
  const hub = group === guideLinks ? null : legal ? { label: 'Legal', href: '/legal' } : { label: 'Help centre', href: '/help' };
  return { ...group, crumbs: hub && hub.href !== `/${slug}` ? [hub] : [] };
}

export async function generateMetadata({ params }) {
  const { slug, page, pages, site } = await load(params);
  if (!pages) return { title: 'Temporarily unavailable | Gyaan Vidhya', robots: { index: false, follow: true } };
  if (!page) notFound();
  return { title: `${page.title} | Gyaan Vidhya`, description: page.description, ...(page.draft || (slug === 'contact' && site?.contactIsTemporary !== false) ? { robots: { index: false, follow: true } } : {}) };
}

export default async function InformationPage({ params }) {
  const { slug, page, pages, site } = await load(params);
  if (!pages) return <Unavailable />;
  if (!page) notFound();
  const group = groupFor(slug, { pages, site });
  const sections = page.sections.map((section) => ({ ...section, id: slugify(section.title) }));
  const isHelp = slug === 'help';
  const isContact = slug === 'contact';
  const temporary = site?.contactIsTemporary !== false;
  const current = `/${slug}`;

  const toc = isHelp ? [{ id: 'topics', label: 'Browse by topic' }, { id: 'faqs', label: 'Frequently asked' }, { id: 'more-help', label: 'Still need help?' }]
    : [...(isContact ? [{ id: 'channels', label: 'Ways to reach us' }] : []), ...sections.map((section) => ({ id: section.id, label: section.title })),
      ...(slug === 'about' && pages.aboutTools?.length ? [{ id: 'what-you-can-do', label: 'What you can do today' }] : [])];
  const meta = [
    page.draft && { label: 'Policy preview · draft', icon: 'document', tone: 'warn' },
    isContact && temporary && { label: 'Support channels not active yet', icon: 'calendar', tone: 'warn' },
    isHelp ? { label: `${sections.length} answers`, icon: 'pageQuestion' } : { label: `${readingMinutes([page.description, ...sections.map((section) => section.text)])} min read`, icon: 'book' },
  ].filter(Boolean);

  return <main id="main" tabIndex={-1} className={journalStyles.page}>
    <Masthead crumbs={group.crumbs} eyebrow={page.category} title={page.title} standfirst={page.description} meta={meta} />
    <JournalBody toc={toc} collection={group} current={current} wide={isHelp || isContact}>
      {page.draft && <Callout icon="document" tone="warn" title="Policy preview">Draft content for this preview. Final company and service policies are still being prepared.</Callout>}

      {isHelp ? <>
        <form className={styles.search} action="/search" role="search">
          <label className={styles.searchLabel} htmlFor="help-search">Search courses, colleges and exams</label>
          <div className={styles.searchRow}>
            <input id="help-search" className="lux-field" type="search" name="q" placeholder="e.g. B.Tech, Pune or JEE Main" maxLength={120} aria-describedby="help-search-hint" />
            <button className="lux-button lux-button--primary" type="submit"><Icon name="search" />Search</button>
          </div>
          <p id="help-search-hint" className={styles.searchHint}>Search results include universities, so you’ll be asked to log in first.</p>
        </form>
        <Chapter id="topics" title="Browse by topic"><CardGrid items={pages.helpTopics} /></Chapter>
        <Chapter id="faqs" title="Frequently asked">
          <div className={styles.faq}>{sections.map((section, index) => <details key={section.id} id={section.id} open={index === 0}>
            <summary><span className={styles.faqNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span className={styles.faqQ}>{section.title}</span><Icon name="plus" /></summary>
            <div className={styles.faqA}><p>{section.text}</p><LinkRow links={section.links} /></div>
          </details>)}</div>
        </Chapter>
        <section id="more-help" className={`lux-surface-dark ${styles.moreHelp}`} aria-labelledby="more-help-title">
          <Icon name="pageInbox" />
          <div><h2 id="more-help-title">Still need help?</h2><p>See the current support-channel status, or tell us about information that needs correcting.</p></div>
          <div className={styles.moreActions}>
            <Link className="lux-button lux-button--light" href="/contact">Contact & support</Link>
            <Link className="lux-button lux-button--outline" href="/report-correction">Report a correction</Link>
          </div>
        </section>
      </> : <>
        {isContact && <Chapter id="channels" title="Ways to reach us">
          {site && <div className={`lux-surface-dark ${styles.mailCard}`}>
            <span className={styles.mailIcon}><Icon name="pageMail" /></span>
            <div className={styles.mailText}>
              <p className={styles.mailEyebrow}>Email support{temporary && <span className={styles.status}>Not active yet</span>}</p>
              {temporary ? <p className={styles.address}>{site.supportEmail}</p> : <a className={styles.address} href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>}
              <p className={styles.mailNote}>{temporary ? 'Temporary address for the design preview. Email support is not active yet.' : 'Include the relevant page and a short description of your question.'}</p>
            </div>
          </div>}
          <CardGrid items={[...pages.contactCards, botCard]} />
          {site && <div id="social-profiles" className={styles.socials}>
            <h3 className={styles.socialsTitle}>Official social profiles</h3>
            <p className={styles.socialsNote}>Follow our education updates when the official profiles are available.</p>
            <ul>{site.socials.map((social) => <li key={social.name}><Icon name={social.icon} />{social.href ? <a href={social.href} target="_blank" rel="noopener noreferrer">{social.name}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{social.name}<small>Coming soon</small></span>}</li>)}</ul>
          </div>}
        </Chapter>}
        {sections.map((section, index) => <Chapter key={section.id} id={section.id} index={index} title={section.title}>
          <Prose lead={index === 0 && !isContact}><p>{section.text}</p></Prose>
          <LinkRow links={section.links} />
        </Chapter>)}
        {slug === 'about' && pages.aboutTools?.length > 0 && <Chapter id="what-you-can-do" title="What you can do today"><CardGrid items={pages.aboutTools} /></Chapter>}
        {(slug === 'report-correction' || slug === 'sources-and-editorial') && <Callout icon="pageBot" title="Run a university or college website?">
          Read <Link href="/bot">how GyaanVidhyaBot collects public facts</Link>, and how to opt out or ask for a correction.
        </Callout>}
      </>}

      <ContinueReading title={group.title} links={group.links} current={current} linkIcons={linkIcons} />
    </JournalBody>
  </main>;
}
