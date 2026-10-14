'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { COMPARE_MAX, compareHref, useCompare } from './compareStore';
import styles from './Profile.module.css';

// Adds both programmes when there is room, then opens /compare. Never drops an existing pick.
export default function PairCompare({ rows, courseName }) {
  const { colleges } = useCatalog();
  const compare = useCompare(colleges);
  const router = useRouter();
  const [full, setFull] = useState(false);
  const href = compareHref(rows[0].courseId);

  function run() {
    if (compare.addAll(rows) === 'full') { setFull(true); return; }
    router.push(href);
  }

  return <div className={styles.pairAction}>
    <button type="button" className="button button--outline" onClick={run}><Icon name="compare" />Compare these<span className="sr-only">: {rows.map((row) => row.shortName).join(' and ')}, {courseName}</span></button>
    <p role="status" aria-live="polite">{full && <>Your {courseName} list already has {compare.count(rows[0].courseId)} of {COMPARE_MAX}. <Link href={href}>Open compare</Link> to make room.</>}</p>
  </div>;
}
