'use client';
import { useEffect, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatSalary, formatTuition } from '@/lib/college-catalog';
import { MAX, bestIds } from './compare-data';
import styles from './Compare.module.css';

const unique = (values) => [...new Set(values.filter(Boolean))];

function buildSections(course, stats, selected) {
  const allSalaryMissing = selected.every((row) => row.medianSalaryLpa == null && row.highestSalaryLpa == null);
  const placementYears = unique(selected.map((row) => row.placementYear)).join(', ');
  return [
    { id: 'compare-overview', title: 'Overview', icon: 'location', caption: 'Demo ratings are sample values for this preview, not student reviews.', rows: [
      { label: 'Location', same: (row) => `${row.city}|${row.state}`, render: (row) => <><span className={styles.value}>{row.city}</span>{row.state && <small className={styles.sub}>{row.state}</small>}</> },
      { label: 'Programme', same: () => course.id, render: () => <span className={styles.plain}>{course.fullName || course.name}</span> },
      { label: 'Demo rating', metric: 'demoRating', mode: 'max', what: 'demo rating', format: (value) => `${value.toFixed(1)} / 5` },
    ] },
    { id: 'compare-fees', title: 'Fees', icon: 'wallet', caption: `${course.name} fees listed: ${formatTuition(stats.feeMin)} – ${formatTuition(stats.feeMax)} a year (${stats.count} colleges). Bars start at zero and are scaled to the highest.`, rows: [
      { label: 'Annual tuition', hint: 'Tuition only', metric: 'annualTuitionInr', mode: 'min', what: 'tuition', bar: 'fee', scale: stats.feeMax, delta: true, format: (value) => <>{formatTuition(value)}<small> /yr</small></> },
    ] },
    { id: 'compare-placements', title: 'Placements', icon: 'trend', caption: `${placementYears ? `Placement year ${placementYears} · ` : ''}median is the middle salary; highest is a single offer. Bars are scaled to the highest ${course.name} figure listed.`,
      rows: allSalaryMissing
        ? [{ label: 'Salary figures', note: 'Placement figures are not provided for these programmes.' }]
        : [
          { label: 'Median salary', metric: 'medianSalaryLpa', mode: 'max', what: 'median salary', bar: 'salary', scale: stats.medianMax, format: formatSalary },
          { label: 'Highest salary', metric: 'highestSalaryLpa', mode: 'max', what: 'highest salary', bar: 'salary', scale: stats.highestMax, format: formatSalary },
        ] },
    { id: 'compare-years', title: 'Data years', icon: 'calendar', caption: 'When each figure was collected. Older figures may have changed since.', rows: [
      { label: 'Fee data year', same: (row) => row.tuitionYear, render: (row) => <span className={styles.plain}>{row.tuitionYear || 'Not provided'}</span> },
      { label: 'Placement data year', same: (row) => row.placementYear, render: (row) => <span className={styles.plain}>{row.placementYear || 'Not provided'}</span> },
      { label: 'Data status', same: (row) => String(row.isIllustrative), render: (row) => (row.isIllustrative ? <span className={styles.illustrative}>Illustrative</span> : <span className={styles.plain}>Listed</span>) },
    ] },
  ];
}

function MetricCell({ row, item, best, lowest }) {
  const value = row[item.metric];
  if (value == null) return <td><span className={styles.missing}>Not provided</span></td>;
  const isBest = Boolean(best?.ids.has(row.id));
  return <td data-best={isBest || undefined}>
    <span className={styles.value}>{item.format(value)}</span>
    {item.bar && item.scale > 0 && <span className={styles.bar} data-kind={item.bar} aria-hidden="true"><span style={{ width: `${Math.min(100, (value / item.scale) * 100)}%` }} /></span>}
    {isBest && <span className={styles.badge}><Icon name="compareBest" />{item.mode === 'min' ? 'Lowest' : 'Highest'}<span className="sr-only"> {item.what} among selected</span></span>}
    {!isBest && item.delta && best && <small className={styles.delta}>+{formatTuition(value - lowest)} vs lowest</small>}
  </td>;
}

