'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import UniversityCard from './UniversityCard';
import { CATEGORY_LABELS, OWNERSHIP_LABELS, SORT_OPTIONS, TYPE_LABELS, formatCount, labelOf } from './labels';
import styles from './Universities.module.css';

const FILTER_KEYS = ['state', 'city', 'type', 'category', 'ownership', 'stream', 'course', 'naac'];

function hrefFor(pathname, params, patch) {
  const next = { ...params, ...patch };
  if (!('page' in patch)) delete next.page;
  if (patch.state !== undefined && patch.state !== params.state) delete next.city;
  const query = new URLSearchParams(Object.entries(next).filter(([key, value]) => value && !(key === 'sort' && value === 'relevance') && !(key === 'page' && String(value) === '1')));
  const text = query.toString();
  return text ? `${pathname}?${text}` : pathname;
}

function Select({ id, label, value, options, onChange, any = 'Any' }) {
  return <label className={styles.filter} htmlFor={id}>
    <span>{label}</span>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{any}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}{option.count != null ? ` (${formatCount(option.count)})` : ''}</option>)}
    </select>
  </label>;
}

// Results are rendered from server data; every filter change is a URL change, so pages are shareable,
// crawlable and work with the back button. Only the search box keeps local state while typing.
export default function UniversityDirectory({ result, facets, params }) {
  const router = useRouter();
  const pathname = usePathname();
  const { courses } = useCatalog();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.q || '');
  const [typedFor, setTypedFor] = useState(params.q || '');
  const timer = useRef(0);
  const headingRef = useRef(null);
  if ((params.q || '') !== typedFor) { setTypedFor(params.q || ''); setQuery(params.q || ''); }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = (patch, { replace = true } = {}) => startTransition(() => {
    const href = hrefFor(pathname, params, patch);
    if (replace) router.replace(href, { scroll: false }); else router.push(href);
  });
  const onQuery = (value) => {
    setQuery(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go({ q: value.trim() }), 300);
  };

  const courseNames = Object.fromEntries(courses.map((course) => [course.id, course.name]));
  const list = (rows, labels) => rows.map((row) => ({ value: row.value, label: labels ? labelOf(labels, row.value) : row.value, count: row.count }));
  const groups = [
    { key: 'state', label: 'State / UT', options: list(facets.states) },
    params.state && facets.cities.length > 0 && { key: 'city', label: 'City', options: list(facets.cities) },
    { key: 'stream', label: 'Stream', options: list(facets.streams) },
    { key: 'course', label: 'Course', options: courses.map((course) => ({ value: course.id, label: course.name })) },
    { key: 'type', label: 'Institution type', options: list(facets.types, TYPE_LABELS) },
    { key: 'category', label: 'Category', options: list(facets.categories, CATEGORY_LABELS) },
    { key: 'ownership', label: 'Ownership', options: list(facets.ownership, OWNERSHIP_LABELS) },
    { key: 'naac', label: 'NAAC grade', options: list(facets.naac) },
  ].filter(Boolean);
  const chips = [
    params.q && { key: 'q', label: `“${params.q}”` },
    ...FILTER_KEYS.filter((key) => params[key]).map((key) => ({ key, label: key === 'course' ? courseNames[params[key]] || params[key] : key === 'type' ? labelOf(TYPE_LABELS, params[key]) : key === 'category' ? labelOf(CATEGORY_LABELS, params[key]) : key === 'ownership' ? labelOf(OWNERSHIP_LABELS, params[key]) : params[key] })),
  ].filter(Boolean);
  const clearAll = () => { setQuery(''); go(Object.fromEntries(['q', ...FILTER_KEYS].map((key) => [key, '']))); headingRef.current?.focus(); };
  // Rendered twice (desktop sidebar, mobile disclosure), so each copy gets its own ids.
  const filtersPanel = (prefix) => <div className={styles.filters}>{groups.map((group) => <Select key={group.key} id={`${prefix}-filter-${group.key}`} label={group.label} value={params[group.key] || ''} options={group.options} onChange={(value) => go({ [group.key]: value })} />)}</div>;

  const page = result.page || 1;
  const pages = result.pages || 1;
  const from = result.total ? (page - 1) * (result.limit || 24) + 1 : 0;
  const to = Math.min(result.total, page * (result.limit || 24));
  const where = params.city || params.state || 'India';

  return <div className={`container ${styles.layout}`}>
    <aside className={styles.sidebar} aria-labelledby="uni-filters-title">
      <div className={styles.sidebarHead}><h2 id="uni-filters-title"><Icon name="filter" />Filters</h2>{chips.length > 0 && <button type="button" className="text-link" onClick={clearAll}>Clear all</button>}</div>
      {filtersPanel('side')}
      <p className={styles.note}><Icon name="collegesInfo" />Counts cover the whole directory. Confirm details with each institution before you apply.</p>
    </aside>

    <section className={styles.results} aria-labelledby="uni-results-title" aria-busy={pending}>
      <form role="search" className={styles.search} onSubmit={(event) => { event.preventDefault(); window.clearTimeout(timer.current); go({ q: query.trim() }); }}>
        <label htmlFor="university-search" className="sr-only">Search universities</label>
        <Icon name="search" />
        <input id="university-search" className="field" type="search" placeholder="Search by name, short name, city or state" autoComplete="off" maxLength={120} value={query} onChange={(event) => onQuery(event.target.value)} enterKeyHint="search" />
        {pending && <span className={styles.spinner} aria-hidden="true" />}
      </form>

      <details className={styles.mobileFilters}>
        <summary><Icon name="filter" />Filters{chips.length > 0 && <span className={styles.countBadge}>{chips.length}</span>}</summary>
        {filtersPanel('sheet')}
      </details>

      <div className={styles.resultsHead}>
        <div>
          <h2 id="uni-results-title" ref={headingRef} tabIndex={-1}>Universities in {where}</h2>
          <p role="status" aria-live="polite">{result.failed ? 'The directory is temporarily unavailable.' : result.total ? <><strong>{formatCount(result.total)}</strong> {result.total === 1 ? 'result' : 'results'} · showing {formatCount(from)}–{formatCount(to)}</> : 'No universities match these filters.'}</p>
        </div>
        <label className={styles.sort} htmlFor="uni-sort"><Icon name="collegesSort" /><span>Sort</span>
          <select id="uni-sort" value={params.sort || 'relevance'} onChange={(event) => go({ sort: event.target.value })}>{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </label>
      </div>

      {chips.length > 0 && <div className={styles.chips}>
        <ul aria-label="Active filters">{chips.map((chip) => <li key={chip.key}><button type="button" className="chip" aria-label={`Remove filter: ${chip.label}`} onClick={() => { if (chip.key === 'q') setQuery(''); go({ [chip.key]: '' }); }}>{chip.label}<Icon name="close" /></button></li>)}</ul>
        <button type="button" className="text-link" onClick={clearAll}>Clear all</button>
      </div>}

      {result.items.length > 0 ? <ul className={styles.list} data-pending={pending || undefined}>
        {result.items.map((item) => <li key={item.id}><UniversityCard item={item} courseNames={courseNames} /></li>)}
      </ul> : <div className={styles.empty}>
        <span><Icon name="search" /></span>
        <h3>{result.failed ? 'We could not load the directory' : 'No universities found'}</h3>
        <p>{result.failed ? 'Please try again in a moment.' : 'Try a shorter name, another spelling or fewer filters.'}</p>
        {result.failed ? <button type="button" className="button button--primary" onClick={() => router.refresh()}>Try again</button>
          : chips.length > 0 && <button type="button" className="button button--outline" onClick={clearAll}>Clear all filters</button>}
      </div>}

      {pages > 1 && <nav className={styles.pagination} aria-label="Result pages">
        {page > 1 ? <Link href={hrefFor(pathname, params, { page: page - 1 })} rel="prev" scroll><Icon name="arrow" className={styles.back} />Previous</Link> : <span aria-disabled="true"><Icon name="arrow" className={styles.back} />Previous</span>}
        <span>Page {formatCount(page)} of {formatCount(pages)}</span>
        {page < pages ? <Link href={hrefFor(pathname, params, { page: page + 1 })} rel="next" scroll>Next<Icon name="arrow" /></Link> : <span aria-disabled="true">Next<Icon name="arrow" /></span>}
      </nav>}
    </section>
  </div>;
}
