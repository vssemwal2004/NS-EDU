import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { getContent } from '@/lib/api/content';
import { Callout, Chapter, ContinueReading, JournalBody, journalStyles, Masthead, Prose } from '../[slug]/_journal/Journal';
import styles from './bot.module.css';

// Public notice for site owners about the university-data crawler (backend/src/scraper). Every number here is a crawler default.
export const metadata = {
  title: 'GyaanVidhyaBot: our crawler | Gyaan Vidhya',
  description: 'How GyaanVidhyaBot collects public facts from official university websites, how to block it with robots.txt, and how to ask for a correction or removal.',
};

const toc = [
  { id: 'what-it-is', label: 'What GyaanVidhyaBot is' },
  { id: 'recognise', label: 'How to recognise it' },
  { id: 'collects', label: 'What it collects' },
  { id: 'never', label: 'What it leaves alone' },
  { id: 'behaviour', label: 'How it behaves' },
  { id: 'opt-out', label: 'Opt out with robots.txt' },
  { id: 'corrections', label: 'Corrections and removal' },
];

const collects = ['Institution name and other names it uses', 'Address, PIN code, city and state', 'Year of establishment', 'Accreditation and approvals (such as NAAC grade or NIRF rank, when published)', 'Streams and programme names', 'Links to the official admissions page and logo (the logo itself is not downloaded)', 'A short extract of the institution’s own description (up to 600 characters)', 'Institutional contact details: role mailboxes on your own domain (admissions@, info@ …) and listed phone numbers'];
const never = ['Lines that name a person (Dr., Prof., Mr., Ms., Shri, Smt …)', 'Staff, faculty-directory, alumni, careers, login and portal pages', 'Images: nothing is downloaded or re-hosted', 'Pages on other domains, including redirects that leave your domain'];
const limits = [
  { value: '1', label: 'crawl per site at a time' },
  { value: '3 s', label: 'minimum gap between requests to one domain' },
  { value: '8', label: 'pages per visit, home page included' },
  { value: '2 MB', label: 'read per page at most' },
];

const linkIcons = { '/about': 'spark', '/contact': 'pageMail', '/help': 'pageQuestion', '/report-correction': 'edit', '/sources-and-editorial': 'book', '/accessibility': 'guidesAccess' };

function Code({ label, children }) {
  return <figure className={styles.code}>
    <figcaption>{label}</figcaption>
    <pre><code>{children}</code></pre>
  </figure>;
}

