'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatTuition } from '@/lib/college-catalog';
import AddCollegeCombobox from './AddCollegeCombobox';
import { MAX, shortFee, similarPick } from './compare-data';
import styles from './Compare.module.css';

export const universityOf = (row) => ({ id: row.collegeId, name: row.name, city: row.city, state: row.state, logoUrl: row.logoUrl || '' });

function FilledSlot({ row, index, course, onRemove }) {
  return <article className={styles.slotCard} aria-labelledby={`slot-${row.id}`}>
    <div className={styles.slotArt} aria-hidden="true">
      <CollegeArtwork row={row} className={styles.slotThumb} />
      <span className={styles.slotIndex}>{index + 1}</span>
    </div>
    <div className={styles.slotBody}>
      <h3 id={`slot-${row.id}`} className={styles.slotName}>{row.name}</h3>
      <p className={styles.slotCity}><Icon name="location" />{row.city}{row.state ? `, ${row.state}` : ''}</p>
      <p className={styles.slotFee}><strong>{formatTuition(row.annualTuitionInr)}</strong><small>tuition / yr</small></p>
    </div>
    <div className={styles.slotActions}>
      <ApplyButton university={universityOf(row)} courseSlug={course.id} variant="light" block />
      <Link className={styles.slotLink} href={`/universities/${row.collegeId}`}>View college<span className="sr-only">: {row.name}</span><Icon name="arrow" /></Link>
    </div>
    <button type="button" className={styles.slotRemove} aria-label={`Remove ${row.name} from comparison`} onClick={() => onRemove(row)}><Icon name="close" /></button>
  </article>;
}

// The "versus arena": three fixed slots with a VS medallion between them; only the first empty slot is active.
export default function CompareArena({ course, rows, selected, hydrated, onAdd, onRemove, comboRef }) {
  const total = selected.length;
  const options = rows.filter((row) => !selected.some((item) => item.id === row.id));
  const similar = similarPick(rows, selected);

  return <div className={styles.arena} id="compare-slots">
    <div className={styles.arenaHead}>
      <h2 className={styles.arenaTitle}>{total ? <>Comparing <em>{course.name}</em></> : `Start a ${course.name} comparison`}</h2>
      <p className={styles.arenaMeta}><span className={styles.tag}>Illustrative data</span><span>{total} of {MAX} slots used</span></p>
    </div>

    {!hydrated
      ? <div className={styles.ring} aria-busy="true" aria-label="Loading your comparison">{Array.from({ length: MAX }, (_, index) => <Fragment key={index}>
        {index > 0 && <span className={styles.vs} aria-hidden="true"><span>vs</span></span>}
        <span className={`${styles.slot} ${styles.slotSkeleton}`} />
      </Fragment>)}</div>
      : <div className={styles.ring}>
        {Array.from({ length: MAX }, (_, index) => {
          const row = selected[index];
          const state = row ? 'filled' : index === total ? 'open' : 'waiting';
          return <Fragment key={row?.id || `empty-${index}`}>
            {index > 0 && <span className={styles.vs} data-live={index < total || undefined} data-state={state} aria-hidden="true"><span>vs</span></span>}
            <div className={styles.slot} data-state={state}>
              {row && <FilledSlot row={row} index={index} course={course} onRemove={onRemove} />}
              {state === 'open' && <div className={styles.slotOpen}>
                <p className={styles.openHead}><span className={styles.plusDisc} aria-hidden="true"><Icon name="plus" /></span><span><strong>Add a college</strong><small>Slot {index + 1} of {MAX}</small></span></p>
                {options.length
                  ? <>
                    <AddCollegeCombobox id={`compare-add-${index}`} inputRef={comboRef} courseName={course.name} options={options} onSelect={onAdd}
                      label={`Add a ${course.name} college (slot ${index + 1} of ${MAX})`} />
                    {similar && total > 0 && <button type="button" className={styles.similar} onClick={() => onAdd(similar.row)}>
                      <Icon name="plus" /><span>Add {similar.row.shortName || similar.row.name}<small> · {similar.reason}</small></span>
                    </button>}
                  </>
                  : <p className={styles.noMore}>No other {course.name} colleges are listed yet. <Link href={`/colleges?course=${course.id}`}>Browse {course.name} colleges</Link></p>}
              </div>}
              {state === 'waiting' && <div className={styles.slotWait}><span className={styles.plusDisc} aria-hidden="true"><Icon name="plus" /></span><span>Slot {index + 1}<small>Optional · fills after slot {index}</small></span></div>}
            </div>
          </Fragment>;
        })}
      </div>}

    {hydrated && total === 0 && rows.length > 0 && <div className={styles.quickAdd}>
      <p>Or tap a college to put it in the arena</p>
      <ul>{rows.map((row) => <li key={row.id}>
        <button type="button" className={styles.quickChip} onClick={() => onAdd(row)}><Icon name="plus" />{row.shortName || row.name}<small>{row.city} · {shortFee(row.annualTuitionInr)}/yr</small></button>
      </li>)}</ul>
    </div>}
    {hydrated && total === 1 && <p className={styles.oneMore}><Icon name="compareInfo" />Add one more college to compare. The table below already shows this college&apos;s figures.</p>}
  </div>;
}
