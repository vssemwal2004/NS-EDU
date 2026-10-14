'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './Mega.module.css';

// Compact two-part panel for static groups (Resources).
export default function MegaResources({ group, onNavigate }) {
  return <div className={`${styles.card} ${styles.compactCard}`}>
    <div>
      <p className={styles.label}>{group.label}</p>
      <ul className={styles.compactList}>{group.items.map((item) => <li key={item.href}><Link href={item.href} onClick={onNavigate} className={styles.compactItem}>
        <span className={styles.compactIcon}><Icon name={item.icon} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span>
      </Link></li>)}</ul>
    </div>
    {group.feature && <Link className={styles.feature} href={group.feature.href} onClick={onNavigate}>
      <span className={styles.featureEyebrow}>{group.feature.eyebrow}</span>
      <strong>{group.feature.title}</strong>
      <span>{group.feature.text}</span>
      <span className={styles.featureAction}>{group.feature.action}<Icon name="arrow" /></span>
    </Link>}
  </div>;
}
