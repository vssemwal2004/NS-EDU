import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageIntro from '@/components/layout/PageIntro';
import Icon from '@/components/ui/Icon';
import GuideToc from '@/features/guides/GuideToc';
import { GuideLink } from '@/features/guides/GuidePage';
import { slugify } from '@/features/guides/data';
import { footerGroups, site } from '@/data/site';
import { sitePages } from '@/data/site-pages';
import { getCatalog } from '@/lib/api/catalog';
import styles from './page.module.css';

// These topics have dedicated feature routes; their copy is reused there.
const featureRoutes = new Set(['scholarships', 'career-guidance', 'admission-checklist']);
const findPage = (slug) => Object.hasOwn(sitePages, slug) && !featureRoutes.has(slug) ? sitePages[slug] : null;

const linkIcons = {
  '/about': 'spark', '/contact': 'mail', '/help': 'guidesLifebuoy', '/report-correction': 'edit', '/sources-and-editorial': 'book', '/accessibility': 'guidesAccess',
  '/legal': 'shield', '/terms-and-conditions': 'document', '/privacy-policy': 'lock', '/cookie-policy': 'layers', '/disclaimer': 'coursesInfo',
  '/blog': 'news', '/scholarships': 'cap', '/career-guidance': 'compass', '/admission-checklist': 'guidesChecklist', '/news': 'news',
};
const guideLinks = { title: 'Student guides', links: [
  { label: 'Blog & student guides', href: '/blog' }, { label: 'Scholarships & funding', href: '/scholarships' }, { label: 'Career guidance', href: '/career-guidance' },
  { label: 'Admission checklist', href: '/admission-checklist' }, { label: 'Education news', href: '/news' },
] };
function groupFor(slug) {
  const group = footerGroups.find((item) => item.title !== 'Explore' && item.links.some((link) => link.href === `/${slug}`)) || guideLinks;
  const legal = group.title === 'Legal & privacy';
  const hub = group === guideLinks ? null : legal ? { label: 'Legal', href: '/legal' } : { label: 'Help centre', href: '/help' };
  return { ...group, icon: legal ? 'shield' : group === guideLinks ? 'book' : 'support', crumbs: hub && hub.href !== `/${slug}` ? [hub] : [] };
}

