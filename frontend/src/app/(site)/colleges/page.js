import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeListing from '@/features/colleges/CollegeListing';
import styles from '@/features/colleges/Ledger.module.css';
import { getCatalog } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';
import { lakhRange, summarize } from '@/lib/college-catalog';

export const metadata = {
  title: 'Fee ledger: colleges by course, tuition & placements | Gyaan Vidhya',
  description: 'Line-by-line tuition and placement figures for illustrative colleges, by course and location. Filter, add to compare and quick-apply.',
  robots: { index: false, follow: true },
};

const text = (value) => String((Array.isArray(value) ? value[0] : value) || '');
const KEYS = ['course', 'location', 'field', 'fee', 'rating', 'sort', 'q'];

export default async function CollegesPage({ searchParams }) {
  const [params, catalog] = await Promise.all([searchParams, getCatalog(), requireStudentSession()]);
  const initial = Object.fromEntries(KEYS.map((key) => [key, text(params[key])]));
  const rows = catalog.colleges;
  const summary = summarize(rows);
  const ledger = [
    ['Institutions', summary.institutions],
    ['Programmes', summary.programmes],
    ['Cities', new Set(rows.map((row) => row.city).filter(Boolean)).size],
    ['Annual tuition', lakhRange(summary.feeMin, summary.feeMax)],
  ];
  return <main id="main" tabIndex={-1} className={styles.main}>
    <header className={styles.hero} aria-labelledby="ledger-title">
      <div className={`lux-container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <ol><li><Link href="/">Home</Link></li><li><Icon name="chevron" /><span aria-current="page">Fee ledger</span></li></ol>
          </nav>
          <p className="lux-eyebrow lux-eyebrow--rule">Colleges by course</p>
          <h1 id="ledger-title" className={styles.title}>The fee ledger: <em>every fee, line by line</em></h1>
          <p className={styles.lead}>Annual tuition and placement figures for each programme, side by side. Filter by course, place and budget, add up to three per course to compare, then quick-apply.</p>
        </div>
        {rows.length > 0 && <dl className={styles.heroLedger} aria-label="What this ledger covers">
          {ledger.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          <p className={styles.heroNote}><Icon name="collegesInfo" />Illustrative catalogue · fees {summary.tuitionYear || 'year not stated'}</p>
        </dl>}
      </div>
    </header>
    <CollegeListing initial={initial} />
  </main>;
}