export default async function BotPage() {
  const { site } = await getContent(['site']);
  const temporary = site?.contactIsTemporary !== false;
  const group = site?.footerGroups?.find((item) => item.links.some((link) => link.href === '/report-correction')) || null;

  return <main id="main" tabIndex={-1} className={journalStyles.page}>
    <Masthead crumbs={[{ label: 'Help centre', href: '/help' }]} eyebrow="For university and college websites" title="GyaanVidhyaBot" standfirst="The crawler that reads public facts from official institution websites, and how you stay in control of it." meta={[{ label: 'Site owners', icon: 'pageBot' }, { label: 'robots.txt supported', icon: 'pageCode' }]}>
      <div className={styles.plate} aria-label="Crawler identification" role="group">
        <span className={styles.plateIcon} aria-hidden="true"><Icon name="pageBot" /></span>
        <dl>
          <div><dt>User-Agent</dt><dd><code>GyaanVidhyaBot/1.0</code></dd></div>
          <div><dt>robots.txt token</dt><dd><code>GyaanVidhyaBot</code></dd></div>
        </dl>
      </div>
    </Masthead>

    <JournalBody toc={toc} collection={group} current="/bot">
      <Chapter id="what-it-is" index={0} title="What GyaanVidhyaBot is">
        <Prose lead><p>GyaanVidhyaBot is the crawler Gyaan Vidhya uses to gather public, factual information about Indian universities and colleges from each institution’s own official website. Students use these facts to find and compare institutions.</p>
          <p>Every record it creates is marked unverified until our team reviews it, and each one keeps the address of the page it came from and the date it was fetched. Facts an editor has corrected by hand are never overwritten by a later crawl.</p></Prose>
      </Chapter>

      <Chapter id="recognise" index={1} title="How to recognise it">
        <Prose><p>Requests carry a User-Agent that starts with <code>GyaanVidhyaBot/1.0</code>, usually followed by a link back to this page. In robots.txt it answers to the product token <code>GyaanVidhyaBot</code>.</p></Prose>
        <Code label="User-Agent header">User-Agent: GyaanVidhyaBot/1.0 (+&lt;our site&gt;/bot)</Code>
      </Chapter>

      <Chapter id="collects" index={2} title="What it collects">
        <Prose><p>Short factual data points and links, nothing more:</p></Prose>
        <ul className={styles.ticks}>{collects.map((item) => <li key={item}><Icon name="check" />{item}</li>)}</ul>
      </Chapter>

      <Chapter id="never" index={3} title="What it leaves alone">
        <Prose><p>The crawler is built to avoid personal data and private areas of your site:</p></Prose>
        <ul className={`${styles.ticks} ${styles.crosses}`}>{never.map((item) => <li key={item}><Icon name="pageBlock" />{item}</li>)}</ul>
        <Callout icon="lock" title="If personal data slips through">Reviewers remove it while checking the record. If you spot any, tell us and we will delete it.</Callout>
      </Chapter>

      <Chapter id="behaviour" index={4} title="How it behaves">
        <Prose><p>It reads your robots.txt before fetching anything else and follows its Allow, Disallow and Crawl-delay rules. A Crawl-delay longer than the default gap wins; a site that asks for more than 60 seconds between requests is skipped rather than crawled slowly. Default limits per visit:</p></Prose>
        <dl className={styles.limits}>{limits.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
        <Prose><p>Each request times out after 15 seconds, follows at most 5 redirects within your own domain, and a failed visit is retried later with growing gaps, never in a tight loop.</p></Prose>
      </Chapter>

      <Chapter id="opt-out" index={5} title="Opt out with robots.txt">
        <Prose><p>To stop GyaanVidhyaBot from crawling your site, add this group to the robots.txt at the root of your domain:</p></Prose>
        <Code label="Block the whole site">{'User-agent: GyaanVidhyaBot\nDisallow: /'}</Code>
        <Prose><p>Or keep it out of some sections and slow it down:</p></Prose>
        <Code label="Block some paths and set a delay">{'User-agent: GyaanVidhyaBot\nDisallow: /admissions/drafts/\nCrawl-delay: 10'}</Code>
        <Prose><p>If no group names GyaanVidhyaBot, it follows your <code>User-agent: *</code> rules. robots.txt stops future crawling; to remove information already collected, write to us as described below.</p></Prose>
      </Chapter>

      <Chapter id="corrections" index={6} title="Corrections and removal">
        <Prose><p>You can ask us to correct a fact, remove your institution’s record, or stop crawling your site altogether. On a request we block the site from future crawls (later list uploads do not switch it back on), correct or hide the record, and keep a short log of what was asked and done.</p></Prose>
        <div className={`lux-surface-dark ${styles.contact}`}>
          <span className={styles.contactIcon} aria-hidden="true"><Icon name="pageMail" /></span>
          <div className={styles.contactText}>
            <p className={styles.contactEyebrow}>Corrections and takedown requests{site && temporary && <span className={styles.status}>Not active yet</span>}</p>
            {site ? temporary ? <p className={styles.address}>{site.supportEmail}</p> : <a className={styles.address} href={`mailto:${site.supportEmail}?subject=${encodeURIComponent('GyaanVidhyaBot request')}`}>{site.supportEmail}</a>
              : <p className={styles.address}>See Contact &amp; support</p>}
            <p className={styles.contactNote}>{temporary ? 'This address is a placeholder for the preview and is not monitored yet. The contact page shows when support goes live.' : 'Write from an address on your institution’s domain so we can confirm the request quickly.'}</p>
            <div className={styles.contactActions}>
              <Link className="lux-button lux-button--light lux-button--sm" href="/report-correction">What to include</Link>
              <Link className="lux-button lux-button--outline lux-button--sm" href="/contact">Contact &amp; support</Link>
            </div>
          </div>
        </div>
        <Prose><p>Please include the institution’s name and official website, the Gyaan Vidhya page concerned, what should change, and an official source where one exists.</p></Prose>
      </Chapter>

      {group && <ContinueReading title={group.title} links={group.links} current="/bot" linkIcons={linkIcons} />}
    </JournalBody>
  </main>;
}
