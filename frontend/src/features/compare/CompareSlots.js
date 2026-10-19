'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatTuition } from '@/lib/college-catalog';
import AddCollegeCombobox from './AddCollegeCombobox';
import { MAX, similarPick } from './compare-data';
import styles from './Compare.module.css';

// Three fixed slots sharing the table's column tracks; only the first empty slot is active.
export default function CompareSlots({ course, rows, selected, onAdd, onRemove, comboRef }) {
  const options = rows.filter((row) => !selected.some((item) => item.id === row.id));
  const similar = similarPick(rows, selected);
  const firstEmpty = selected.length;

  return <div className={styles.slots} id="compare-slots">
    <div className={styles.slotsLabel}>
      <p className={styles.kicker}><Icon name={course.icon || 'cap'} />Your selection</p>
      <h2>Comparing <em>{course.name}</em></h2>
      <p className={styles.slotsMeta}><span className={styles.illustrative}>Illustrative data</span><span>{selected.length} of {MAX} slots used</span></p>
      <p className={styles.slotsNote}>Ratings shown are demo ratings, not student reviews.</p>
    </div>
    {Array.from({ length: MAX }, (_, index) => {
      const row = selected[index];
      if (row) return <div key={row.id} className={styles.slot} data-state="filled">
        <article className={styles.slotCard} aria-labelledby={`slot-${row.id}`}>
          <div className={styles.slotArt}>
            <CollegeArtwork row={row} className={styles.slotThumb} />
            <span className={styles.slotIndex} aria-hidden="true">{index + 1}</span>
          </div>
          <div className={styles.slotBody}>
            <h3 id={`slot-${row.id}`}>{row.name}</h3>
            <p className={styles.slotCity}><Icon name="location" />{row.city}{row.state ? `, ${row.state}` : ''}</p>
            <p className={styles.slotFacts}><span>{formatTuition(row.annualTuitionInr)}/yr</span><span className={styles.illustrative}>Illustrative</span></p>
            <Link className={`text-link ${styles.slotLink}`} href={`/universities/${row.collegeId}`}>View college<Icon name="arrow" /></Link>
          </div>
          <button type="button" className={`icon-button ${styles.slotRemove}`} aria-label={`Remove ${row.name} from comparison`} onClick={() => onRemove(row)}><Icon name="close" /></button>
        </article>
      </div>;
      if (index !== firstEmpty) return <div key={`empty-${index}`} className={styles.slot} data-state="waiting">
        <div className={styles.slotPlaceholder}><span className={styles.plusDisc} aria-hidden="true"><Icon name="plus" /></span><span>Slot {index + 1}<small>Optional · fills after slot {index}</small></span></div>
      </div>;
      return <div key={`empty-${index}`} className={styles.slot} data-state="open">
        <div className={styles.slotEmpty}>
          <p className={styles.slotEmptyHead}><span className={styles.plusDisc} aria-hidden="true"><Icon name="plus" /></span><span><strong>Add college</strong><small>Slot {index + 1} of {MAX}</small></span></p>
          {options.length
            ? <>
              <AddCollegeCombobox id={`compare-add-${index}`} inputRef={comboRef} courseName={course.name} options={options} onSelect={(item) => onAdd(item)}
                label={`Add a ${course.name} college (slot ${index + 1} of ${MAX})`} align={index === MAX - 1 ? 'end' : 'start'} />
              {similar && <button type="button" className={`button button--ghost ${styles.similar}`} onClick={() => onAdd(similar.row)}>
                <Icon name="plus" /><span>Add {similar.row.shortName || similar.row.name}<small> · {similar.reason}</small></span>
              </button>}
            </>
            : <p className={styles.noMore}>No other {course.name} colleges are listed yet. <Link href={`/colleges?course=${course.id}`}>Browse {course.name} colleges</Link></p>}
        </div>
      </div>;
    })}
  </div>;
}
