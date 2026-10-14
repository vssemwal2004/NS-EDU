'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { DestinationArt } from '@/features/landing/LocationArtwork';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { countByPlace, emptyCount, placeHref, plural } from './placeCounts';
import styles from './Destinations.module.css';

const types = [{ id: 'all', label: 'All' }, { id: 'cities', label: 'Cities' }, { id: 'states', label: 'States' }];
const sorts = [{ id: 'az', label: 'A–Z' }, { id: 'most', label: 'Most programmes' }];
const byName = (a, b) => a.name.localeCompare(b.name);
const byProgrammes = (a, b) => b.count.programmes - a.count.programmes || b.count.institutions - a.count.institutions || byName(a, b);

function syncUrl(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); });
  window.history.replaceState(window.history.state, '', url);
}

export default function DestinationsDirectory({ initialQuery = '', initialType = 'all', initialHas = false, initialSort = 'az' }) {
  const { courses, colleges, cities, states } = useCatalog();
  const { course, setCourse } = usePreferences();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(types.some((item) => item.id === initialType) ? initialType : 'all');
  const [has, setHas] = useState(Boolean(initialHas));
  const [sort, setSort] = useState(sorts.some((item) => item.id === initialSort) ? initialSort : 'az');
  const counts = useMemo(() => countByPlace(colleges, course), [colleges, course]);
  const courseNames = useMemo(() => new Map(courses.map((item) => [item.id, item.name])), [courses]);
  const courseName = courseNames.get(course);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  const pick = (places) => places
    .map((place) => ({ ...place, count: counts.get(place.name) || emptyCount }))
    .filter((place) => terms.every((term) => place.name.toLocaleLowerCase().includes(term)) && (!has || place.count.programmes))
    .toSorted(sort === 'most' ? byProgrammes : byName);
  const groups = [
    { id: 'cities', title: 'Cities', noun: 'city', items: pick(cities), shown: type !== 'states' },
    { id: 'states', title: 'States', noun: 'state', items: pick(states), shown: type !== 'cities' },
  ].filter((group) => group.shown);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const filtered = Boolean(terms.length || type !== 'all' || has);
  const active = [terms.length && `“${query.trim()}”`, type !== 'all' && types.find((item) => item.id === type).label.toLowerCase(), has && 'only places with sample colleges'].filter(Boolean);

  function update(patch) {
    const next = { query, type, has, sort, ...patch };
    if ('query' in patch) setQuery(patch.query);
    if ('type' in patch) setType(patch.type);
    if ('has' in patch) setHas(patch.has);
    if ('sort' in patch) setSort(patch.sort);
    syncUrl({ q: next.query.trim(), type: next.type === 'all' ? '' : next.type, has: next.has ? '1' : '', sort: next.sort === 'az' ? '' : next.sort });
  }
  const clear = () => update({ query: '', type: 'all', has: false });

  return <section id="all-destinations" className={styles.directory} aria-labelledby="all-destinations-title">
    <div className="container">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}><Icon name="map" />Directory</p>
          <h2 id="all-destinations-title">All destinations</h2>
          <p>Every city and state in the catalogue, with the number of illustrative sample programmes in each. Open one to see its colleges.</p>
        </div>
      </div>

      <form className={styles.toolbar} role="search" aria-label="Filter destinations" onSubmit={(event) => event.preventDefault()}>
        <label className={styles.search}><Icon name="search" /><span className="sr-only">Search cities and states</span>
          <input type="search" value={query} placeholder="Search a city or state, e.g. Pune" maxLength={80} autoComplete="off" onChange={(event) => update({ query: event.target.value })} />
        </label>
        <div className={styles.segmented} role="group" aria-label="Place type">
          {types.map((item) => <button key={item.id} type="button" aria-pressed={type === item.id} onClick={() => update({ type: item.id })}>{item.label}</button>)}
        </div>
        <label className={styles.select}><span>Counts for</span>
          <select value={course} onChange={(event) => setCourse(event.target.value)}>
            <option value="">All courses</option>
            {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select><Icon name="chevron" />
        </label>
        <label className={styles.select}><span>Sort</span>
          <select value={sort} onChange={(event) => update({ sort: event.target.value })}>
            {sorts.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select><Icon name="chevron" />
        </label>
        <label className={styles.check}><input type="checkbox" checked={has} onChange={(event) => update({ has: event.target.checked })} /><span>Only places with sample colleges</span></label>
      </form>

      <div className={styles.status}>
        <p role="status">{plural(total, 'place')}{active.length ? ` · ${active.join(' · ')}` : ''} · counts for {courseName || 'all courses'}</p>
        {filtered && <button type="button" className="text-link" onClick={clear}>Clear filters<Icon name="close" /></button>}
      </div>

      {total ? groups.map((group) => <section key={group.id} id={group.id} className={styles.group} aria-labelledby={`${group.id}-title`}>
        <h3 id={`${group.id}-title`}>{group.title}<span>{group.items.length}</span></h3>
        {group.items.length ? <ul className={styles.list}>
          {group.items.map((place) => <li key={place.name}>
            <Link className={styles.row} href={placeHref(place.name, course)} data-empty={!place.count.programmes}>
              <span className={styles.thumb} aria-hidden="true">{place.crop ? <DestinationArt destination={place} className={styles.thumbArt} /> : <Icon name="location" />}</span>
              <span className={styles.rowBody}>
                <span className={styles.rowTitle}><strong>{place.name}</strong><span className={styles.tag}>{group.id === 'cities' ? (/\bNCR\b/.test(place.name) ? 'City / region' : 'City') : 'State'}</span></span>
                <span className={styles.rowMeta}>{place.count.programmes ? `${plural(place.count.programmes, 'sample programme')} · ${plural(place.count.institutions, 'institution')}` : 'No sample colleges yet'}</span>
                {!course && place.count.courseIds.length > 0 && <span className={styles.rowCourses}>{place.count.courseIds.slice(0, 3).map((id) => courseNames.get(id) || id).join(' · ')}{place.count.courseIds.length > 3 ? ` +${place.count.courseIds.length - 3}` : ''}</span>}
              </span>
              <Icon name="arrow" className={styles.rowArrow} />
            </Link>
          </li>)}
        </ul> : <p className={styles.groupEmpty}>No {group.title.toLowerCase()} match these filters.</p>}
      </section>) : <div className={styles.empty}>
        <Icon name="map" />
        <h3>No destinations match</h3>
        <p>Nothing matches {active.join(', ') || 'these filters'}{courseName ? ` for ${courseName}` : ''}. Try a broader search or include places without sample colleges.</p>
        <button type="button" className="button button--outline" onClick={clear}>Clear filters</button>
      </div>}
      <p className={styles.footnote}>Counts come from the illustrative sample catalogue (fictional institutions) — they are not a measure of real colleges in a place. Places without sample colleges still open the college finder.</p>
    </div>
  </section>;
}
