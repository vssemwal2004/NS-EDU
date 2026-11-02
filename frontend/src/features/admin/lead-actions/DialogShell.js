'use client';
// Centred modal on the native <dialog> (focus trap, Escape, backdrop) for the lead action forms.
import { useEffect, useId, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './DialogShell.module.css';

export default function DialogShell({ open, onClose, title, subtitle, children }) {
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
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </header>
      <div className={styles.body}>{children}</div>
    </div>
  </dialog>;
}
