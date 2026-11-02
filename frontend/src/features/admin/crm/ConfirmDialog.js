'use client';
// A small centred confirmation modal on the native <dialog> (focus trap + Esc come for free).
//
//   <ConfirmDialog open={open} tone="danger" title="Delete 3 leads?" confirmLabel="Delete leads" busy={busy}
//     onConfirm={run} onCancel={() => setOpen(false)}>They move to the Lead bin and can be restored by an owner.</ConfirmDialog>
//
// `requireText="DELETE"` makes the person type the word first (for irreversible actions).
// `error` shows a failure from the last attempt inside the dialog so the person can retry.
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './ConfirmDialog.module.css';

export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', icon, busy = false, requireText, error, onConfirm, onCancel }) {
  const dialog = useRef(null);
  const cancelButton = useRef(null);
  const input = useRef(null);
  const [typed, setTyped] = useState('');
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) { setTyped(''); node.showModal(); (requireText ? input.current : cancelButton.current)?.focus(); }
    if (!open && node.open) node.close();
  }, [open, requireText]);

  const armed = !requireText || typed.trim() === requireText;
  const danger = tone === 'danger';
  return <dialog ref={dialog} className={styles.dialog} data-tone={tone} aria-labelledby={titleId} aria-describedby={bodyId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <form method="dialog" className={styles.panel} onSubmit={(event) => { event.preventDefault(); if (armed && !busy) onConfirm(); }}>
      <span className={styles.badge} aria-hidden="true"><Icon name={icon ?? (danger ? 'alert' : 'check')} /></span>
      <div className={styles.copy}>
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className={styles.body}>{children}</div>
        {requireText && <label className={styles.type}><span>Type <strong>{requireText}</strong> to confirm</span>
          <input ref={input} value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} aria-invalid={typed.length > 0 && !armed} />
        </label>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </div>
      <div className={styles.actions}>
        <button ref={cancelButton} type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
        <button type="submit" className={styles.confirm} data-tone={tone} disabled={!armed || busy} aria-busy={busy || undefined}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </form>
  </dialog>;
}
