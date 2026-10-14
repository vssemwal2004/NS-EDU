'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { COMPARE_MAX, compareHref, useCompare } from './compareStore';
import styles from './Profile.module.css';

// Add/remove one programme in the shared nsedu:compare store, with inline + announced feedback.
export default function CompareToggle({ row, courseName, className = '', compact = false, showStatus = true }) {
  const { colleges } = useCatalog();
  const compare = useCompare(colleges);
  const [message, setMessage] = useState(null);
  const pressed = compare.has(row.id);
  const count = compare.count(row.courseId);

  function toggle() {
    const result = compare.toggle(row);
    setMessage(result === 'full'
      ? { full: true, text: `You can compare up to ${COMPARE_MAX} ${courseName} colleges. Remove one to add another.` }
      : { full: false, text: result === 'added' ? `${row.shortName} ${courseName} added · ${count + 1}/${COMPARE_MAX}` : `${row.shortName} ${courseName} removed from compare` });
  }

  return <div className={`${styles.toggle} ${className}`}>
    <button type="button" className={`button ${pressed ? 'button--primary' : 'button--outline'}`} aria-pressed={pressed} onClick={toggle}>
      <Icon name={pressed ? 'check' : 'compare'} />{compact ? (pressed ? 'Added' : 'Compare') : pressed ? 'Added to compare' : 'Add to compare'}
      <span className="sr-only"> {row.shortName} {courseName}</span>
    </button>
    {showStatus && (message?.full || count > 0) && <p className={styles.toggleNote} data-full={message?.full || undefined}>
      {message?.full ? message.text : `${count}/${COMPARE_MAX} ${courseName} picked`}
      {' '}<Link href={compareHref(row.courseId)}>{message?.full ? 'Review picks' : 'Compare now'}<span className="sr-only"> for {courseName}</span></Link>
    </p>}
    <span className="sr-only" role="status" aria-live="polite">{message?.text || ''}</span>
  </div>;
}
