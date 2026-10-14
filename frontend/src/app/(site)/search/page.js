import PageIntro from '@/components/layout/PageIntro';
import SearchResults, { SEARCH_TABS } from '@/features/site/SearchResults';
import { getCatalog, searchCatalog } from '@/lib/api/catalog';

export const metadata = { title: 'Search | NSEDU', robots: { index: false, follow: true } };

const text = (value) => String((Array.isArray(value) ? value[0] : value) || '');

export default async function SearchPage({ searchParams }) {
  const params = await searchParams;
  const query = text(params.q).trim().slice(0, 120);
  const tab = SEARCH_TABS.some((item) => item.id === text(params.tab)) ? text(params.tab) : 'all';
  const [{ results, failed }, catalog] = await Promise.all([searchCatalog(query), getCatalog()]);
  const total = results.courses.length + results.colleges.length + results.exams.length;
  const description = !query ? 'Courses, colleges, entrance exams and study cities in one place.'
    : failed ? 'Search is temporarily unavailable.'
      : total ? `${total} ${total === 1 ? 'match' : 'matches'} across courses, colleges and exams.` : 'No matches yet — try one of the suggestions below.';
  return <main id="main" tabIndex={-1}>
    <PageIntro compact eyebrow="Search" icon="search" current={query ? `“${query}”` : 'Search'} crumbs={query ? [{ label: 'Search', href: '/search' }] : []}
      title={query ? 'Results for' : 'Search'} accent={query ? `“${query}”` : 'NSEDU'} description={description} />
    <SearchResults query={query} tab={tab} results={results} failed={failed} catalog={catalog} />
  </main>;
}