const helpTopics = [
  { href: '/colleges', icon: 'building', title: 'Finding colleges', text: 'Filter sample colleges by course, city and fee.' },
  { href: '/courses', icon: 'book', title: 'Courses', text: 'Fields, levels, sample fees and linked exams.' },
  { href: '/compare', icon: 'compare', title: 'Comparing', text: 'Put up to three colleges side by side.' },
  { href: '/eligibility', icon: 'eligibility', title: 'Eligibility', text: 'What to confirm before applying.' },
  { href: '/budget', icon: 'wallet', title: 'Budget planning', text: 'Tuition plus living and one-time costs.' },
  { href: '/exams', icon: 'document', title: 'Entrance exams', text: 'Official sites and the courses they lead to.' },
  { href: '/scholarships', icon: 'cap', title: 'Scholarships', text: 'Funding portals and what to check.' },
  { href: '/news', icon: 'news', title: 'Saved news', text: 'Bookmark stories to read later on this device.' },
];
const aboutTools = [
  { href: '/colleges', icon: 'building', title: 'Discover', text: 'Courses, colleges and study destinations.' },
  { href: '/compare', icon: 'compare', title: 'Compare', text: 'Fees and placements side by side, with data years.' },
  { href: '/eligibility', icon: 'eligibility', title: 'Check', text: 'Academic requirements to confirm.' },
  { href: '/budget', icon: 'wallet', title: 'Plan', text: 'A first-year budget beyond tuition.' },
];

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(sitePages).filter((slug) => !featureRoutes.has(slug)).map((slug) => ({ slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = findPage(slug);
  if (!page) notFound();
  return { title: `${page.title} | NSEDU`, description: page.description, ...(page.draft || (slug === 'contact' && site.contactIsTemporary) ? { robots: { index: false, follow: true } } : {}) };
}

export default async function InformationPage({ params }) {
  const { slug } = await params;
  const page = findPage(slug);
  if (!page) notFound();
  const group = groupFor(slug);
  const sections = page.sections.map((section) => ({ ...section, id: slugify(section.title) }));
  const isHelp = slug === 'help';
  const isContact = slug === 'contact';

  let stats = [];
  if (slug === 'about') {
    const catalog = await getCatalog();
    stats = [
      { value: catalog.courses.length, label: 'Courses' }, { value: catalog.exams.length, label: 'Exam guides' },
      { value: catalog.colleges.length, label: 'Sample programmes' }, { value: new Set(catalog.colleges.map((row) => row.collegeId)).size, label: 'Sample institutions' },
    ];
  }

  const toc = isHelp ? [{ id: 'topics', label: 'Browse by topic' }, { id: 'faqs', label: 'Frequently asked' }, { id: 'more-help', label: 'Still need help?' }]
    : [...(isContact ? [{ id: 'channels', label: 'Ways to reach us' }] : []), ...sections.map((section) => ({ id: section.id, label: section.title }))];
  const showToc = toc.length >= 3;

  return <main id="main" tabIndex={-1}>
    <PageIntro compact eyebrow={page.category} icon={group.icon} title={page.title} current={page.title} crumbs={group.crumbs} description={page.description}
      stats={stats} statsNote={stats.length ? 'In the illustrative directory · institutions are fictional.' : undefined}
      meta={isContact && site.contactIsTemporary ? 'Support channels are not active yet in this preview.' : undefined} />

    <div className={`container ${styles.body} ${showToc ? styles.withToc : ''}`}>
      <nav className={styles.sideNav} aria-label={group.title}>
        <p className={styles.sideTitle}>{group.title}</p>
        <ul>{group.links.map((link) => <li key={link.href}>
          <Link href={link.href} aria-current={link.href === `/${slug}` ? 'page' : undefined}><Icon name={linkIcons[link.href] || 'arrow'} />{link.label}</Link>
        </li>)}</ul>
      </nav>

      <article className={styles.article} aria-labelledby="page-title">
        {page.draft && <p className={styles.notice}><Icon name="document" /><span><strong>Policy preview</strong>Draft content for this preview. Final company and service policies are still being prepared.</span></p>}

        {isHelp ? <>
          <form className={styles.helpSearch} action="/search" role="search">
            <label htmlFor="help-search">Search courses, colleges and exams</label>
            <div><Icon name="search" /><input id="help-search" type="search" name="q" placeholder="e.g. B.Tech, Pune or JEE Main" maxLength={120} /><button className="button button--primary" type="submit">Search</button></div>
          </form>
          <section id="topics" className={styles.block} aria-labelledby="topics-title">
            <h2 id="topics-title" className={styles.blockTitle}>Browse by topic</h2>
            <ul className={styles.cardGrid}>{helpTopics.map((topic) => <li key={topic.href}><CardLink {...topic} /></li>)}</ul>
          </section>
          <section id="faqs" className={styles.block} aria-labelledby="faqs-title">
            <h2 id="faqs-title" className={styles.blockTitle}>Frequently asked</h2>
            <div className={styles.faq}>{sections.map((section, index) => <details key={section.id} id={section.id} open={index === 0}>
              <summary>{section.title}<Icon name="chevron" /></summary>
              <div><p>{section.text}</p>{section.links && <ul className={styles.links}>{section.links.map((link) => <li key={link.href}><GuideLink {...link} /></li>)}</ul>}</div>
            </details>)}</div>
          </section>
          <section id="more-help" className={styles.moreHelp} aria-labelledby="more-help-title">
            <Icon name="guidesLifebuoy" />
            <div><h2 id="more-help-title">Still need help?</h2><p>See the current support-channel status, or tell us about information that needs correcting.</p></div>
            <div className={styles.moreActions}><Link className="button button--primary" href="/contact">Contact & support</Link><Link className="button button--outline" href="/report-correction">Report a correction</Link></div>
          </section>
        </> : <>
          {isContact && <section id="channels" className={styles.block} aria-labelledby="channels-title">
            <h2 id="channels-title" className={styles.blockTitle}>Ways to reach us</h2>
            <ul className={styles.cardGrid}>
              <li><CardLink href="/help" icon="guidesLifebuoy" title="Help centre & FAQs" text="Answers about using the tools and the sample data." /></li>
              <li><CardLink href="/report-correction" icon="edit" title="Report a correction" text="What to include so an issue can be checked." /></li>
              <li><CardLink href="/sources-and-editorial" icon="book" title="Sources & editorial" text="Where information comes from and how it is labelled." /></li>
              <li><CardLink href="/accessibility" icon="guidesAccess" title="Accessibility barrier" text="How to describe a problem using the site." /></li>
              <li className={styles.wide}><div className={styles.channel}>
                <span className={styles.channelIcon}><Icon name="mail" /></span>
                <div><h3>Email support {site.contactIsTemporary && <span className={styles.status}><Icon name="guidesClock" />Not active yet</span>}</h3>
                  {site.contactIsTemporary ? <p className={styles.address}>{site.supportEmail}</p> : <a className={styles.address} href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>}
                  <p className={styles.small}>{site.contactIsTemporary ? 'Temporary address for the design preview. Email support is not active yet.' : 'Include the relevant page and a short description of your question.'}</p></div>
              </div></li>
              <li id="social-profiles" className={styles.wide}><div className={styles.channel}>
                <span className={styles.channelIcon}><Icon name="people" /></span>
                <div><h3>Official social profiles</h3><p className={styles.small}>Follow our education updates when the official profiles are available.</p>
                  <ul className={styles.profiles}>{site.socials.map((social) => <li key={social.name}><Icon name={social.icon} />{social.href ? <a href={social.href} target="_blank" rel="noopener noreferrer">{social.name}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{social.name}<small>Coming soon</small></span>}</li>)}</ul></div>
              </div></li>
            </ul>
          </section>}
          {sections.map((section, index) => <section key={section.id} id={section.id} className={styles.section} aria-labelledby={`${section.id}-title`}>
            <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <p>{section.text}</p>
              {section.links && <ul className={styles.links}>{section.links.map((link) => <li key={link.href}><GuideLink {...link} /></li>)}</ul>}
            </div>
          </section>)}
          {slug === 'about' && <section className={styles.block} aria-labelledby="about-tools-title">
            <h2 id="about-tools-title" className={styles.blockTitle}>What you can do today</h2>
            <ul className={styles.cardGrid}>{aboutTools.map((tool) => <li key={tool.href}><CardLink {...tool} /></li>)}</ul>
          </section>}
        </>}

        <div className={styles.return}><Link href="/"><Icon name="arrow" />Return to the student platform</Link></div>
      </article>

      {showToc && <GuideToc items={toc} disclosure={false} className={styles.toc} />}
    </div>
  </main>;
}

function CardLink({ href, icon, title, text }) {
  return <Link className={styles.card} href={href}><span className={styles.channelIcon}><Icon name={icon} /></span><span><strong>{title}</strong><small>{text}</small></span><Icon name="arrow" /></Link>;
}
