'use client';
import Icon from '@/components/ui/Icon';
import styles from './Table.module.css';

/** One removable chip per active filter: chips = [{ key, label, onRemove }]. Renders nothing when empty. */
export default function ActiveFilterChips({ chips, onClearAll, label = 'Active filters' }) {
  if (!chips.length) return null;
  return <div className={styles.activeChips} role="group" aria-label={label}>
    {chips.map((chip) => <span key={chip.key} className={styles.activeChip}>
      <span>{chip.label}</span>
      <button type="button" onClick={chip.onRemove} aria-label={`Remove filter: ${chip.label}`}><Icon name="close" /></button>
    </span>)}
    {onClearAll && <button type="button" className={styles.clearAll} onClick={onClearAll}>Clear all</button>}
  </div>;
}
