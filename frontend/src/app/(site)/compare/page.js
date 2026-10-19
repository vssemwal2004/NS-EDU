import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CompareView from '@/features/compare/CompareView';
import { joinNames } from '@/features/compare/compare-data';
import styles from '@/features/compare/Compare.module.css';
import { getCatalog } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';

const listParam = (value) => (Array.isArray(value) ? value.join(',') : String(value || ''));
const description = 'Pick a course, put up to three colleges in the arena and see fees, placements and data years side by side.';

export async function generateMetadata({ searchParams }) {
  const { course = '', c = '' } = await searchParams;
  const catalog = await getCatalog();
  const programme = catalog.courses.find((item) => item.id === listParam(course));
  const ids = listParam(c).split(',').filter(Boolean);
  const rows = ids.map((id) => catalog.colleges.find((row) => row.id === id && row.courseId === programme?.id)).filter(Boolean).slice(0, 3);
  const robots = { index: false, follow: true };
  if (rows.length > 1) return { title: `${joinNames(rows)}: ${programme.name} comparison | Gyaan Vidhya`, description, robots };
  if (programme) return { title: `Compare ${programme.name} colleges | Gyaan Vidhya`, description, robots };
  return { title: 'Compare colleges | Gyaan Vidhya', description, robots };
}

export default async function ComparePage({ searchParams }) {
  const [{ course = '', c = '' }] = await Promise.all([searchParams, requireStudentSession()]);
  const initialCourse = listParam(course);
  const initialList = listParam(c);
  const intro = <>
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      <ol><li><Link href="/">Home</Link></li><li><Icon name="chevron" /><span aria-current="page">Compare</span></li></ol>
    </nav>
    <p className="lux-eyebrow lux-eyebrow--rule">The versus arena</p>
    <h1 id="compare-title" className={styles.title}>Compare colleges <em>side by side</em></h1>
    <p className={styles.lead}>{description}</p>
  </>;
  return <main id="main" tabIndex={-1} className={styles.main}>
    {/* Keyed so a suggestion link to new ?course/&c values resets the client state. */}
    <CompareView key={`${initialCourse}|${initialList}`} initialCourse={initialCourse} initialList={initialList} intro={intro} />
  </main>;
}
