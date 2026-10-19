'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Photo } from './media';
import styles from './Profile.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer nofollow' };

// Photo strip + a dependency-free lightbox: Escape closes, arrows move, Tab is trapped,
// focus returns to the thumbnail that opened it.
export default function Gallery({ photos, name }) {
  const [index, setIndex] = useState(-1);
  const open = index >= 0 && index < photos.length;
  const dialog = useRef(null);
  const opener = useRef(null);
  const touchX = useRef(0);

  const close = useCallback(() => setIndex(-1), []);
  const step = useCallback((delta) => setIndex((current) => (current + delta + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    if (!open) return undefined;
    const node = dialog.current;
    node?.querySelector('[data-close]')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); return; }
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); return; }
      if (event.key !== 'Tab' || !node) return;
      const focusable = [...node.querySelectorAll('button, a[href]')].filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      const edge = event.shiftKey ? focusable[0] : focusable.at(-1);
      if (document.activeElement === edge || !node.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? focusable.at(-1) : focusable[0]).focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener.current?.focus();
    };
  }, [open, close, step]);

  const current = open ? photos[index] : null;
  return <>
    <ul className={styles.gallery}>
      {photos.map((photo, position) => <li key={photo.id}>
        <button type="button" className={styles.shot} aria-haspopup="dialog"
          onClick={(event) => { opener.current = event.currentTarget; setIndex(position); }}>
          <span className={styles.shotFrame}>
            <Photo src={photo.url} sizes="(max-width: 640px) 72vw, (max-width: 1100px) 45vw, 30vw" priority={position === 0} />
          </span>
          <span className={styles.shotMeta}>
            <span>{photo.caption || `Photo ${position + 1}`}</span>
            <small>Photo: {photo.credit}</small>
          </span>
          <span className="sr-only">Open photo {position + 1} of {photos.length} of {name}</span>
        </button>
      </li>)}
    </ul>

    {open && <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={`Photos of ${name}`} ref={dialog}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onTouchStart={(event) => { touchX.current = event.changedTouches[0].clientX; }}
      onTouchEnd={(event) => {
        const delta = event.changedTouches[0].clientX - touchX.current;
        if (Math.abs(delta) > 50) step(delta < 0 ? 1 : -1);
      }}>
      <div className={styles.lightboxInner}>
        <div className={styles.lightboxBar}>
          <p>{index + 1} of {photos.length}</p>
          <button type="button" data-close className={styles.lightboxClose} onClick={close}>
            <Icon name="close" />Close<span className="sr-only"> photo viewer</span>
          </button>
        </div>
        <figure className={styles.lightboxFigure}>
          <div className={styles.lightboxStage}>
            <Photo src={current.url} alt={current.caption || `Photo of ${name}`} sizes="92vw" priority />
            {photos.length > 1 && <>
              <button type="button" className={styles.lightboxNav} data-side="prev" onClick={() => step(-1)}>
                <Icon name="chevron" /><span className="sr-only">Previous photo</span>
              </button>
              <button type="button" className={styles.lightboxNav} data-side="next" onClick={() => step(1)}>
                <Icon name="chevron" /><span className="sr-only">Next photo</span>
              </button>
            </>}
          </div>
          <figcaption>
            {current.caption && <strong>{current.caption}</strong>}
            <span>Photo: {current.credit}
              {current.sourcePage && <> · <a href={current.sourcePage} {...external}>Source page<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a></>}
            </span>
          </figcaption>
        </figure>
      </div>
    </div>}
  </>;
}
