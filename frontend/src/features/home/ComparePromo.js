'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { UNI_COMPARE_MAX, uniCompareHref, useUniCompare } from '@/features/compare/institutionStore';
import styles from './Home.module.css';

// What a comparison lines up, in the order the board shows it.
const POINTS = [
  { icon: 'wallet', label: 'Fees' },
  { icon: 'trend', label: 'Placements' },
  { icon: 'shield', label: 'NAAC & NIRF' },
  { icon: 'building', label: 'Campus' },
];

// Points at the institution comparison (/compare): any universities from the directory, side by
// side. When the student already has a shortlist in this browser, it offers to open it instead.
export default function ComparePromo() {
  const shortlist = useUniCompare();
  const ready = shortlist.count >= 2;
  return <section className={styles.promoBand} aria-labelledby="compare-promo-title">
    <div className="container"><div className={styles.promo}>
      <span className={styles.promoIcon}><Icon name="scales" /></span>
      <div className={styles.promoCopy}>
        <h2 id="compare-promo-title">{ready ? `${shortlist.count} universities ready to compare` : `Compare up to ${UNI_COMPARE_MAX} universities side by side`}</h2>
        <p>{ready ? 'Your shortlist is saved in this browser.' : 'Pick from any profile with “Compare”, then see every figure line up — the best value in each row is marked.'}</p>
      </div>
      <ul className={styles.promoPoints} aria-label="What a comparison shows">
        {POINTS.map((point) => <li key={point.label}><Icon name={point.icon} />{point.label}</li>)}
      </ul>
      <Link className={`button button--primary ${styles.promoAction}`} href={uniCompareHref(shortlist.slugs)}>{ready ? 'Open comparison' : 'Start comparing'}<Icon name="arrow" /></Link>
    </div></div>
  </section>;
}
