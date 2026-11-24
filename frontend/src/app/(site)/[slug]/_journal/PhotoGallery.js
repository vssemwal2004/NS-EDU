'use client';
import Image from '@/components/ui/StudentImage';
import { companyImageSources, studentImageUrl } from '@/lib/student-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import styles from './gallery.module.css';

// Only site paths or https URLs from the admin-edited `pages` content are rendered.
const validSrc = (src) => typeof src === 'string' && (/^\/(?!\/)[\w\-./%]+$/.test(src) || /^https:\/\/[^\s/@]+\/\S+$/.test(src));
const usable = (photo) => photo && validSrc(photo.src) && Number.isInteger(photo.width) && Number.isInteger(photo.height) && photo.width > 0 && photo.height > 0;

function GalleryImage({ photo, ...props }) {
  const srcSet = companyImageSources(photo.src, photo.width);
  const dimensions = { width: photo.width, height: photo.height, alt: photo.alt || '' };
  if (srcSet) return <img {...dimensions} {...props} src={studentImageUrl(photo.src)} srcSet={srcSet} decoding="async" />;
  return <Image {...dimensions} {...props} src={photo.src} />;
}

/**
 * Photo wall with category filters and a keyboard-friendly lightbox (← → to move, Esc to close).
 * `gallery` = { categories: [{ id, label }], photos: [{ src, width, height, alt, caption, category }] }.
 */
export default function PhotoGallery({ gallery }) {
  const photos = useMemo(() => (gallery?.photos ?? []).filter(usable), [gallery]);
  const categories = useMemo(() => (gallery?.categories ?? []).filter((category) => photos.some((photo) => photo.category === category.id)), [gallery, photos]);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(-1);
  const shown = filter === 'all' ? photos : photos.filter((photo) => photo.category === filter);
  const current = shown[open];

  const step = useCallback((delta) => setOpen((index) => (index + delta + shown.length) % shown.length), [shown.length]);
  useEffect(() => {
    if (open < 0) return undefined;
    const onKey = (event) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  if (!photos.length) return null;
  return <div className={styles.gallery}>
    {categories.length > 1 && <div className={styles.filters} role="group" aria-label="Filter photos">
      {[{ id: 'all', label: 'All photos' }, ...categories].map((category) => {
        const count = category.id === 'all' ? photos.length : photos.filter((photo) => photo.category === category.id).length;
        return <button key={category.id} type="button" className={styles.filter} aria-pressed={filter === category.id} onClick={() => { setFilter(category.id); setOpen(-1); }}>
          {category.label}<span>{count}</span>
        </button>;
      })}
    </div>}
    <ul className={styles.wall} aria-label={`${shown.length} photos`}>
      {shown.map((photo, index) => <li key={photo.src}>
        <button type="button" className={styles.thumb} onClick={() => setOpen(index)} aria-label={`Open photo: ${photo.caption || photo.alt}`}>
          <GalleryImage photo={photo} sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 260px" loading={index < 3 ? 'eager' : 'lazy'} />
          {photo.caption && <span className={styles.caption}>{photo.caption}</span>}
          <span className={styles.zoom} aria-hidden="true"><Icon name="plus" /></span>
        </button>
      </li>)}
    </ul>
    <Dialog open={Boolean(current)} onClose={() => setOpen(-1)} title={current ? `Photo ${open + 1} of ${shown.length}` : ''} variant={styles.lightbox}>
      {current && <figure className={styles.figure}>
        <div className={styles.stage}>
          <GalleryImage key={current.src} photo={current} sizes="(max-width: 1100px) 100vw, 1100px" className={styles.full} loading="eager" fetchPriority="high" />
          {shown.length > 1 && <>
            <button type="button" className={`${styles.nav} ${styles.prev}`} onClick={() => step(-1)} aria-label="Previous photo"><Icon name="chevron" /></button>
            <button type="button" className={`${styles.nav} ${styles.next}`} onClick={() => step(1)} aria-label="Next photo"><Icon name="chevron" /></button>
          </>}
        </div>
        {(current.caption || current.alt) && <figcaption>{current.caption || current.alt}</figcaption>}
      </figure>}
    </Dialog>
  </div>;
}
