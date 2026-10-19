'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatTuition } from '@/lib/college-catalog';
import { useCatalog } from '@/providers/CatalogProvider';
import CompareSlots from './CompareSlots';
import CompareTable from './CompareTable';
import SuggestedComparisons, { SuggestionCard } from './SuggestedComparisons';
import { MAX, buildSuggestions, compareHref, courseStats, groupByCourse, shortFee } from './compare-data';
import { useCompareState } from './useCompareState';
import styles from './Compare.module.css';

const jumpLinks = [['compare-overview', 'Overview'], ['compare-fees', 'Fees'], ['compare-placements', 'Placements'], ['compare-years', 'Data years']];
const noop = () => () => {};
// Native share sheet only on touch devices; desktops get "Copy link".
const canShareSnapshot = () => Boolean(window.navigator.share) && window.matchMedia('(pointer: coarse)').matches;

export default function CompareView({ initialCourse = '', initialList = '' }) {
  const { courses, colleges } = useCatalog();
  const groups = useMemo(() => groupByCourse(colleges), [colleges]);
  const options = useMemo(() => courses.filter((course) => groups.has(course.id)).map((course) => ({ ...course, count: groups.get(course.id).length })), [courses, groups]);
  const comparable = useMemo(() => options.filter((course) => course.count > 1).map((course) => course.id), [options]);
  const state = useCompareState({ initialCourse, initialList, groups, comparable });
  const allCards = useMemo(() => buildSuggestions(courses, groups), [courses, groups]);
  const canShare = useSyncExternalStore(noop, canShareSnapshot, () => false);
  const [highlight, setHighlight] = useState(false);
  const [message, setMessage] = useState('');
  const [share, setShare] = useState({ status: '', url: '' });
  const comboRef = useRef(null);
  const diffRef = useRef(null);
  const pendingFocus = useRef(null);

  // Focus moves after the slot that held focus re-renders (added, removed or replaced).
  useEffect(() => {
    if (!pendingFocus.current) return;
    const target = pendingFocus.current === 'combo' ? comboRef.current || diffRef.current : diffRef.current;
    pendingFocus.current = null;
    target?.focus();
  });

  const course = options.find((item) => item.id === state.course);
  if (!course) return <section className={`container ${styles.page}`} aria-label="Compare colleges">
    <div className={styles.panel}><Icon name="building" /><h2>No colleges to compare yet</h2><p>College records will appear here once they are published.</p></div>
  </section>;

  const { rows, selected } = state;
  const stats = courseStats(rows);
  const total = selected.length;
  const sortedKey = (ids) => ids.toSorted().join(',');
  const currentKey = `${course.id}:${sortedKey(state.ids)}`;
  const ownCards = allCards.filter((card) => card.course.id === course.id && card.key !== currentKey);
  const otherCards = allCards.filter((card) => card.course.id !== course.id);
  const canCompare = rows.length > 1;
  const sameField = options.filter((item) => item.count > 1 && item.id !== course.id && item.field === course.field);
  const alternatives = sameField.length ? sameField : options.filter((item) => item.count > 1);

  function add(row) {
    if (total >= MAX) { setMessage(`You can compare up to ${MAX} colleges. Remove one to add another.`); return; }
    state.add(row.id);
    pendingFocus.current = total + 1 >= MAX ? 'diff' : 'combo';
    setMessage(`${row.shortName || row.name} added · ${total + 1} of ${MAX} slots used`);
  }
  function remove(row, { quiet } = {}) {
    state.remove(row.id);
    if (!quiet) pendingFocus.current = 'combo';
    setMessage(`${row.shortName || row.name} removed · ${total - 1} of ${MAX} slots used`);
  }
  function clear() {
    state.clear();
    setHighlight(false);
    pendingFocus.current = 'combo';
    setMessage(`${course.name} comparison cleared`);
  }
  function changeCourse(id) {
    state.setCourse(id);
    const next = options.find((item) => item.id === id);
    setMessage(next ? `Showing ${next.name} comparison` : '');
  }
  function requestAdd() {
    const input = comboRef.current;
    if (!input) return;
    input.scrollIntoView({ block: 'center' });
    input.focus({ preventScroll: true });
  }
  async function shareLink() {
    const url = new URL(compareHref(course.id, state.ids), window.location.origin).href;
    if (canShare) {
      try { await window.navigator.share({ title: document.title, url }); } catch (error) { if (error?.name !== 'AbortError') setShare({ status: 'failed', url }); }
      return;
    }
    try {
      await window.navigator.clipboard.writeText(url);
      setShare({ status: 'copied', url });
      window.setTimeout(() => setShare((current) => (current.status === 'copied' ? { status: '', url: '' } : current)), 4000);
    } catch { setShare({ status: 'failed', url }); }
  }

  const setup = <div className={styles.setup}>
    <div className={styles.courseField}>
      <label htmlFor="compare-course">Course</label>
      <div className={styles.selectWrap}>
        <Icon name={course.icon || 'cap'} />
        <select id="compare-course" value={course.id} onChange={(event) => changeCourse(event.target.value)}>
          <optgroup label="Can be compared">{options.filter((item) => item.count > 1).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.count} colleges</option>)}</optgroup>
          <optgroup label="Only one college listed">{options.filter((item) => item.count === 1).map((item) => <option key={item.id} value={item.id}>{item.name} · 1 college</option>)}</optgroup>
        </select>
        <Icon name="chevron" className={styles.selectChevron} />
      </div>
    </div>
    <p className={styles.setupHint}><Icon name="compareInfo" />Each course keeps its own picks, so switching course never clears them.</p>
    {canCompare && <div className={styles.setupMeta}>
      <span className={styles.meter} aria-hidden="true">{Array.from({ length: MAX }, (_, index) => <i key={index} data-on={index < total || undefined} />)}</span>
      <span><strong>{total}</strong> of {MAX} selected</span>
      {total > 0 && <button type="button" className={`text-link ${styles.clear}`} onClick={clear}>Clear</button>}
    </div>}
  </div>;

  const live = <p className="sr-only" role="status" aria-live="polite">{message}</p>;

  if (!canCompare) {
    const only = rows[0];
    return <section className={`container ${styles.page}`} aria-label="Compare colleges" id="comparison">
      {setup}
      {live}
      <div className={`${styles.panel} ${styles.singlePanel}`}>
        <div className={styles.singleCopy}>
          <p className={styles.kicker}><Icon name={course.icon || 'cap'} />{course.name}</p>
          <h2>Only one {course.name} college is listed right now</h2>
          <p className={styles.subtle}>There is nothing to compare it with yet. You can still view its details, or compare another course.</p>
        </div>
        <article className={styles.singleCard} aria-labelledby="single-name">
          <CollegeArtwork row={only} className={styles.singleThumb} />
          <div>
            <h3 id="single-name">{only.name}</h3>
            <p className={styles.slotCity}><Icon name="location" />{only.city}{only.state ? `, ${only.state}` : ''}</p>
            <p className={styles.slotFacts}><span>{formatTuition(only.annualTuitionInr)}/yr</span><span className={styles.illustrative}>Illustrative</span></p>
          </div>
          <div className={styles.singleActions}>
            <Link className="button button--primary" href={`/universities/${only.collegeId}`}>View college<Icon name="arrow" /></Link>
            <Link className="button button--ghost" href={`/colleges?course=${course.id}`}>Browse {course.name} colleges</Link>
          </div>
        </article>
        <div className={styles.altCourses}>
          <p>{sameField.length ? `Other ${course.field} courses you can compare` : 'Courses you can compare'}</p>
          <ul>{alternatives.map((item) => <li key={item.id}><Link className="chip" href={`${compareHref(item.id)}#comparison`}><Icon name={item.icon || 'cap'} />{item.name}<small>{item.count} colleges</small></Link></li>)}</ul>
        </div>
      </div>
      <SuggestedComparisons cards={otherCards} />
    </section>;
  }

  return <section className={`container ${styles.page}`} aria-label="Compare colleges" id="comparison">
    {setup}
    {live}
    {state.droppedFromLink > 0 && <p className={styles.notice} role="status"><Icon name="compareInfo" />{state.droppedFromLink === 1 ? '1 college in this link is' : `${state.droppedFromLink} colleges in this link are`} no longer listed for {course.name}.</p>}

    {!state.hydrated
      ? <div className={styles.skeleton} aria-busy="true" aria-label="Loading your comparison"><span /><span /><span /><span /></div>
      : <>
        {total > 0 && <div className={styles.toolbar}>
          <nav className={styles.jump} aria-label="Comparison sections">
            <span className={styles.jumpLabel}>Jump to</span>
            {jumpLinks.map(([id, label]) => <a key={id} className="chip" href={`#${id}`}>{label}</a>)}
          </nav>
          <div className={styles.actions}>
            <button ref={diffRef} type="button" className={styles.switch} aria-pressed={highlight && total > 1} disabled={total < 2} onClick={() => setHighlight(!highlight)}
              title={total < 2 ? 'Add a second college to highlight differences' : undefined}>
              <span className={styles.switchTrack} aria-hidden="true"><span /></span><Icon name="compareDiff" />Highlight differences
            </button>
            <button type="button" className="button button--ghost" onClick={shareLink}><Icon name={canShare ? 'compareShare' : 'compareLink'} />{canShare ? 'Share' : 'Copy link'}</button>
            <button type="button" className={`button button--ghost ${styles.print}`} onClick={() => window.print()}><Icon name="comparePrint" />Print</button>
            <span className={styles.shareStatus} role="status">{share.status === 'copied' ? <><Icon name="check" />Link copied</> : share.status === 'failed' ? 'Copy failed: select the link below' : ''}</span>
          </div>
          {share.status === 'failed' && <label className={styles.shareField}><span className="sr-only">Comparison link</span><input className="field" readOnly value={share.url} onFocus={(event) => event.target.select()} /></label>}
        </div>}

        <CompareSlots course={course} rows={rows} selected={selected} onAdd={add} onRemove={remove} comboRef={comboRef} />

        {total === 1 && <p className={styles.notice}><Icon name="plus" />Add one more college to compare. The table below already shows this college&apos;s figures.</p>}

        {total > 0
          ? <CompareTable course={course} stats={stats} selected={selected} highlight={highlight} onRemove={remove} onAddRequest={requestAdd} />
          : <div className={`${styles.panel} ${styles.startPanel}`}>
            <svg className={styles.startArt} viewBox="0 0 220 150" fill="none" aria-hidden="true">
              <path d="M12 138h196" />
              <rect x="22" y="40" width="52" height="98" rx="8" /><rect x="84" y="20" width="52" height="118" rx="8" /><rect x="146" y="56" width="52" height="82" rx="8" />
              <path d="M32 62h32M32 74h22M94 42h32M94 54h22M156 78h32M156 90h22" />
              <path className={styles.startBar} d="M32 120V104M42 120V96M52 120V110M94 120V84M104 120V72M114 120V90M156 120V108M166 120V100M176 120V112" />
              <circle cx="110" cy="9" r="6" />
            </svg>
            <div className={styles.startCopy}>
              <p className={styles.kicker}><Icon name="scales" />Get started</p>
              <h2>Start a {course.name} comparison</h2>
              <p className={styles.subtle}>Add two or three colleges offering {course.name} to see fees, placements and data years side by side. Tap a college to add it.</p>
              <ul className={styles.quickAdd}>{rows.map((row) => <li key={row.id}>
                <button type="button" className="chip" onClick={() => add(row)}><Icon name="plus" />{row.shortName || row.name}<small>{row.city} · {shortFee(row.annualTuitionInr)}/yr</small></button>
              </li>)}</ul>
            </div>
            {ownCards.length > 0 && <div className={styles.startCards}>
              <p className={styles.startCardsTitle}>Ready-made {course.name} comparisons</p>
              <ul className={styles.suggestionGrid}>{ownCards.map((card) => <SuggestionCard key={card.key} card={card} />)}</ul>
            </div>}
          </div>}

        <aside className={styles.footnote} aria-label="About this data">
          <Icon name="compareInfo" />
          <div>
            <p><strong>Illustrative data:</strong> these institutions are fictional examples. <strong>Lowest</strong> and <strong>Highest</strong> compare only the colleges you selected and are not a ranking. Tuition covers tuition only; hostel, exam and living costs are extra. Confirm fees and eligibility with each institution.</p>
            <p className={styles.footLinks}>
              <Link className="text-link" href="/budget"><Icon name="wallet" />Estimate full costs<Icon name="arrow" /></Link>
              <Link className="text-link" href={`/colleges?course=${course.id}`}><Icon name="cap" />Browse all {course.name} colleges<Icon name="arrow" /></Link>
            </p>
          </div>
        </aside>
      </>}

    <SuggestedComparisons cards={total > 0 ? [...ownCards, ...otherCards] : otherCards} />
  </section>;
}
