'use client';
// Centred modal on the native <dialog> (focus trap, Escape, backdrop) for the lead action forms.
// `icon` shows the action's icon in the oxblood badge beside the serif title.
import { useEffect, useId, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './DialogShell.module.css';

export default function DialogShell({ open, onClose, title, subtitle, icon, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.panel}>
      <header className={styles.head}>
        {icon && <span className={styles.badge} aria-hidden="true"><Icon name={icon} /></span>}
        <div className={styles.titles}><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  </dialog>;
}
