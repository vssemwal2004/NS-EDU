'use client';
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { FEE_LIMITS, RATING_FLOORS, SORT_OPTIONS, facetCounts, filterPrograms, formatLakh, groupByInstitution, lakhRange, lpaRange, resolveLocation, sortGroups, summarize } from '@/lib/college-catalog';
import { useCompare } from './compareStore';
import { GROUPS } from './FilterGroups';
import FilterDrawer from './FilterDrawer';
import CollegeCard from './CollegeCard';
import CompareTray, { CompareGroups } from './CompareTray';
import styles from './Listing.module.css';

const PAGE = 8;
const SORTS = SORT_OPTIONS.map((item) => item.value);
const EMPTY = { field: '', course: '', location: '', fee: '', rating: '', sort: 'default', q: '' };
const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;
const institutionCount = (rows) => new Set(rows.map((row) => row.collegeId)).size;

// One canonical filter state: a course implies its field, so an explicit field is kept only without a course.
function normalize(input, courseById, fields, records) {
  const value = { ...EMPTY, ...input };
  let course = courseById.has(value.course) ? value.course : '';
  let field = fields.find((item) => item.toLocaleLowerCase() === String(value.field).toLocaleLowerCase()) || '';
  if (course && field && courseById.get(course).field !== field) course = '';
  if (course) field = '';
  const rating = value.rating && Number.isFinite(Number(value.rating)) ? Number(value.rating).toFixed(1) : '';
  return {
    field,
    course,
    location: resolveLocation(records, value.location)?.name || '',
    fee: FEE_LIMITS.map(String).includes(String(value.fee)) ? String(value.fee) : '',
    rating: RATING_FLOORS.includes(rating) ? rating : '',
    sort: SORTS.includes(value.sort) ? value.sort : 'default',
    q: String(value.q || '').slice(0, 80),
  };
}
const fieldOf = (filters, courseById) => (filters.course ? courseById.get(filters.course)?.field || '' : filters.field);
const criteriaOf = (filters, courseById) => ({ field: fieldOf(filters, courseById), courseId: filters.course, location: filters.location, maxFee: filters.fee, minRating: filters.rating, query: filters.q });
function patchFor(key, value, current, courseById) {
  if (key === 'field') return { field: value, course: value && courseById.get(current.course)?.field === value ? current.course : '' };
  if (key === 'course') return { course: value, field: value ? '' : fieldOf(current, courseById) };
  return { [key]: value };
}
const signature = (filters) => JSON.stringify({ ...filters, q: filters.q.trim() });
function syncUrl(filters) {
  const url = new URL(window.location.href);
  const values = { course: filters.course, field: filters.field, location: filters.location, fee: filters.fee, rating: filters.rating, sort: filters.sort === 'default' ? '' : filters.sort, q: filters.q.trim() };
  for (const [key, value] of Object.entries(values)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
  window.history.replaceState(window.history.state, '', url);
}

export default function CollegeListing({ initial }) {
  const { courses, colleges } = useCatalog();
  const preferences = usePreferences();
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const options = useMemo(() => {
    const offered = new Set(colleges.map((row) => row.courseId));
    const list = courses.filter((course) => offered.has(course.id)).toSorted((a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)));
    return {
      courses: list,
      fields: [...new Set(list.map((course) => course.field).filter(Boolean))],
      states: [...new Set(colleges.map((row) => row.state).filter(Boolean))].sort(),
      cities: [...new Set(colleges.map((row) => row.city).filter(Boolean))].sort(),
    };
  }, [courses, colleges]);
  const clean = (value) => normalize(value, courseById, options.fields, colleges);

  const [filters, setFilters] = useState(() => clean(initial));
  const [queryInput, setQueryInput] = useState(filters.q);
  const [limit, setLimit] = useState(PAGE);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState(null);
  const [draft, setDraft] = useState(null);
  const [tab, setTab] = useState('field');
  const [trayOpen, setTrayOpen] = useState(true);
  const drawerRef = useRef(null);
  const sheetRef = useRef(null);
  const headingRef = useRef(null);
  const timer = useRef(0);
  const compare = useCompare(colleges);

  // Links to /colleges?… from the header or the location chips can land on this mounted page:
  // re-read the address whenever it changes (our own replaceState writes parse back to the same state).
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const [syncedKey, setSyncedKey] = useState(urlKey);
  // Skip intermediate router states that are already behind the address bar (rapid replaceState calls).
  if (urlKey !== syncedKey && urlKey === new URLSearchParams(window.location.search).toString()) {
    setSyncedKey(urlKey);
    const next = clean(Object.fromEntries(searchParams));
    if (signature(next) !== signature(filters)) { setFilters(next); setQueryInput(next.q); setLimit(PAGE); setNotice(null); }
  }

  const criteria = criteriaOf(filters, courseById);
  const rows = filterPrograms(colleges, criteria, courses);
  const groups = sortGroups(groupByInstitution(rows), filters.sort);
  const counts = facetCounts(colleges, criteria, courses);
  const summary = summarize(rows);
  const place = resolveLocation(colleges, filters.location);
  const unknownPlace = place?.type === 'unknown';
  const course = courseById.get(filters.course);
  const field = fieldOf(filters, courseById);
  const groupValue = { ...filters, field };
  const shown = groups.slice(0, limit);
  const countOf = (value) => institutionCount(filterPrograms(colleges, criteriaOf(clean(value), courseById), courses));

  function commit(patch) {
    window.clearTimeout(timer.current);
    const next = clean({ ...filters, q: queryInput, ...patch });
    setFilters(next);
    setLimit(PAGE);
    setNotice(null);
    syncUrl(next);
    if (patch.course && next.course !== preferences.course) preferences.setCourse(next.course);
    return next;
  }
  const change = (key, value) => commit(patchFor(key, value, filters, courseById));
  function onQuery(value) {
    setQueryInput(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit({ q: value }), 200);
  }
  function clearQuery() { setQueryInput(''); commit({ q: '' }); }
  function removeChip(patch) {
    if ('q' in patch) setQueryInput('');
    commit(patch);
    headingRef.current?.focus();
  }
  function clearAll() {
    setQueryInput('');
    commit({ ...EMPTY, sort: filters.sort });
    headingRef.current?.focus();
  }
  function relax(item) {
    if ('q' in item.patch) setQueryInput('');
    commit(item.patch);
    setStatus(`${item.label}: ${plural(item.count, 'college')}.`);
  }

  function toggleCompare(row) {
    const name = courseById.get(row.courseId)?.name || row.courseId;
    const before = compare.count(row.courseId);
    const result = compare.toggle(row);
    const text = result === 'full' ? `You can compare up to 3 ${name} colleges. Remove one to add another.`
      : result === 'added' ? `${row.shortName} (${name}) added to compare · ${before + 1}/3.`
        : `${row.shortName} (${name}) removed from compare.`;
    setStatus(text);
    setNotice({ id: row.collegeId, courseId: row.courseId, text, full: result === 'full' });
    if (result === 'added') setTrayOpen(true);
  }
  function removeCompare(row) {
    compare.remove(row);
    setStatus(`${row.shortName} (${courseById.get(row.courseId)?.name || row.courseId}) removed from compare.`);
  }
  function showMore() {
    const index = limit;
    flushSync(() => setLimit(Infinity));
    document.getElementById(`card-${groups[index]?.id}`)?.focus();
  }

  // Mobile drawer edits a draft copy; only "Show N colleges" applies it.
  function openDrawer(which) {
    flushSync(() => { setDraft({ ...filters, q: queryInput }); setTab(which); });
    drawerRef.current?.showModal();
  }
  const draftCriteria = draft && criteriaOf(draft, courseById);
  const draftTotal = draft ? institutionCount(filterPrograms(colleges, draftCriteria, courses)) : 0;
  function applyDraft() { setQueryInput(draft.q); commit(draft); drawerRef.current?.close(); headingRef.current?.focus(); }

  const chips = [
    filters.q.trim() && { key: 'q', label: `“${filters.q.trim()}”`, patch: { q: '' } },
    filters.field && { key: 'field', label: filters.field, patch: { field: '' } },
    course && { key: 'course', label: course.name, patch: { course: '', field: '' } },
    filters.location && { key: 'location', label: filters.location, patch: { location: '' } },
    filters.fee && { key: 'fee', label: `Up to ${formatLakh(Number(filters.fee))}/yr`, patch: { fee: '' } },
    filters.rating && { key: 'rating', label: `Demo rating ${filters.rating}+`, patch: { rating: '' } },
  ].filter(Boolean);

  const relaxations = [];
  if (!groups.length) {
    const tryPatch = (label, patch) => { const count = countOf({ ...filters, ...patch }); if (count) relaxations.push({ label, patch, count }); };
    if (filters.q.trim()) tryPatch(`Clear search “${filters.q.trim()}”`, { q: '' });
    if (filters.fee) tryPatch('Remove the tuition limit', { fee: '' });
    if (filters.rating) tryPatch('Any demo rating', { rating: '' });
    if (place?.type === 'city' && place.state) tryPatch(`All of ${place.state}`, { location: place.state });
    if (filters.location) tryPatch('Search all India', { location: '' });
    if (course && field) tryPatch(`Any ${field} course`, { course: '', field });
    if (course) tryPatch('Any course', { course: '', field: '' });
    if (filters.field) tryPatch('Any field', { field: '' });
    relaxations.sort((a, b) => b.count - a.count).splice(3);
  }

  const places = [...options.states, ...options.cities].map((name) => ({ name, count: institutionCount(colleges.filter((row) => row.city === name || row.state === name)) }));
  const scope = course?.name || field || 'All courses';
  const title = `${course?.name || field || 'All'} colleges in ${filters.location || 'India'}`;
  const sortLabel = SORT_OPTIONS.find((item) => item.value === filters.sort)?.label;

  return <div className={styles.listing}>
    <div className={styles.strip}>
      <div className="container">
        <div className={styles.stripInner} role="group" aria-label="Choose a course">
          <button type="button" aria-pressed={!filters.course} onClick={() => commit({ course: '', field: '' })}>All courses</button>
          {options.courses.map((item) => <button key={item.id} type="button" aria-pressed={filters.course === item.id} onClick={() => commit({ course: item.id, field: '' })}><Icon name={item.icon} />{item.name}</button>)}
        </div>
      </div>
    </div>

    <div className={`container ${styles.layout}`}>
      <aside className={styles.sidebar} aria-labelledby="filters-title">
        <div className={styles.sidebarHead}>
          <h2 id="filters-title"><Icon name="collegesSliders" />Filters</h2>
          {chips.length > 0 && <button type="button" className="text-link" onClick={clearAll}>Clear all</button>}
        </div>
        {GROUPS.map(({ id, Component }) => <Component key={id} name="side" value={groupValue} counts={counts} options={options} onChange={change} unknown={unknownPlace} />)}
        <p className={styles.sidebarNote}><Icon name="collegesInfo" />Counts are institutions matching your other filters.</p>
      </aside>

      <section className={styles.results} aria-labelledby="results-title">
        <div className={styles.search}>
          <label htmlFor="college-search" className="sr-only">Search within results</label>
          <Icon name="search" />
          <input id="college-search" className="field" type="search" placeholder="Search by college, city or course" autoComplete="off" value={queryInput}
            onChange={(event) => onQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape' && queryInput) { event.preventDefault(); clearQuery(); } }} />
          {queryInput && <button type="button" className={styles.searchClear} aria-label="Clear search" onClick={clearQuery}><Icon name="close" /></button>}
        </div>

        <div className={styles.resultsHead}>
          <div>
            <h2 id="results-title" ref={headingRef} tabIndex={-1}>{title}</h2>
            <p role="status" aria-live="polite" className={styles.resultCount}><strong>{plural(groups.length, 'college')}</strong> · {plural(rows.length, 'programme')} · {scope} · {filters.location || 'All India'}</p>
          </div>
          <div className={styles.headTools}>
            <span className={styles.badge}><Icon name="collegesInfo" />Illustrative data</span>
            <label className={styles.sort}><Icon name="collegesSort" /><span>Sort</span>
              <select value={filters.sort} onChange={(event) => change('sort', event.target.value)}>{SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </label>
          </div>
        </div>

        {chips.length > 0 && <div className={styles.chips}>
          <ul aria-label="Active filters">{chips.map((chip) => <li key={chip.key}><button type="button" className="chip" aria-label={`Remove filter: ${chip.label}`} onClick={() => removeChip(chip.patch)}>{chip.label}<Icon name="close" /></button></li>)}</ul>
          <button type="button" className="text-link" onClick={clearAll}>Clear all</button>
        </div>}

        {rows.length > 0 && <dl className={styles.insight} aria-label="Summary of these results">
          <div><dt><Icon name="collegesRupee" />Annual tuition</dt><dd>{lakhRange(summary.feeMin, summary.feeMax)}</dd></div>
          <div><dt><Icon name="collegesBriefcase" />Median package</dt><dd>{lpaRange(summary.medianMin, summary.medianMax)}</dd></div>
          <div><dt><Icon name="chart" />Placement data</dt><dd>{summary.withPlacements} of {plural(summary.programmes, 'programme')} report</dd></div>
          <div><dt><Icon name="calendar" />Data years</dt><dd>Fees {summary.tuitionYear} · placements {summary.placementYear}</dd></div>
        </dl>}

        {groups.length > 0 ? <ul className={styles.list}>
          {shown.map((group) => <li key={group.id}>
            <CollegeCard group={group} courseById={courseById} budgetCourse={filters.course} compare={compare} onToggle={toggleCompare} notice={notice?.id === group.id ? notice : null} />
          </li>)}
        </ul> : <div className={styles.empty}>
          <span className={styles.emptyIcon}><Icon name="search" /></span>
          <h3>{unknownPlace ? `No listed colleges in ${filters.location} yet` : 'No colleges match all of these filters'}</h3>
          <p>{relaxations.length ? 'Try one of these changes. Each shows how many colleges it would bring back.' : 'Clear the filters to see every listed college.'}</p>
          {relaxations.length > 0 && <ul className={styles.relaxations}>{relaxations.map((item) => <li key={item.label}><button type="button" className="button button--outline" onClick={() => relax(item)}>{item.label}<span>{plural(item.count, 'college')}</span></button></li>)}</ul>}
          <button type="button" className="text-link" onClick={clearAll}>Clear all filters<Icon name="arrow" /></button>
        </div>}

        {groups.length > limit && <div className={styles.more}>
          <button type="button" className="button button--outline" onClick={showMore}>Show {plural(groups.length - limit, 'more college')}<Icon name="chevron" /></button>
          <small>Showing {limit} of {groups.length}</small>
        </div>}

        <section className={styles.browse} aria-labelledby="browse-title">
          <div className={styles.browseHead}><h2 id="browse-title">Browse colleges by location</h2><Link className="text-link" href="/locations">Study locations<Icon name="arrow" /></Link></div>
          <ul>{places.map((item) => <li key={item.name}><Link className="chip" href={`/colleges?location=${encodeURIComponent(item.name)}`} aria-current={filters.location === item.name ? 'true' : undefined}><Icon name="location" />{item.name}<span>{item.count}</span></Link></li>)}</ul>
        </section>

        <section className={styles.notes} aria-labelledby="notes-title">
          <h2 id="notes-title"><Icon name="collegesInfo" />How to read these figures</h2>
          <ul>
            <li><strong>Annual tuition</strong> is the tuition fee for one year only. Hostel, meals, exam and one-time fees are extra. <Link href={course ? `/budget?course=${course.id}` : '/budget'}>Estimate the full cost</Link>.</li>
            <li><strong>Demo rating</strong> is an illustrative score for this preview. It is not a ranking, and it is not based on student reviews.</li>
            <li><strong>Median and highest packages</strong> are placement figures for {summary.placementYear || '2024–25'}. “Not provided” means the record has no placement data.</li>
            <li><strong>Institutions are illustrative.</strong> Confirm eligibility, fees and deadlines with each institution before you apply. <Link href="/admission-checklist">Admission checklist</Link>.</li>
          </ul>
        </section>
      </section>
    </div>

    <CompareTray compare={compare} courseById={courseById} onRemove={removeCompare} open={trayOpen} onToggle={() => setTrayOpen((value) => !value)} />

    <nav className={styles.dock} aria-label="Filter, sort and compare" data-colleges-dock>
      <button type="button" onClick={() => openDrawer('field')}><Icon name="collegesSliders" />Filters{chips.length > 0 && <span className={styles.dockBadge} aria-label={`${chips.length} active`}>{chips.length}</span>}</button>
      <button type="button" onClick={() => openDrawer('sort')}><Icon name="collegesSort" />Sort<small>{filters.sort === 'default' ? '' : sortLabel}</small></button>
      {compare.total > 0 && <button type="button" onClick={() => sheetRef.current?.showModal()}><Icon name="compare" />Compare<span className={styles.dockBadge}>{compare.total}</span></button>}
    </nav>

    <FilterDrawer dialogRef={drawerRef} draft={draft} tab={tab} onTab={setTab} total={draftTotal} options={options} unknown={draft ? resolveLocation(colleges, draft.location)?.type === 'unknown' : false}
      counts={draft ? facetCounts(colleges, draftCriteria, courses) : counts}
      onChange={(key, value) => setDraft((current) => clean({ ...current, ...patchFor(key, value, current, courseById) }))}
      onClear={() => setDraft((current) => ({ ...EMPTY, sort: current.sort, q: '' }))}
      onApply={applyDraft} />

    <dialog ref={sheetRef} className={styles.sheet} aria-labelledby="compare-sheet-title" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <div className={styles.drawerHead}>
        <div><h2 id="compare-sheet-title">Compare shortlist</h2><p>{plural(compare.total, 'college')} · up to 3 per course</p></div>
        <button type="button" className="icon-button" aria-label="Close compare shortlist" onClick={() => sheetRef.current?.close()}><Icon name="close" /></button>
      </div>
      {compare.total > 0 ? <CompareGroups compare={compare} courseById={courseById} onRemove={removeCompare} /> : <p className={styles.sheetEmpty}>Your shortlist is empty. Use “Add to compare” on any college.</p>}
    </dialog>

    <p className="sr-only" role="status" aria-live="polite">{status}</p>
  </div>;
}
