'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useCatalog } from '@/providers/CatalogProvider';
import { readRecent, rememberSearch, writeRecent } from './storage';
import styles from './SearchPanel.module.css';

const empty = { courses: [], exams: [], colleges: [] };
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Highlight({ text, query }) {
  const words = query.split(/\s+/).filter((word) => word.length > 1).map(escape);
  if (!words.length) return text;
  return String(text).split(new RegExp(`(${words.join('|')})`, 'gi')).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part);
}

// Header search: live course/exam suggestions (public) plus universities for signed-in students.
// Submitting goes to /search, which is login-gated.
export default function SearchPanel({ id, onSubmit, onClose }) {
  const { courses = [] } = useCatalog();
  const router = useRouter();
  const listId = useId();
  const input = useRef(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ query: '', data: empty, state: 'idle', locked: false });
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const trimmed = query.trim();

  const [lastQuery, setLastQuery] = useState(trimmed);
  if (lastQuery !== trimmed) { setLastQuery(trimmed); setActive(-1); }

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!trimmed) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api(`/catalog/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((data) => setResult({ query: trimmed, data: { ...empty, ...data }, state: 'done', locked: Boolean(data.collegesRequireLogin) }))
        .catch((error) => { if (error.name !== 'AbortError') setResult({ query: trimmed, data: empty, state: 'error', locked: false }); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [trimmed]);

  const status = !trimmed ? 'idle' : result.query === trimmed ? result.state : 'loading';
  const groups = useMemo(() => {
    if (!trimmed || result.query !== trimmed) return [];
    const { colleges, courses: courseHits, exams } = result.data;
    return [
      { id: 'universities', title: 'Universities', items: colleges.slice(0, 5).map((item) => ({ key: `u-${item.id}`, href: `/universities/${encodeURIComponent(item.id)}`, icon: 'building', label: item.name, meta: [item.city, item.state].filter(Boolean).join(', ') })) },
      { id: 'courses', title: 'Courses', items: courseHits.slice(0, 4).map((item) => ({ key: `c-${item.id}`, href: `/courses/${encodeURIComponent(item.id)}`, icon: item.icon || 'layers', label: item.name, meta: item.fullName || item.field })) },
      { id: 'exams', title: 'Exam guides', items: exams.slice(0, 3).map((item) => ({ key: `e-${item.id}`, href: `/exams/${encodeURIComponent(item.id)}`, icon: item.icon || 'document', label: item.name, meta: `${item.field} entrance exam` })) },
    ].filter((group) => group.items.length);
  }, [trimmed, result]);
  const options = groups.flatMap((group) => group.items);
  const activeOption = options[active];
  const optionId = (index) => `${listId}-option-${index}`;

  useEffect(() => { if (active >= 0) document.getElementById(`${listId}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, listId]);

  const remember = (value = trimmed) => setRecent(rememberSearch(value));
  const submit = (value = trimmed) => { if (value) remember(value); onSubmit(value); };
  const onInputKey = (event) => {
    const count = options.length;
    if (event.key === 'ArrowDown' && count) { event.preventDefault(); setActive((active + 1) % count); }
    else if (event.key === 'ArrowUp' && count) { event.preventDefault(); setActive(active <= 0 ? count - 1 : active - 1); }
    else if (event.key === 'Enter' && activeOption) { event.preventDefault(); remember(); onClose(false); router.push(activeOption.href); }
  };
  const onPanelKey = (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (activeOption && event.target === input.current) setActive(-1); else onClose(true);
  };
  const popular = courses.filter((course) => course.popular);

  return <div id={id} className={styles.panel} role="dialog" aria-label="Search Gyaan Vidhya" onKeyDown={onPanelKey}>
    <div className={`lux-container lux-container--narrow ${styles.inner}`}>
      <form role="search" className={styles.form} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <Icon name="search" />
        <label className="sr-only" htmlFor={`${id}-input`}>Search universities, courses and exams</label>
        <input ref={input} id={`${id}-input`} type="text" role="combobox" aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeOption ? optionId(active) : undefined}
          value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onInputKey}
          placeholder="University, course, exam or city" maxLength={120} autoComplete="off" spellCheck={false} enterKeyHint="search" />
        {query && <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}><Icon name="close" /></button>}
        <button type="submit" className="lux-button lux-button--primary lux-button--sm">Search</button>
      </form>

      {!trimmed && <div className={styles.idle}>
        {recent.length > 0 && <section aria-labelledby={`${id}-recent`}>
          <div className={styles.head}><p className="lux-eyebrow" id={`${id}-recent`}>Recent</p><button type="button" className={styles.textButton} onClick={() => setRecent(writeRecent([]))}>Clear</button></div>
          <ul className={styles.chips}>{recent.map((item) => <li key={item}><button type="button" className="lux-chip" onClick={() => submit(item)}><Icon name="searchHistory" />{item}</button></li>)}</ul>
        </section>}
        {popular.length > 0 && <section aria-labelledby={`${id}-popular`}>
          <p className="lux-eyebrow" id={`${id}-popular`}>Popular courses</p>
          <ul className={styles.chips}>{popular.map((course) => <li key={course.id}><Link className="lux-chip" href={`/courses/${encodeURIComponent(course.id)}`} onClick={() => onClose(false)}><Icon name={course.icon} />{course.name}</Link></li>)}</ul>
        </section>}
        <p className={styles.tip}><Icon name="spark" />Press <kbd>/</kbd> on any page to open search. Recent searches stay in this browser only.</p>
      </div>}

      <div role="listbox" id={listId} aria-label="Search suggestions" className={styles.listbox} hidden={!options.length}>
        {groups.map((group) => <div key={group.id} role="group" aria-labelledby={`${listId}-${group.id}`} className={styles.group}>
          <p className="lux-eyebrow" id={`${listId}-${group.id}`}>{group.title}</p>
          {group.items.map((item) => {
            const index = options.indexOf(item);
            return <Link key={item.key} id={optionId(index)} role="option" aria-selected={index === active} tabIndex={-1} href={item.href} className={styles.option}
              onClick={() => { remember(); onClose(false); }} onPointerMove={() => { if (active !== index) setActive(index); }}>
              <span className={styles.optionIcon}><Icon name={item.icon} /></span>
              <span className={styles.optionText}><strong><Highlight text={item.label} query={trimmed} /></strong>{item.meta && <small>{item.meta}</small>}</span>
              <Icon name="arrow" className={styles.optionArrow} />
            </Link>;
          })}
        </div>)}
      </div>

      {trimmed && <div className={styles.status} aria-live="polite">
        {status === 'loading' && !options.length && <p>Searching…</p>}
        {status === 'error' && <p>Suggestions are unavailable right now. Press Enter to open the full search.</p>}
        {status === 'done' && !options.length && <p>No quick matches for “{trimmed}”. Press Enter to search everything.</p>}
        {status === 'done' && result.locked && <p className={styles.locked}><Icon name="lock" />University results need a free login. Press Enter to log in and see them.</p>}
        {options.length > 0 && <p className="sr-only">{options.length} suggestions. Use the up and down arrow keys to review them.</p>}
      </div>}
      {trimmed && <button type="button" className={`lux-link ${styles.all}`} onClick={() => submit()}>See all results for “{trimmed}”<Icon name="arrow" /></button>}
    </div>
  </div>;
}
