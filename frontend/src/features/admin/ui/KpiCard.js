import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './Charts.module.css';

/** One headline number. `value` null (a count that timed out) shows a dash; `loading` shows a skeleton. */
export default function KpiCard({ label, value, note, icon, href, loading = false }) {
  const body = <>
    <span className={styles.kpiLabel}>{label}</span>
    {loading
      ? <span className={styles.kpiSkeleton} aria-hidden="true" />
      : <strong className={styles.kpiValue}>{typeof value === 'number' ? value.toLocaleString('en-IN') : <><span aria-hidden="true">—</span><span className="sr-only">Not available</span></>}</strong>}
    {note && !loading && <span className={styles.kpiNote}>{note}</span>}
    {icon && <span className={styles.kpiIcon} aria-hidden="true"><Icon name={icon} /></span>}
  </>;
  if (loading) return <div className={styles.kpi} aria-busy="true"><span className="sr-only">Loading</span>{body}</div>;
  return href ? <Link className={styles.kpi} href={href}>{body}</Link> : <div className={styles.kpi}>{body}</div>;
}
