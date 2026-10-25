import Icon from '@/components/ui/Icon';
import { DirLink, ResultsRegion, RetryButton } from './DirectoryState';
import FilterBar, { ActiveFilters } from './FilterBar';
import UniversityCard from './UniversityCard';
import UniversityRow from './UniversityRow';
import { FILTER_KEYS, clearedFilters, directoryHref, pageWindow } from './directory-url';
import { CATEGORY_LABELS, OWNERSHIP_LABELS, TYPE_LABELS, formatCount, labelOf } from './labels';
import styles from './Directory.module.css';
import listing from './Listing.module.css';

// Detailed rows by default (photo, fee, placement side by side); the grid is for scanning names
// quickly. The choice is a URL parameter so it survives filtering, sharing and the back button.
const VIEWS = [
  { value: 'list', label: 'Detailed', icon: 'uniRows' },
  { value: 'grid', label: 'Grid', icon: 'uniGrid' },
];

function ViewToggle({ params, view }) {
  return <div className={listing.toggle} role="group" aria-label="Result layout">
    {VIEWS.map((option) => <DirLink key={option.value} href={directoryHref(params, { view: option.value === 'list' ? '' : option.value, page: params.page || '' })}
      aria-current={view === option.value ? 'true' : undefined} toResults={false}>
      <Icon name={option.icon} /><span>{option.label}</span>
    </DirLink>)}
  </div>;
}

const FILTER_NAMES = { state: 'State', city: 'City', type: 'Type', category: 'Category', ownership: 'Ownership', stream: 'Stream', course: 'Course', naac: 'NAAC' };

function Pagination({ params, page, pages }) {
  if (pages <= 1) return null;
  const link = (target) => directoryHref(params, { page: target });
  return <nav className={styles.pagination} aria-label="Result pages">
    {page > 1 ? <DirLink className={styles.pageStep} href={link(page - 1)} rel="prev" toResults><Icon name="arrow" className={styles.flip} /><span>Previous</span></DirLink>
      : <span className={styles.pageStep} aria-disabled="true"><Icon name="arrow" className={styles.flip} /><span>Previous</span></span>}
    <ol>{pageWindow(page, pages).map((value, index) => <li key={value ?? `gap-${index}`}>
      {value == null ? <span className={styles.gap} aria-hidden="true">…</span>
        : value === page ? <span className={styles.pageNumber} aria-current="page"><span className="sr-only">Page </span>{formatCount(value)}</span>
          : <DirLink className={styles.pageNumber} href={link(value)} toResults><span className="sr-only">Page </span>{formatCount(value)}</DirLink>}
    </li>)}</ol>
    {page < pages ? <DirLink className={styles.pageStep} href={link(page + 1)} rel="next" toResults><span>Next</span><Icon name="arrow" /></DirLink>
      : <span className={styles.pageStep} aria-disabled="true"><span>Next</span><Icon name="arrow" /></span>}
  </nav>;
}

export default function DirectoryResults({ params, result, facets, courses, view = 'list' }) {
  const courseNames = Object.fromEntries(courses.map((course) => [course.id, course.name]));
  const list = (rows, labels) => rows.map((row) => ({ value: row.value, label: labels ? labelOf(labels, row.value) : row.value, count: row.count }));
  const showCategory = facets.categories.some((row) => row.value !== 'other') || params.category;
  const groups = [
    { key: 'state', label: 'State / UT', any: 'All of India', options: list(facets.states) },
    { key: 'city', label: 'City', any: params.state ? 'Any city' : 'State first', disabled: !params.state || !facets.cities.length, options: params.state ? list(facets.cities) : [] },
    { key: 'stream', label: 'Stream', options: list(facets.streams) },
    { key: 'course', label: 'Course', options: courses.map((course) => ({ value: course.id, label: course.name })) },
    { key: 'type', label: 'Type', options: list(facets.types, TYPE_LABELS) },
    showCategory && { key: 'category', label: 'Category', options: list(facets.categories, CATEGORY_LABELS) },
    { key: 'ownership', label: 'Ownership', options: list(facets.ownership, OWNERSHIP_LABELS) },
    { key: 'naac', label: 'NAAC grade', disabled: !facets.naac.length && !params.naac, options: list(facets.naac) },
  ].filter(Boolean);

  const display = (key) => (key === 'course' ? courseNames[params[key]] || params[key] : key === 'type' ? labelOf(TYPE_LABELS, params[key])
    : key === 'category' ? labelOf(CATEGORY_LABELS, params[key]) : key === 'ownership' ? labelOf(OWNERSHIP_LABELS, params[key]) : params[key]);
  const chips = [
    params.q && { key: 'q', name: 'Search', label: `“${params.q}”` },
    ...FILTER_KEYS.filter((key) => params[key]).map((key) => ({ key, name: FILTER_NAMES[key], label: display(key) })),
  ].filter(Boolean);

  const page = result.page || 1;
  const pages = result.pages || 1;
  const size = result.limit || 24;
  const from = result.total ? (page - 1) * size + 1 : 0;
  const to = Math.min(result.total, page * size);
  const where = params.city || params.state || 'India';

  return <section id="directory-results" className={styles.results} aria-labelledby="uni-results-title">
    <FilterBar groups={groups} total={result.total} activeCount={chips.length} />
    <div className={`lux-container lux-container--wide ${styles.resultsInner}`}>
      <header className={styles.resultsHead}>
        <div>
          <p className="lux-eyebrow">Results</p>
          <h2 id="uni-results-title" className="lux-display-3" tabIndex={-1}>Universities in {where}</h2>
          <p className={styles.resultsCount} role="status">{result.failed ? 'The directory is temporarily unavailable.'
            : result.total ? <><strong>{formatCount(result.total)}</strong> {result.total === 1 ? 'result' : 'results'}{pages > 1 && <> · showing {formatCount(from)}–{formatCount(to)}</>}</>
              : 'No universities match these filters.'}</p>
        </div>
        <div className={styles.headSide}>
          <ActiveFilters chips={chips} />
          {result.items.length > 0 && <ViewToggle params={params} view={view} />}
        </div>
      </header>

      <ResultsRegion className={styles.region}>
        {result.items.length > 0 ? view === 'grid' ? <ul className={styles.grid}>
          {result.items.map((item) => <li key={item.id}><UniversityCard item={item} courseNames={courseNames} /></li>)}
        </ul> : <ul className={listing.list}>
          {result.items.map((item) => <li key={item.id}><UniversityRow item={item} /></li>)}
        </ul> : <div className={`lux-state ${styles.state}`}>
          <Icon name={result.failed ? 'refresh' : 'search'} />
          <h3 className="lux-title">{result.failed ? 'We could not load the directory' : 'No universities found'}</h3>
          <p className="lux-lead">{result.failed ? 'This is usually temporary. Please try again in a moment.' : 'Try a shorter name, another spelling or fewer filters.'}</p>
          {result.failed ? <RetryButton />
            : chips.length > 0 && <DirLink className="lux-button lux-button--outline" href={directoryHref(params, clearedFilters())}>Clear all filters</DirLink>}
        </div>}
      </ResultsRegion>

      <Pagination params={params} page={page} pages={pages} />
      <p className={styles.note}><Icon name="uniInfo" />Counts cover the whole directory. Fees, approvals and deadlines can change, so confirm details with each institution before you apply.</p>
    </div>
  </section>;
}
