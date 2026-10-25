import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import InstitutionCompareView from '@/features/compare/InstitutionCompareView';
import { slugsFromParam } from '@/features/compare/compare-slugs';
import { joinInstitutionNames } from '@/features/compare/institution-rows';
import styles from '@/features/compare/InstitutionCompare.module.css';
import { getUniversity } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';

const listParam = (value) => (Array.isArray(value) ? value.join(',') : String(value || ''));
const description = 'Put up to three institutions side by side: fees, placements, NAAC and NIRF, courses, campus life and the source behind every figure.';

async function loadDetails(slugs) {
  const details = await Promise.all(slugs.map(async (slug) => {
    try { return await getUniversity(slug); } catch (error) { unstable_rethrow(error); return null; }
  }));
  return details.filter((detail) => detail?.item);
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const robots = { index: false, follow: true };
  const slugs = slugsFromParam(params.u);
  if (!slugs.length) return { title: 'Compare institutions | Gyaan Vidhya', description, robots };
  const details = await loadDetails(slugs);
  if (details.length < 2) return { title: 'Compare institutions | Gyaan Vidhya', description, robots };
  return { title: `${joinInstitutionNames(details.map((detail) => ({ shortName: detail.item.shortName || detail.item.name })))} compared | Gyaan Vidhya`, description, robots };
}

function Crumbs({ className }) {
  return <nav aria-label="Breadcrumb" className={className}>
    <ol><li><Link href="/">Home</Link></li><li><Icon name="chevron" /><span aria-current="page">Compare</span></li></ol>
  </nav>;
}

// One comparison: real directory institutions, side by side. The former "by course & fee" mode ran
// on a sample catalogue of invented colleges; its old links (?course=…, no ?u=) now open this board.
export default async function ComparePage({ searchParams }) {
  const [params] = await Promise.all([searchParams, requireStudentSession()]);
  if (!listParam(params.u) && listParam(params.course)) redirect('/compare');

  const slugs = slugsFromParam(params.u);
  // Slugs the API could not resolve stay in the list: the client retries and names the reason
  // ("no longer listed" vs "could not load") rather than dropping them without a word.
  const details = await loadDetails(slugs);
  const intro = <>
    <Crumbs className={styles.crumbs} />
    <p className="lux-eyebrow lux-eyebrow--rule">The versus arena</p>
    <h1 id="compare-title" className={styles.title}>Compare institutions <em>side by side</em></h1>
    <p className={styles.lead}>{description}</p>
  </>;
  return <main id="main" tabIndex={-1} className={styles.main}>
    <InstitutionCompareView initialSlugs={slugs} initialDetails={details} intro={intro} />
  </main>;
}
