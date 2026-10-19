'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import UniversityCombobox from './UniversityCombobox';
import styles from './ApplyPicker.module.css';

// /apply without a university: pick one, then the page reloads as /apply?university=<slug> with the form.
export default function ApplyPicker({ id = 'apply-university', autoFocus = false }) {
  const router = useRouter();
  const [picked, setPicked] = useState(null);
  const [pending, startTransition] = useTransition();
  function select(university) {
    setPicked(university);
    if (university) startTransition(() => router.push(`/apply?university=${encodeURIComponent(university.id)}`, { scroll: false }));
  }
  return <div className={styles.picker} aria-busy={pending || undefined}>
    <label className={styles.label} htmlFor={id}>Which university do you want to apply to?</label>
    <UniversityCombobox id={id} value={picked} onSelect={select} autoFocus={autoFocus} describedBy={`${id}-hint`} />
    <p id={`${id}-hint`} className={styles.hint}>{pending && picked ? `Opening the form for ${picked.name}…` : 'Type at least two letters of the name, short name or city.'}</p>
  </div>;
}