export default function CompareTable({ course, stats, selected, highlight, onRemove, onAddRequest }) {
  const boardRef = useRef(null);
  const stripRef = useRef(null);
  const trackRef = useRef(null);
  const frameRef = useRef(null);
  const sections = buildSections(course, stats, selected);
  const compare = highlight && selected.length > 1;
  const columns = Array.from({ length: MAX }, (_, index) => selected[index] || null);

  // Layout flags are written to data attributes (no React state per scroll frame).
  useEffect(() => {
    const board = boardRef.current;
    const frame = frameRef.current;
    if (!board || !frame) return undefined;
    let pending = 0;
    const update = () => {
      pending = 0;
      const top = parseFloat(window.getComputedStyle(stripRef.current).top) || 0;
      const box = board.getBoundingClientRect();
      board.dataset.stuck = String(box.top < top - 8 && box.bottom > top + 160);
      board.dataset.overflow = String(frame.scrollWidth > frame.clientWidth + 1);
      board.dataset.end = String(frame.scrollLeft + frame.clientWidth >= frame.scrollWidth - 2);
    };
    const schedule = () => { if (!pending) pending = window.requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = new window.ResizeObserver(schedule);
    observer.observe(frame);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (pending) window.cancelAnimationFrame(pending);
    };
  }, [selected.length]);

  function syncStrip(event) {
    const frame = event.currentTarget;
    if (trackRef.current) trackRef.current.style.transform = `translateX(${-frame.scrollLeft}px)`;
    boardRef.current.dataset.end = String(frame.scrollLeft + frame.clientWidth >= frame.scrollWidth - 2);
  }

  return <div ref={boardRef} className={styles.board} style={{ '--cols': selected.length }}>
    {/* Visual column header: compact bar when stuck on desktop, mirrored name strip on mobile. The real <thead> serves assistive tech. */}
    <p className={styles.swipeHint}><Icon name="compareSwipe" />Swipe sideways to see all {selected.length} colleges</p>
    <div ref={stripRef} className={styles.strip} aria-hidden="true">
      <div className={styles.stripClip}>
        <div className={styles.stripLabel}><strong>{course.name}</strong><small>{selected.length} of {MAX} · Illustrative</small></div>
        <div className={styles.stripViewport}><div ref={trackRef} className={styles.stripTrack}>
          {columns.map((row, index) => (row
            ? <div key={row.id} className={styles.stripCell}>
              <CollegeArtwork row={row} className={styles.stripThumb} />
              <span className={styles.stripName}><strong>{row.shortName || row.name}</strong><small>{row.city}</small></span>
              <button type="button" tabIndex={-1} className={`icon-button ${styles.stripRemove}`} onClick={() => onRemove(row, { quiet: true })}><Icon name="close" /></button>
            </div>
            : <div key={`empty-${index}`} className={styles.stripCell} data-empty="true">
              <button type="button" tabIndex={-1} className={styles.stripAdd} onClick={onAddRequest}><Icon name="plus" />Add college</button>
            </div>))}
        </div></div>
      </div>
    </div>

    <div className={styles.scrollShell}>
      <div ref={frameRef} className={styles.frame} onScroll={syncStrip} tabIndex={0} role="region" aria-label={`${course.name} comparison table`}>
        <table className={styles.table} data-highlight={compare || undefined}>
          <caption className="sr-only">{course.name} comparison of {selected.map((row) => row.name).join(', ')}. Illustrative data; Lowest and Highest compare only the selected colleges.</caption>
          <thead>
            <tr><td className={styles.corner} />{selected.map((row) => <th key={row.id} scope="col"><span className="sr-only">{row.name}, {row.city}</span></th>)}</tr>
          </thead>
          {sections.map((section) => <tbody key={section.id} id={section.id} className={styles.group}>
            <tr className={styles.sectionRow}>
              <th scope="rowgroup" colSpan={selected.length + 1}>
                <div className={styles.sectionHead}>
                  <span className={styles.sectionIcon}><Icon name={section.icon} /></span>
                  <span><span className={styles.sectionTitle}>{section.title}</span><small>{section.caption}</small></span>
                </div>
              </th>
            </tr>
            {section.rows.map((item) => {
              if (item.note) return <tr key={item.label}><th scope="row">{item.label}</th><td colSpan={selected.length}><span className={styles.missing}>{item.note}</span></td></tr>;
              const key = item.same || ((row) => String(row[item.metric]));
              const same = selected.every((row) => key(row) === key(selected[0]));
              const best = item.metric && selected.length > 1 ? bestIds(selected, item.metric, item.mode) : null;
              return <tr key={item.label} data-diff={compare ? (same ? 'same' : 'differs') : undefined}>
                <th scope="row"><span className={styles.rowLabel}>{item.label}{item.hint && <small>{item.hint}</small>}</span>{compare && same && <span className={styles.sameTag}>Same for all</span>}</th>
                {selected.map((row) => (item.metric
                  ? <MetricCell key={row.id} row={row} item={item} best={best} lowest={best?.target} />
                  : <td key={row.id}>{item.render(row)}</td>))}
              </tr>;
            })}
          </tbody>)}
        </table>
      </div>
    </div>
  </div>;
}
