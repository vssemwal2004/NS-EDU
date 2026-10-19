import styles from './QuickApply.module.css';

const initials = (name = '') => name.replace(/\(.*?\)/g, '').split(/\s+/).filter((word) => /^[A-Z]/.test(word) && !/^(Of|The|And)$/.test(word)).slice(0, 2).map((word) => word[0]).join('') || name.slice(0, 1).toUpperCase();

// University logo (remote, any official site, so a plain <img>) or a monogram when there is none.
export default function UniversityMark({ university, size = 'md' }) {
  return <span className={styles.mark} data-size={size} aria-hidden="true">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {university.logoUrl ? <img src={university.logoUrl} alt="" width={56} height={56} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : initials(university.name)}
  </span>;
}
