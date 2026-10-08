import Icon from '@/components/ui/Icon';
import { BudgetDesk } from './BudgetArtwork';
import styles from './SectionVisuals.module.css';

// Decorative, code-native artwork: no image request, event handler or animation runtime.
export function SectionBackdrop({ variant }) {
  const study = variant === 'study';
  return <div className={`${styles.backdrop} ${study ? styles.study : styles.budget}`} aria-hidden="true">
    <div className={styles.sweep} />
    <div className={styles.grid} />
    <div className={styles.orbit} />
    <span className={`${styles.stamp} ${styles.first}`}><Icon name={study ? 'cap' : 'wallet'} /></span>
    <span className={`${styles.stamp} ${styles.second}`}><Icon name={study ? 'compass' : 'commerce'} /></span>
    <span className={`${styles.stamp} ${styles.third}`}><Icon name={study ? 'book' : 'chart'} /></span>
    <svg className={styles.sketch} viewBox="0 0 500 130" fill="none" stroke="currentColor" strokeWidth="1.2" focusable="false">
      <path d="M0 114h500M28 114V60h45v54M37 71h8m13 0h8M37 85h8m13 0h8M37 99h8m13 0h8M84 114V44h36V23l28-18 28 18v21h36v70M120 44h56M127 23h42M137 31h21M95 58h9m0 14h-9m0 14h9m0 14h-9M188 58h9m0 14h-9m0 14h9m0 14h-9M134 114V83q14-23 28 0v31M235 114V58h62v56M245 70h11m15 0h11M245 85h11m15 0h11M245 100h11m15 0h11M313 114v-34m-12-4q-11-24 9-27 22-5 20 15 16 4 5 17-10 10-22-1M353 114v-14m-13-9q-5-26 16-25 17 0 18 15 12 15-7 16-13 5-19-6" />
      <path d="M408 114v-34m-14 11q-12-12 2-21 13-4 13 10m0-7q9-21 21-12 11 14-9 24M462 114v-28m-12 10q-11-9 0-17 10-3 12 9m0-5q8-19 18-10 8 11-7 18" />
    </svg>
  </div>;
}

export function StudyPathGraphic({ className = '' }) {
  return <svg className={`${styles.studyPath} ${className}`} viewBox="0 0 300 82" fill="none" aria-hidden="true" focusable="false">
    <path d="M38 57C78 10 116 17 151 47S224 71 264 28" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 5" />
    <circle cx="48" cy="43" r="24" fill="var(--section-visual-paper)" stroke="var(--section-visual-line)" />
    <g transform="translate(32 27) scale(1.3)" stroke="var(--color-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v16M3 3h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v17h-5a4 4 0 0 0-4 1 4 4 0 0 0-4-1H3Z" /></g>
    <g transform="translate(126 12) rotate(8 18 24)"><rect width="36" height="48" rx="4" fill="var(--color-surface)" stroke="var(--section-visual-line)" /><path d="M8 11h20M8 17h20M8 23h12" stroke="var(--color-accent)" /><circle cx="25" cy="34" r="5" fill="var(--section-visual-rose)" /><path d="m22 39-1 7 4-2 4 2-1-7" stroke="var(--color-primary)" /></g>
    <circle cx="246" cy="42" r="29" fill="var(--section-visual-rose)" />
    <g transform="translate(225 20) scale(1.8)" stroke="var(--color-primary)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"><path d="m2 8 10-5 10 5-10 5-10-5Zm4 2v7c4 3 8 3 12 0v-7m4-2v8" /></g>
    <path d="M90 61v8m-4-4h8M196 13v8m-4-4h8" stroke="var(--color-accent)" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="8" cy="27" r="2" fill="var(--color-primary)" /><circle cx="286" cy="65" r="2" fill="var(--color-accent)" />
  </svg>;
}

export function BudgetHeaderGraphic({ className = '' }) {
  return <div className={`${styles.budgetArt} ${className}`} aria-hidden="true">
    <span className={styles.artOrbit} />
    <BudgetDesk className={styles.notebook} />
    <span className={styles.wallet}><Icon name="wallet" /></span>
    <span className={styles.coin}>₹</span>
    <span className={styles.spark}><Icon name="spark" /></span>
  </div>;
}

export function BudgetResultGraphic({ className = '' }) {
  return <div className={`${styles.resultArt} ${className}`} aria-hidden="true"><Icon name="wallet" /><span>₹</span></div>;
}
