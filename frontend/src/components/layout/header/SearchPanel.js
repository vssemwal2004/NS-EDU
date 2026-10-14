'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { filterCollegeRecords } from '@/lib/college-catalog';
import { courseTools } from '@/data/navigation';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { collegesHref, examHref, plural, withCourse } from './catalog-nav';
import { readRecent, rememberSearch, useCatalogNav, writeRecent } from './useCatalogNav';
import styles from './Search.module.css';

const empty = { courses: [], exams: [], colleges: [] };
const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const squash = (value) => normalise(value).replace(/ /g, '');
// Common alternative city names students type.
const aliases = { bangalore: 'Bengaluru', bombay: 'Mumbai', madras: 'Chennai', delhi: 'Delhi NCR', ncr: 'Delhi NCR', noida: 'Delhi NCR', gurgaon: 'Delhi NCR', gurugram: 'Delhi NCR', calcutta: 'Kolkata' };

// "B.Tech colleges in Pune" rows generated from the catalogue, with real counts.
function courseCityRows(query, { courses, colleges, cityNames, stateNames }) {
  const words = normalise(query).split(' ').filter(Boolean);
  if (!words.length) return { courseHits: [], rows: [] };
  const candidates = [...words, ...words.slice(1).map((word, index) => words[index] + word)];
  const phrase = normalise(query);
  const courseHits = courses.filter((course) => {
    const name = squash(course.name);
    return candidates.some((word) => word === name || word === course.id || (word.length >= 2 && name.startsWith(word)) || (word.length >= 4 && normalise(course.field).startsWith(word)))
      || (phrase.length >= 5 && normalise(course.fullName || '').includes(phrase));
  });
  const places = [...cityNames, ...stateNames].filter((name) => {
    const parts = normalise(name).split(' ');
    return phrase.includes(normalise(name)) || candidates.some((word) => word.length >= 3 && parts.some((part) => part.startsWith(word)));
  });
  words.forEach((word) => { if (aliases[word] && !places.includes(aliases[word])) places.push(aliases[word]); });
  const count = (courseId, location) => filterCollegeRecords(colleges, { courseId, location }).length;
  const rows = [];
  if (courseHits.length && places.length) courseHits.forEach((course) => places.forEach((place) => rows.push({ course, place, count: count(course.id, place) })));
  else if (places.length) places.forEach((place) => courses.forEach((course) => rows.push({ course, place, count: count(course.id, place) })));
  else courseHits.forEach((course) => cityNames.forEach((place) => rows.push({ course, place, count: count(course.id, place) })));
  return {
    courseHits,
    rows: rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count || Number(b.course.popular) - Number(a.course.popular)).slice(0, 5),
  };
}

// Highlights query words, tolerating the dots and spaces in names such as "B.Tech".
function Highlight({ text, words }) {
  const usable = words.map((word) => [...word].map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[.\\s-]?'));
  if (!usable.length) return text;
  const pattern = new RegExp(`(${usable.join('|')})`, 'gi');
  return String(text).split(pattern).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part);
}

