import styles from '@/features/universities/profile/Boundary.module.css';

// Instant shell while a profile loads: the cover, ribbon and two section blocks, sized like the real page.
export default function Loading() {
  return <main id="main" className={styles.page} aria-busy="true">
    <div className={`lux-surface-dark ${styles.cover}`}>
      <div className={`lux-container ${styles.coverInner}`}>
        <span className={styles.medallion} />
        <div className={styles.lines}><span /><span /><span /></div>
      </div>
    </div>
    <div className="lux-container">
      <div className={`lux-skeleton ${styles.ribbon}`} />
      <div className={styles.blocks}><span className="lux-skeleton" /><span className="lux-skeleton" /><span className="lux-skeleton" /></div>
    </div>
    <p className="sr-only" role="status">Loading university profile…</p>
  </main>;
}
