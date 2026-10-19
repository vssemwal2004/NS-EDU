'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import { monogram } from '@/features/universities/labels';
import styles from './InstitutionCompare.module.css';

const applyTarget = (item) => ({ id: item.id, name: item.name, city: item.city || '', state: item.state || '', logoUrl: item.logoUrl || '' });

function Cell({ cell, highlight }) {
  if (cell.missing) return <td className={styles.cell} data-missing="true"><span className={styles.notPublished}>Not published</span></td>;
  const body = cell.href
    ? <a className={styles.cellLink} href={cell.href} target="_blank" rel="noopener noreferrer nofollow">{cell.value}<Icon name="external" /></a>
    : <span className={styles.cellValue}>{cell.value}</span>;
  return <td className={styles.cell} data-best={cell.best || undefined} data-dim={highlight && !cell.best ? true : undefined}>
    {cell.best && <span className={styles.bestFlag}><Icon name="compareBest" />Best here</span>}
    {body}
    {cell.sub && <small className={styles.cellSub}>{cell.sub}</small>}
    {cell.tag && <span className={styles.cellTag}>{cell.tag}</span>}
    {cell.foot && <small className={styles.cellFoot}>{cell.foot}</small>}
  </td>;
}

/**
 * Pinned metric column + horizontally swipeable institution columns. A real <table> so screen
 * readers keep the row/column relationship; the first column is sticky, the rest scroll.
 */
export default function InstitutionBoard({ board, highlight, onRemove }) {
  const { facts, sections } = board;
  const scrollRef = useRef(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    // ResizeObserver delivers a first callback on observe, so the initial measurement happens
    // there rather than synchronously in the effect body.
    const observer = new window.ResizeObserver(() => setScrollable(node.scrollWidth - node.clientWidth > 8));
    observer.observe(node);
    return () => observer.disconnect();
  }, [facts.length]);

  return <div className={styles.boardWrap}>
    {scrollable && <p className={styles.swipeHint}><Icon name="compareSwipe" />Swipe the columns sideways. The metric names stay pinned.</p>}
    <div className={styles.scroller} ref={scrollRef} tabIndex={0} role="region" aria-label="Comparison table (scrolls sideways)">
      <table className={styles.table} style={{ '--cols': facts.length }}>
        <caption className="sr-only">Side-by-side comparison of {facts.map((entry) => entry.name).join(', ')}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}><span className="sr-only">Metric</span></th>
            {facts.map((entry) => <th scope="col" key={entry.id} className={styles.colHead}>
              <span className={styles.colMark} aria-hidden="true">{entry.item.logoUrl
                ? <img src={entry.item.logoUrl} alt="" width={40} height={40} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                : monogram(entry.name)}</span>
              <Link className={styles.colName} href={`/universities/${entry.id}`}>{entry.name}</Link>
              <span className={styles.colPlace}>{entry.place || 'Location not listed'}</span>
              {entry.illustrative && <span className={styles.colFlag}>Illustrative sample</span>}
              <span className={styles.colActions}>
                <ApplyButton university={applyTarget(entry.item)} variant="primary" className="lux-button--sm lux-button--block" />
                <button type="button" className={styles.colRemove} onClick={() => onRemove(entry.id)}>Remove<span className="sr-only"> {entry.name} from the comparison</span></button>
              </span>
            </th>)}
          </tr>
        </thead>
        {sections.map((section) => <tbody key={section.id} id={section.id} className={styles.group}>
          <tr className={styles.sectionRow}>
            <th scope="rowgroup" className={styles.sectionLabel}>
              {section.label}
              {section.note && <small className={styles.sectionNote}><Icon name="compareInfo" />{section.note}</small>}
            </th>
            {facts.map((entry) => <td key={entry.id} className={styles.sectionTick}>{entry.shortName}</td>)}
          </tr>
          {section.rows.map((row) => <tr key={row.key} className={styles.row} data-diff={highlight && row.mode ? true : undefined}>
            <th scope="row" className={styles.metric}>
              {row.label}
              {row.note && <small className={styles.metricNote}>{row.note}</small>}
            </th>
            {row.cells.map((cell, index) => <Cell key={facts[index].id} cell={cell} highlight={highlight && Boolean(row.mode)} />)}
          </tr>)}
        </tbody>)}
      </table>
    </div>
  </div>;
}
