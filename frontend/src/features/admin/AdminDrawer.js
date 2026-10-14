'use client';
import { useEffect, useId, useRef } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './ResourceManager.module.css';

// Native <dialog> keeps focus trapping and Escape handling; `confirm` renders as a small centred modal.
export default function AdminDrawer({ open, onClose, title, subtitle, variant = 'drawer', children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  return <dialog ref={dialog} className={styles.drawer} data-variant={variant} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.drawerPanel}>
      <header className={styles.drawerHeader}>
        <div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close"><Icon name="close" /></button>
      </header>
      <div className={styles.drawerBody}>{children}</div>
    </div>
  </dialog>;
}