export default function SearchPanel({ id, onSubmit, onClose }) {
  const catalog = useCatalog();
  const { courses, colleges, findCourse } = catalog;
  const { popular, cities } = useCatalogNav();
  const { course: preferredCourse, city: preferredCity } = usePreferences();
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState({ query: '', data: empty, state: 'idle' });
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const input = useRef(null);
  const trimmed = query.trim();

  // Reset the highlighted option whenever the query changes.
  const [lastQuery, setLastQuery] = useState(trimmed);
  if (lastQuery !== trimmed) { setLastQuery(trimmed); setActive(-1); }

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!trimmed) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRemote((previous) => ({ ...previous, state: 'loading' }));
      api(`/catalog/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((data) => setRemote({ query: trimmed, data: { ...empty, ...data }, state: 'done' }))
        .catch((error) => { if (error.name !== 'AbortError') setRemote({ query: trimmed, data: empty, state: 'error' }); });
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [trimmed]);

  const status = !trimmed ? 'idle' : remote.query === trimmed ? remote.state : 'loading';
  const words = normalise(trimmed).split(' ').filter(Boolean);

  const groups = useMemo(() => {
    if (!trimmed) return [];
    const data = remote.data;
    const local = courseCityRows(trimmed, catalog);
    // Server matches first, then catalogue matches the phrase search missed (e.g. "btech pune").
    const courseMatches = [...data.courses, ...local.courseHits.filter((hit) => !data.courses.some((item) => item.id === hit.id))];
    return [
      { id: 'combos', title: 'Colleges by course & city', illustrative: true, items: local.rows.map((row) => ({ key: `combo-${row.course.id}-${row.place}`, href: collegesHref(row.course.id, row.place), icon: 'location', label: `${row.course.name} colleges in ${row.place}`, meta: plural(row.count, 'programme'), type: 'Colleges' })) },
      { id: 'courses', title: 'Courses', items: courseMatches.slice(0, 4).map((item) => ({ key: `course-${item.id}`, href: collegesHref(item.id), icon: item.icon, label: item.name, meta: [item.fullName || item.field, plural(colleges.filter((row) => row.courseId === item.id).length, 'programme')].join(' · '), type: 'Course' })) },
      { id: 'colleges', title: 'Colleges', illustrative: true, items: data.colleges.filter((item) => item.courses?.length).slice(0, 4).map((item) => ({ key: `college-${item.id}`, href: collegesHref(item.courses[0], item.city), icon: 'building', label: item.name, meta: [[item.city, item.state].filter(Boolean).join(', '), item.courses.map((courseId) => catalog.findCourse(courseId)?.name || courseId).join(', ')].filter(Boolean).join(' · '), type: 'College' })) },
      { id: 'exams', title: 'Exams', items: data.exams.slice(0, 3).map((item) => ({ key: `exam-${item.id}`, href: examHref(item.id), icon: item.icon, label: item.name, meta: `${item.field} entrance exam`, type: 'Exam' })) },
    ].filter((group) => group.items.length);
  }, [trimmed, remote.data, catalog, colleges]);
  const options = groups.flatMap((group) => group.items);
  const activeOption = options[active];
  const optionId = (index) => `${listId}-option-${index}`;

  useEffect(() => { if (active >= 0) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, listId]);

  const remember = (value = trimmed) => setRecent(rememberSearch(value));
  const choose = (option) => { remember(); onClose(false); router.push(option.href); };
  const submit = (value = trimmed) => { if (value) remember(value); onSubmit(value); };
  const onInputKey = (event) => {
    const count = options.length;
    if (event.key === 'ArrowDown' && count) { event.preventDefault(); setActive((active + 1) % count); }
    else if (event.key === 'ArrowUp' && count) { event.preventDefault(); setActive(active <= 0 ? count - 1 : active - 1); }
    else if ((event.key === 'Home' || event.key === 'End') && activeOption) { event.preventDefault(); setActive(event.key === 'Home' ? 0 : count - 1); }
    else if (event.key === 'Enter' && activeOption) { event.preventDefault(); choose(activeOption); }
  };
  const onPanelKey = (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (activeOption && event.target === input.current) setActive(-1);
    else onClose(true);
  };

  const preferred = findCourse(preferredCourse);
  const cityHref = (city) => collegesHref(preferred && filterCollegeRecords(colleges, { courseId: preferred.id, location: city.name }).length ? preferred.id : city.courseId, city.name);
  const preferenceTarget = preferred?.id || cities.find((item) => item.name === preferredCity)?.courseId;

  return <div id={id} className={styles.panel} role="dialog" aria-label="Search NSEDU" onKeyDown={onPanelKey}>
    <div className={`container ${styles.inner}`}>
      <form role="search" className={styles.form} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <Icon name="search" />
        <label className="sr-only" htmlFor={`${id}-input`}>Search colleges, courses, exams and cities</label>
        <input ref={input} id={`${id}-input`} type="text" role="combobox" aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeOption ? optionId(active) : undefined}
          value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onInputKey}
          placeholder="Try “B.Tech in Pune”, “MBA” or “NEET”" maxLength={120} autoComplete="off" spellCheck={false} enterKeyHint="search" />
        {query && <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}><Icon name="close" /></button>}
        <button type="submit" className="button button--primary">Search</button>
      </form>

      <div className={styles.body}>
        <div className={styles.main}>
          {!trimmed && <>
            <section aria-labelledby={`${id}-popular`}>
              <p className={styles.label} id={`${id}-popular`}>Popular courses</p>
              <ul className={styles.tiles}>{popular.map((item) => <li key={item.id}><Link href={collegesHref(item.id)} onClick={() => onClose(false)} className={styles.tile}>
                <span className={styles.tileIcon}><Icon name={item.icon} /></span><span><strong>{item.name}</strong><small>{plural(item.count, 'programme')}</small></span>
              </Link></li>)}</ul>
            </section>
            <section aria-labelledby={`${id}-cities`}>
              <p className={styles.label} id={`${id}-cities`}>Browse by city</p>
              <ul className={styles.cityChips}>{cities.map((city) => <li key={city.name}><Link href={cityHref(city)} onClick={() => onClose(false)}>
                <Icon name="location" />{city.name}<span>{city.count}</span>
              </Link></li>)}</ul>
            </section>
          </>}

          <div role="listbox" id={listId} aria-label="Search suggestions" className={styles.listbox} hidden={!options.length}>
            {groups.map((group) => <div key={group.id} role="group" aria-labelledby={`${listId}-${group.id}`} className={styles.group}>
              <p className={styles.label} id={`${listId}-${group.id}`}>{group.title}{group.illustrative && <span className={styles.illustrative}>Illustrative data</span>}</p>
              {group.items.map((item) => {
                const index = options.indexOf(item);
                return <Link key={item.key} id={optionId(index)} role="option" aria-selected={index === active} tabIndex={-1} href={item.href} className={styles.option}
                  onClick={() => { remember(); onClose(false); }} onPointerMove={() => { if (active !== index) setActive(index); }}>
                  <span className={styles.optionIcon}><Icon name={item.icon} /></span>
                  <span className={styles.optionText}><strong><Highlight text={item.label} words={words} /></strong><small>{item.meta}</small></span>
                  <span className={styles.type}>{item.type}</span>
                </Link>;
              })}
            </div>)}
          </div>

          {trimmed && <div className={styles.status} aria-live="polite">
            {status === 'loading' && !options.length && <p><span className={styles.spinner} aria-hidden="true" />Searching…</p>}
            {status === 'error' && <p>Live search is unavailable right now. Press Enter to open the full search page.</p>}
            {status === 'done' && !options.length && <p><strong>No matches for “{trimmed}”.</strong> Try a course like B.Tech or a city like Pune.</p>}
            {options.length > 0 && <p className="sr-only">{plural(options.length, 'suggestion')} available. Use the up and down arrow keys to review them.</p>}
          </div>}
          {trimmed && <div className={styles.footer}>
            <button type="button" className="text-link" onClick={() => submit()}>See all results for “{trimmed}”<Icon name="arrow" /></button>
            <p className={styles.keys} aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> to move <kbd>Enter</kbd> to open <kbd>Esc</kbd> to close</p>
          </div>}
        </div>

        <aside className={styles.aside} aria-label="Search shortcuts">
          {!trimmed ? <>
            <section aria-labelledby={`${id}-recent`} className={styles.recent}>
              <div className={styles.asideHead}>
                <p className={styles.label} id={`${id}-recent`}>Recent searches</p>
                {recent.length > 0 && <button type="button" className={styles.clearAll} onClick={() => setRecent(writeRecent([]))}>Clear</button>}
              </div>
              {recent.length ? <ul>{recent.map((item) => <li key={item}>
                <Link href={`/search?q=${encodeURIComponent(item)}`} onClick={() => { remember(item); onClose(false); }}><Icon name="searchHistory" />{item}</Link>
                <button type="button" aria-label={`Remove ${item} from recent searches`} onClick={() => setRecent(writeRecent(recent.filter((entry) => entry !== item)))}><Icon name="close" /></button>
              </li>)}</ul> : <p className={styles.muted}>Your searches will appear here. They stay in this browser only.</p>}
            </section>
            <section aria-labelledby={`${id}-tools`}>
              <p className={styles.label} id={`${id}-tools`}>Quick tools{preferred ? ` · ${preferred.name}` : ''}</p>
              <ul className={styles.tools}>{courseTools.map((tool) => <li key={tool.href}><Link href={withCourse(tool.href, preferred?.id)} onClick={() => onClose(false)}><Icon name={tool.icon} />{tool.label}</Link></li>)}</ul>
            </section>
          </> : <section aria-labelledby={`${id}-preference`} className={styles.preference}>
            <p className={styles.label} id={`${id}-preference`}>Your preference</p>
            {preferenceTarget ? <>
              <p className={styles.preferenceValue}><Icon name="cap" />{preferred?.name || 'Any course'}<span>·</span><Icon name="location" />{preferredCity || 'Any city'}</p>
              <Link className="text-link" href={collegesHref(preferenceTarget, preferredCity && filterCollegeRecords(colleges, { courseId: preferenceTarget, location: preferredCity }).length ? preferredCity : '')} onClick={() => onClose(false)}>Colleges for your preference<Icon name="arrow" /></Link>
            </> : <p className={styles.muted}>Set a course and city in the header to personalise results.</p>}
            <p className={styles.tip}><Icon name="spark" /><span>Combine a course and a place, for example “BCA Hyderabad” or “MBA Tamil Nadu”.</span></p>
            <p className={styles.muted}>Searching {plural(courses.length, 'course')} and {plural(colleges.length, 'programme')} in NSEDU&rsquo;s illustrative catalogue.</p>
          </section>}
        </aside>
      </div>
    </div>
  </div>;
}
