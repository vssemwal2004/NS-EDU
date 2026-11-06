'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { cachedSuggestions, EMPTY_SUGGESTIONS, fetchSuggestions, placeHref, suggestKey } from '@/lib/search/suggest-client';
import { useCatalog } from '@/providers/CatalogProvider';
import { readRecent, rememberSearch, writeRecent } from './storage';
import styles from './SearchPanel.module.css';

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Short debounce: answers come from the server's in-memory index (a few ms) and repeats from the
// browser cache, so the wait is mostly for the student to finish a keystroke burst.
const DEBOUNCE_MS = 90;

function Highlight({ text, query }) {
  const words = query.split(/\s+/).filter((word) => word.length > 1).map(escape);
  if (!words.length) return text;
  return String(text).split(new RegExp(`(${words.join('|')})`, 'gi')).map((part, index) => index % 2 ? <mark key={index}>{part}</mark> : part);
}

// Header search: universities, places, courses and exams as you type — typo-tolerant ("grafic era")
// and short-form aware ("upes", "iitb"). Submitting goes to the full /search page.
export default function SearchPanel({ id, onSubmit, onClose }) {
  const { courses = [] } = useCatalog();
  const router = useRouter();
  const listId = useId();
  const input = useRef(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState({ key: '', data: EMPTY_SUGGESTIONS, state: 'idle' });
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState(readRecent);
  const trimmed = query.trim();
  const key = suggestKey(trimmed);

  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setLastKey(key); setActive(-1);
    // A cached answer shows on the same render as the keystroke, with no request at all.
    const hit = key ? cachedSuggestions(key) : null;
    if (hit) setResult({ key, data: hit, state: 'done' });
  }

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!key || cachedSuggestions(key)) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchSuggestions(key, { signal: controller.signal })
        .then((data) => setResult({ key, data, state: 'done' }))
        .catch((error) => { if (error.name !== 'AbortError') setResult({ key, data: EMPTY_SUGGESTIONS, state: 'error' }); });
    }, DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key]);

  // While the next answer loads, the previous list stays up (no flicker between keystrokes).
  const status = !key ? 'idle' : result.key === key ? result.state : 'loading';
  const data = key ? result.data : EMPTY_SUGGESTIONS;
  const shownQuery = data.corrected || trimmed;
  const groups = useMemo(() => {
    if (!key) return [];
    const { universities, places, courses: courseHits, exams } = data;
    return [
      { id: 'universities', title: 'Universities', items: universities.slice(0, 6).map((item) => ({
        key: `u-${item.id}`, href: `/universities/${encodeURIComponent(item.id)}`, icon: 'building', label: item.name,
        badge: item.matchedShortForm || '', meta: [item.city, item.state].filter(Boolean).join(', '),
      })) },
      { id: 'places', title: 'Places', items: places.slice(0, 3).map((item) => ({
        key: `p-${item.kind}-${item.state}-${item.name}`, href: placeHref(item), icon: 'location', label: item.name,
        meta: `${item.kind === 'state' ? 'State' : item.state} · ${item.institutions.toLocaleString('en-IN')} ${item.institutions === 1 ? 'institution' : 'institutions'}`,
      })) },
      { id: 'courses', title: 'Courses', items: courseHits.slice(0, 4).map((item) => ({ key: `c-${item.id}`, href: `/courses/${encodeURIComponent(item.id)}`, icon: item.icon || 'layers', label: item.name, meta: item.fullName || item.field })) },
      { id: 'exams', title: 'Exam guides', items: exams.slice(0, 3).map((item) => ({ key: `e-${item.id}`, href: `/exams/${encodeURIComponent(item.id)}`, icon: item.icon || 'document', label: item.name, meta: `${item.field} entrance exam` })) },
    ].filter((group) => group.items.length);
  }, [key, data]);
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
  const more = data.universityTotal - data.universities.length;

  return <div id={id} className={styles.panel} role="dialog" aria-label="Search Gyaan Vidhya" onKeyDown={onPanelKey}>
    <div className={`lux-container lux-container--narrow ${styles.inner}`}>
      <form role="search" className={styles.form} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <Icon name="search" />
        <label className="sr-only" htmlFor={`${id}-input`}>Search universities, courses and exams</label>
        <input ref={input} id={`${id}-input`} type="text" role="combobox" aria-expanded={options.length > 0} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeOption ? optionId(active) : undefined}
          value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onInputKey}
          placeholder="University, short form (UPES), course, exam or city" maxLength={120} autoComplete="off" spellCheck={false} enterKeyHint="search" />
        {status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
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
        <p className={styles.tip}><Icon name="spark" />Try a short form like <strong>UPES</strong> or <strong>IIT Bombay</strong> — spelling mistakes are fine. Press <kbd>/</kbd> on any page to search.</p>
      </div>}

      {key && data.corrected && status !== 'error' && <p className={styles.corrected} role="status">
        <Icon name="spark" />Showing results for <strong>{data.corrected}</strong>
        <span className={styles.correctedFrom}>· you typed “{trimmed}”</span>
      </p>}

      <div role="listbox" id={listId} aria-label="Search suggestions" className={styles.listbox} hidden={!options.length}>
        {groups.map((group) => <div key={group.id} role="group" aria-labelledby={`${listId}-${group.id}`} className={styles.group}>
          <p className="lux-eyebrow" id={`${listId}-${group.id}`}>{group.title}{group.id === 'universities' && more > 0 && <span className={styles.count}> · {data.universityTotal.toLocaleString('en-IN')} matches</span>}</p>
          {group.items.map((item) => {
            const index = options.indexOf(item);
            return <Link key={item.key} id={optionId(index)} role="option" aria-selected={index === active} tabIndex={-1} href={item.href} className={styles.option}
              onClick={() => { remember(); onClose(false); }} onPointerMove={() => { if (active !== index) setActive(index); }}>
              <span className={styles.optionIcon}><Icon name={item.icon} /></span>
              <span className={styles.optionText}>
                <strong>{item.badge && <span className={styles.badge} title={`${item.badge} is the short form of this name`}>{item.badge}</span>}<Highlight text={item.label} query={shownQuery} /></strong>
                {item.meta && <small>{item.meta}</small>}
              </span>
              <Icon name="arrow" className={styles.optionArrow} />
            </Link>;
          })}
        </div>)}
      </div>

      {trimmed && <div className={styles.status} aria-live="polite">
        {status === 'loading' && !options.length && <p>Searching…</p>}
        {status === 'error' && <p>Suggestions are unavailable right now. Press Enter to open the full search.</p>}
        {status === 'done' && !options.length && <p>No quick matches for “{trimmed}”. Try a shorter word or a short form such as IIT or UPES, or press Enter to search everything.</p>}
        {options.length > 0 && <p className="sr-only">{options.length} suggestions{data.corrected ? `, showing results for ${data.corrected}` : ''}. Use the up and down arrow keys to review them.</p>}
      </div>}
      {trimmed && <button type="button" className={`lux-link ${styles.all}`} onClick={() => submit()}>See all results for “{trimmed}”<Icon name="arrow" /></button>}
    </div>
  </div>;
}
