import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import CompareView from '@/features/compare/CompareView';
import InstitutionCompareView from '@/features/compare/InstitutionCompareView';
import { joinNames } from '@/features/compare/compare-data';
import { slugsFromParam } from '@/features/compare/compare-slugs';
import { joinInstitutionNames } from '@/features/compare/institution-rows';
import courseStyles from '@/features/compare/Compare.module.css';
import styles from '@/features/compare/InstitutionCompare.module.css';
import { getCatalog, getUniversity } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';

const listParam = (value) => (Array.isArray(value) ? value.join(',') : String(value || ''));
const description = 'Put up to three institutions side by side: location, recognition, courses, campus, fees, placements and the source behind every figure.';
const courseDescription = 'Pick a course, put up to three colleges in the arena and see fees, placements and data years side by side.';

// ?course= (with no ?u=) keeps the original per-course programme comparison; everything else is
// the institution board. Saved picks for both live under their own storage keys and never collide.
const isCourseMode = (params) => !listParam(params.u) && Boolean(listParam(params.course));

async function loadDetails(slugs) {
  const details = await Promise.all(slugs.map(async (slug) => {
    try { return await getUniversity(slug); } catch (error) { unstable_rethrow(error); return null; }
  }));
  return details.filter((detail) => detail?.item);
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const robots = { index: false, follow: true };
  if (isCourseMode(params)) {
    const catalog = await getCatalog();
    const programme = catalog.courses.find((item) => item.id === listParam(params.course));
    const ids = listParam(params.c).split(',').filter(Boolean);
    const rows = ids.map((id) => catalog.colleges.find((row) => row.id === id && row.courseId === programme?.id)).filter(Boolean).slice(0, 3);
    if (rows.length > 1) return { title: `${joinNames(rows)}: ${programme.name} comparison | Gyaan Vidhya`, description: courseDescription, robots };
    if (programme) return { title: `Compare ${programme.name} colleges | Gyaan Vidhya`, description: courseDescription, robots };
    return { title: 'Compare colleges | Gyaan Vidhya', description: courseDescription, robots };
  }
  const slugs = slugsFromParam(params.u);
  if (!slugs.length) return { title: 'Compare institutions | Gyaan Vidhya', description, robots };
  const details = await loadDetails(slugs);
  if (details.length < 2) return { title: 'Compare institutions | Gyaan Vidhya', description, robots };
  return { title: `${joinInstitutionNames(details.map((detail) => ({ shortName: detail.item.shortName || detail.item.name })))} compared | Gyaan Vidhya`, description, robots };
}

function ModeTabs({ mode }) {
  return <nav className={styles.modes} aria-label="Comparison type">
    <Link className={styles.modeLink} href="/compare" aria-current={mode === 'institutions' ? 'page' : undefined}><Icon name="compareColumns" />Institutions</Link>
    <Link className={styles.modeLink} href="/compare?course=btech" aria-current={mode === 'course' ? 'page' : undefined}><Icon name="compareGauge" />By course &amp; fee</Link>
  </nav>;
}

function Crumbs({ className }) {
  return <nav aria-label="Breadcrumb" className={className}>
    <ol><li><Link href="/">Home</Link></li><li><Icon name="chevron" /><span aria-current="page">Compare</span></li></ol>
  </nav>;
}

export default async function ComparePage({ searchParams }) {
  const [params] = await Promise.all([searchParams, requireStudentSession()]);

  if (isCourseMode(params)) {
    const initialCourse = listParam(params.course);
    const initialList = listParam(params.c);
    const intro = <>
      <Crumbs className={courseStyles.crumbs} />
      <p className="lux-eyebrow lux-eyebrow--rule">The versus arena</p>
      <h1 id="compare-title" className={courseStyles.title}>Compare colleges <em>on one course</em></h1>
      <p className={courseStyles.lead}>{courseDescription}</p>
      <ModeTabs mode="course" />
    </>;
    return <main id="main" tabIndex={-1} className={courseStyles.main}>
      {/* Keyed so a suggestion link to new ?course/&c values resets the client state. */}
      <CompareView key={`${initialCourse}|${initialList}`} initialCourse={initialCourse} initialList={initialList} intro={intro} />
    </main>;
  }

  const slugs = slugsFromParam(params.u);
  // Slugs the API could not resolve stay in the list: the client retries and names the reason
  // ("no longer listed" vs "could not load") rather than dropping them without a word.
  const details = await loadDetails(slugs);
  const intro = <>
    <Crumbs className={styles.crumbs} />
    <p className="lux-eyebrow lux-eyebrow--rule">The versus arena</p>
    <h1 id="compare-title" className={styles.title}>Compare institutions <em>side by side</em></h1>
    <p className={styles.lead}>{description}</p>
    <ModeTabs mode="institutions" />
  </>;
  return <main id="main" tabIndex={-1} className={styles.main}>
    <InstitutionCompareView initialSlugs={slugs} initialDetails={details} intro={intro} />
  </main>;
}
