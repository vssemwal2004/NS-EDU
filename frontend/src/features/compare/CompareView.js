'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatTuition } from '@/lib/college-catalog';
import { useCatalog } from '@/providers/CatalogProvider';
import CompareArena, { universityOf } from './CompareArena';
import CompareTable from './CompareTable';
import CompareVerdict from './CompareVerdict';
import SuggestedComparisons from './SuggestedComparisons';
import { MAX, buildSuggestions, compareHref, courseStats, groupByCourse } from './compare-data';
import { useCompareState } from './useCompareState';
import styles from './Compare.module.css';

const jumpLinks = [['compare-overview', 'Overview'], ['compare-fees', 'Fees'], ['compare-placements', 'Placements'], ['compare-years', 'Data years']];
const noop = () => () => {};
// Native share sheet only on touch devices; desktops get "Copy link".
const canShareSnapshot = () => Boolean(window.navigator.share) && window.matchMedia('(pointer: coarse)').matches;

export default function CompareView({ initialCourse = '', initialList = '', intro = null }) {
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
  if (!course) return <div className={styles.page}>
    <section className={`lux-surface-dark ${styles.stage}`} aria-labelledby="compare-title">
      <div className={`lux-container ${styles.stageInner}`}>
        <div className={styles.intro}>{intro}</div>
        <div className={`lux-state ${styles.emptyState}`}><Icon name="building" /><h2 className="lux-title">No colleges to compare yet</h2><p>College records will appear here once they are published.</p></div>
      </div>
    </section>
  </div>;

  const { rows, selected } = state;
  const total = selected.length;
  const canCompare = rows.length > 1;
  const sortedKey = (ids) => ids.toSorted().join(',');
  const currentKey = `${course.id}:${sortedKey(state.ids)}`;
  const ownCards = allCards.filter((card) => card.course.id === course.id && card.key !== currentKey);
  const otherCards = allCards.filter((card) => card.course.id !== course.id);
  const sameField = options.filter((item) => item.count > 1 && item.id !== course.id && item.field === course.field);
  const alternatives = sameField.length ? sameField : options.filter((item) => item.count > 1);

  function add(row) {
    if (total >= MAX) { setMessage(`You can compare up to ${MAX} colleges. Remove one to add another.`); return; }
    state.add(row.id);
    pendingFocus.current = total + 1 >= MAX ? 'diff' : 'combo';
    setMessage(`${row.shortName || row.name} added · ${total + 1} of ${MAX} slots used`);
  }
  function remove(row) {
    state.remove(row.id);
    pendingFocus.current = 'combo';
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

  const controls = <div className={styles.controls}>
    <div className={styles.courseField}>
      <label htmlFor="compare-course" className={styles.controlLabel}>Course</label>
      <div className={styles.selectWrap}>
        <Icon name={course.icon || 'cap'} />
        <select id="compare-course" value={course.id} onChange={(event) => changeCourse(event.target.value)}>
          <optgroup label="Can be compared">{options.filter((item) => item.count > 1).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.count} colleges</option>)}</optgroup>
          <optgroup label="Only one college listed">{options.filter((item) => item.count === 1).map((item) => <option key={item.id} value={item.id}>{item.name} · 1 college</option>)}</optgroup>
        </select>
        <Icon name="chevron" className={styles.selectChevron} />
      </div>
      <p className={styles.controlHint}>Each course keeps its own picks, so switching never clears them.</p>
    </div>
    {canCompare && state.hydrated && <div className={styles.controlRow}>
      <span className={styles.meter} aria-hidden="true">{Array.from({ length: MAX }, (_, index) => <i key={index} data-on={index < total || undefined} />)}</span>
      <span className={styles.meterText}><strong>{total}</strong> of {MAX} selected</span>
      {total > 0 && <button type="button" className={styles.textButton} onClick={clear}>Clear</button>}
    </div>}
    {canCompare && total > 0 && <div className={styles.controlRow}>
      <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={shareLink}><Icon name={canShare ? 'compareShare' : 'compareLink'} />{canShare ? 'Share' : 'Copy link'}</button>
      <button type="button" className={`lux-button lux-button--ghost lux-button--sm ${styles.print}`} onClick={() => window.print()}><Icon name="comparePrint" />Print</button>
      <span className={styles.shareStatus} role="status">{share.status === 'copied' ? <><Icon name="check" />Link copied</> : share.status === 'failed' ? 'Copy failed: select the link below' : ''}</span>
    </div>}
    {share.status === 'failed' && <label className={styles.shareField}><span className="sr-only">Comparison link</span><input className="lux-field" readOnly value={share.url} onFocus={(event) => event.target.select()} /></label>}
  </div>;

  const only = rows[0];
  const showBoard = canCompare && state.hydrated && total > 0;

  return <div className={styles.page}>
    <section className={`lux-surface-dark ${styles.stage}`} aria-labelledby="compare-title" id="comparison" data-board={showBoard || undefined}>
      <div className={`lux-container ${styles.stageInner}`}>
        <div className={styles.stageHead}>
          <div className={styles.intro}>{intro}</div>
          {controls}
        </div>
        {state.droppedFromLink > 0 && <p className={styles.notice} role="status"><Icon name="compareInfo" />{state.droppedFromLink === 1 ? '1 college in this link is' : `${state.droppedFromLink} colleges in this link are`} no longer listed for {course.name}.</p>}

        {canCompare
          ? <CompareArena course={course} rows={rows} selected={selected} hydrated={state.hydrated} onAdd={add} onRemove={remove} comboRef={comboRef} />
          : <div className={styles.single}>
            <div className={styles.singleCopy}>
              <p className={styles.kicker}><Icon name={course.icon || 'cap'} />{course.name}</p>
              <h2 className={styles.arenaTitle}>Only one {course.name} college is listed right now</h2>
              <p className={styles.subtleOnDark}>There is nothing to compare it with yet. You can still view its details, or compare another course.</p>
              <p className={styles.altLabel}>{sameField.length ? `Other ${course.field} courses you can compare` : 'Courses you can compare'}</p>
              <ul className={styles.altCourses}>{alternatives.map((item) => <li key={item.id}><Link className="lux-chip" href={`${compareHref(item.id)}#comparison`}><Icon name={item.icon || 'cap'} />{item.name}<small>{item.count}</small></Link></li>)}</ul>
            </div>
            <article className={styles.slotCard} aria-labelledby="single-name" id="compare-slots">
              <div className={styles.slotArt} aria-hidden="true"><CollegeArtwork row={only} className={styles.slotThumb} /></div>
              <div className={styles.slotBody}>
                <h3 id="single-name" className={styles.slotName}>{only.name}</h3>
                <p className={styles.slotCity}><Icon name="location" />{only.city}{only.state ? `, ${only.state}` : ''}</p>
                <p className={styles.slotFee}><strong>{formatTuition(only.annualTuitionInr)}</strong><small>tuition / yr · illustrative</small></p>
              </div>
              <div className={`${styles.slotActions} ${styles.singleActions}`}>
                <ApplyButton university={universityOf(only)} courseSlug={course.id} variant="light" block />
                <Link className={styles.slotLink} href={`/universities/${only.collegeId}`}>View college<Icon name="arrow" /></Link>
              </div>
            </article>
          </div>}
      </div>
    </section>
    <p className="sr-only" role="status" aria-live="polite">{message}</p>

    {showBoard && <div className={`lux-container ${styles.board}`}>
      <CompareVerdict selected={selected} />
      <div className={styles.toolbar}>
        <nav className={styles.jump} aria-label="Comparison sections">
          {jumpLinks.map(([id, label]) => <a key={id} className={styles.jumpLink} href={`#${id}`}>{label}</a>)}
        </nav>
        <button ref={diffRef} type="button" className={styles.switch} aria-pressed={highlight && total > 1} disabled={total < 2} onClick={() => setHighlight(!highlight)}
          title={total < 2 ? 'Add a second college to highlight differences' : undefined}>
          <span className={styles.switchTrack} aria-hidden="true"><span /></span><Icon name="compareDiff" />Highlight differences
        </button>
      </div>
      <CompareTable course={course} stats={courseStats(rows)} selected={selected} highlight={highlight} />
      <aside className={styles.footnote} aria-label="About this data">
        <Icon name="compareInfo" />
        <div>
          <p><strong>Illustrative data:</strong> these institutions are fictional examples. <strong>Lowest</strong> and <strong>Highest</strong> compare only the colleges you selected and are not a ranking. Tuition covers tuition only; hostel, exam and living costs are extra. Confirm fees and eligibility with each institution.</p>
          <p className={styles.footLinks}>
            <Link className="lux-link" href="/budget">Estimate full costs<Icon name="arrow" /></Link>
            <Link className="lux-link" href={`/colleges?course=${course.id}`}>Browse all {course.name} colleges<Icon name="arrow" /></Link>
          </p>
        </div>
      </aside>
    </div>}

    <SuggestedComparisons cards={canCompare ? [...ownCards, ...otherCards] : otherCards} />
  </div>;
}
