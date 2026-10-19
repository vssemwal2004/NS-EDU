'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useTracking } from '@/providers/TrackingProvider';
import { UNI_COMPARE_MAX, useUniCompare } from './institutionStore';
import styles from './InstitutionCompare.module.css';

/**
 * Shortlist toggle for a directory card or a profile header. Drop it anywhere:
 *   <CompareToggle slug={item.id} name={item.name} />
 * It writes the same shortlist /compare reads, so the student builds the comparison while browsing.
 * Renders nothing until hydration so the server HTML never claims a state it cannot know.
 */
export default function CompareToggle({ slug, name, size = 'sm', className = '' }) {
  const store = useUniCompare();
  const { trackCompare } = useTracking();
  const [note, setNote] = useState(null);
  const selected = store.has(slug);

  useEffect(() => {
    if (!note) return undefined;
    const timer = window.setTimeout(() => setNote(null), 3600);
    return () => window.clearTimeout(timer);
  }, [note]);

  if (!store.ready) return <span className={`${styles.toggle} ${className}`} data-size={size} data-placeholder="true" aria-hidden="true"><Icon name="compare" />Compare</span>;

  return <span className={styles.toggleWrap}>
    <button type="button" className={`${styles.toggle} ${className}`} data-size={size} aria-pressed={selected}
      onClick={() => {
        const result = store.toggle(slug);
        if (result === 'added') trackCompare(slug);
        setNote(result === 'full'
          ? { blocking: true, text: `Shortlist is full (${UNI_COMPARE_MAX}). Remove one on the compare page first.` }
          : { blocking: false, text: result === 'added' ? `${name} added to the comparison` : `${name} removed from the comparison` });
      }}>
      <Icon name={selected ? 'check' : 'compare'} />{selected ? 'In compare' : 'Compare'}
      <span className="sr-only">: {name}</span>
    </button>
    {/* Only the blocking message takes space; a plain add/remove is announced without moving the card. */}
    <span className={note?.blocking ? styles.toggleNote : 'sr-only'} role="status">{note?.text ?? ''}</span>
  </span>;
}
