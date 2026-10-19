'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import QuickApplyForm from './QuickApplyForm';
import UniversityMark from './UniversityMark';
import styles from './QuickApplyDialog.module.css';

const place = (university) => [university.city, university.state].filter(Boolean).join(', ');

// The quick-apply popup: a centred dialog on larger screens, a bottom sheet on phones.
// Native <dialog> + showModal() gives the focus trap, Escape and an inert page; focus returns to the
// Apply button on close. Closing a half-filled form asks first. Mounted fresh for every open.
export default function QuickApplyDialog({ university, courseSlug, onClosed }) {
  const id = useId();
  const dialog = useRef(null);
  const keepRef = useRef(null);
  const dirty = useRef(false);
  const pressedBackdrop = useRef(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    if (!node.open) node.showModal();
  }, []);
  useEffect(() => { if (confirming) keepRef.current?.focus(); }, [confirming]);

  const close = () => dialog.current?.close();
  function requestClose() {
    if (confirming) setConfirming(false);
    else if (dirty.current) setConfirming(true);
    else close();
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-lead`}
    onClose={() => { if (!dialog.current?.open) onClosed(); }}
    onCancel={(event) => { event.preventDefault(); requestClose(); }}
    onPointerDown={(event) => { pressedBackdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => { if (pressedBackdrop.current && event.target === event.currentTarget) requestClose(); pressedBackdrop.current = false; }}>
    <div className={styles.shell} inert={confirming || undefined}>
      <header className={styles.head}>
        <span className={styles.handle} aria-hidden="true" />
        <UniversityMark university={university} />
        <div className={styles.headText}>
          <p className={styles.eyebrow}>Quick apply<span aria-hidden="true">·</span>One screen</p>
          <h2 id={`${id}-title`} className={styles.title}>{university.name}</h2>
          {place(university) && <p className={styles.place}><Icon name="location" />{place(university)}</p>}
        </div>
        <button type="button" className={styles.close} aria-label="Close quick apply" onClick={requestClose}><Icon name="close" /></button>
      </header>
      <div className={styles.body}>
        <p id={`${id}-lead`} className={styles.lead}>Gyaan Vidhya’s admissions team receives this and a counsellor calls you to take it forward with the university.</p>
        <QuickApplyForm university={university} courseSlug={courseSlug} variant="dialog"
          onDirtyChange={(value) => { dirty.current = value; }} onDone={close} />
      </div>
    </div>
    {confirming && <div className={styles.confirm} role="alertdialog" aria-modal="true" aria-labelledby={`${id}-confirm`} aria-describedby={`${id}-confirm-text`}>
      <div className={styles.confirmCard}>
        <h3 id={`${id}-confirm`}>Leave this application?</h3>
        <p id={`${id}-confirm-text`}>What you typed has not been sent and will be lost.</p>
        <div className={styles.confirmActions}>
          <button ref={keepRef} type="button" className="lux-button lux-button--primary" onClick={() => setConfirming(false)}>Keep editing</button>
          <button type="button" className="lux-button lux-button--ghost" onClick={() => { dirty.current = false; setConfirming(false); close(); }}>Discard</button>
        </div>
      </div>
    </div>}
  </dialog>;
}
