'use client';
// The bar that appears above a list once rows are ticked: "N selected", a few quick buttons, and one
// global "⋮" menu holding every bulk action (the same item shape as RowMenu), then Clear.
//
//   <BulkBar count={selected.length} noun={['lead', 'leads']} onClear={() => setSelected([])}
//     quick={[{ key: 'assign', label: 'Assign', icon: 'userPlus', onSelect: … }]}
//     menu={[{ key: 'status', label: 'Change stage…', icon: 'trend', onSelect: … }, { divider: true },
//            { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', onSelect: … }]} />
//
// `quick` items render as small buttons (hidden ones are skipped); `menu` items go into the ⋮ menu.
// Every action the user lacks permission for should be `hidden`, so the bar only offers what will work.
import Icon from '@/components/ui/Icon';
import RowMenu from './RowMenu';
import styles from './BulkBar.module.css';

export default function BulkBar({ count, noun = ['item', 'items'], onClear, quick = [], menu = [], busy = false, children }) {
  if (!count) return null;
  const label = `${count.toLocaleString('en-IN')} ${count === 1 ? noun[0] : noun[1]} selected`;
  return <div className={styles.bar} role="region" aria-label="Bulk actions" aria-busy={busy || undefined}>
    <strong className={styles.count} aria-live="polite">{label}</strong>
    {quick.filter((item) => item && !item.hidden).map((item) => <button key={item.key} type="button" className="adm-btn adm-btn--sm" data-tone={item.tone}
      disabled={busy || item.disabled} title={item.disabled ? item.reason : undefined} onClick={item.onSelect}>
      {item.icon && <Icon name={item.icon} />}{item.label}
    </button>)}
    {children}
    <RowMenu label={`Bulk actions for ${label}`} items={menu} className={styles.more}
      trigger={<><Icon name="more" /><span className={styles.moreText}>More actions</span></>} />
    <button type="button" className={`adm-btn adm-btn--sm adm-btn--ghost ${styles.clear}`} onClick={onClear} disabled={busy}><Icon name="close" />Clear</button>
  </div>;
}
