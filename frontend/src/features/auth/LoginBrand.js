'use client';
import Icon from '@/components/ui/Icon';
import { getHeroImage } from '@/lib/hero-image';
import { useCatalog } from '@/providers/CatalogProvider';
import { accountBenefits, catalogStats, COMPARE_MAX } from './login-helpers';
import styles from './LoginDrawer.module.css';

// Wine brand panel: desktop column, tablet strip, mobile sheet header (see the CSS module).
export default function LoginBrand({ minutes, showPhoto }) {
  const stats = catalogStats(useCatalog());
  return <aside className={styles.brand} aria-label="Why log in">
    <span className={styles.handle} aria-hidden="true" />
    <svg className={styles.brandLines} viewBox="0 0 400 640" fill="none" aria-hidden="true"><path d="M-20 520C90 470 150 560 260 520s120-90 180-80M-20 560c110-40 170 50 280 10s120-90 180-80M300-10c-20 70 10 120 70 150" /><circle cx="360" cy="70" r="46" /><circle cx="360" cy="70" r="70" /></svg>
    <p className={styles.brandEyebrow}><Icon name="spark" />Student space</p>
    <p className={styles.brandTitle}>Your college search, <em>in one place.</em></p>
    <div className={styles.photo} aria-hidden="true">
      <span className={styles.arch}>
        {showPhoto && <svg viewBox="940 150 540 560" preserveAspectRatio="xMidYMid slice"><image href={getHeroImage().src} x="0" y="0" width="1672" height="941" /></svg>}
      </span>
      <span className={`${styles.sticker} ${styles.stickerCompare}`}><Icon name="scales" />Compare up to {COMPARE_MAX} colleges</span>
      <span className={`${styles.sticker} ${styles.stickerCode}`}><Icon name="shield" />6-digit code · valid {minutes} min</span>
    </div>
    <ul className={styles.benefits}>
      {accountBenefits.map((item) => <li key={item.title}><span className={styles.benefitIcon}><Icon name={item.icon} /></span><span><strong><span className={styles.longTitle}>{item.title}</span><span className={styles.shortTitle}>{item.short}</span></strong><small>{item.text}</small></span></li>)}
    </ul>
    <div className={styles.stats}>
      <dl>{stats.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
      <p>Illustrative catalogue</p>
    </div>
  </aside>;
}
