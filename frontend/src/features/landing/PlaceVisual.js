'use client';
import { useState } from 'react';
import { institutionLabel } from '@/features/home/placeCounts';
import styles from './PlaceVisual.module.css';

const TONES = 6;
// Cloudinary resizes and re-encodes on delivery, so a tile never downloads the full upload.
const tileImageUrl = (url) => url.replace('/image/upload/', '/image/upload/c_limit,w_800,q_auto,f_auto/');
// Stable per name, so a place keeps its colour between visits and neighbours rarely match.
const toneOf = (name) => [...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) % TONES;

// A designed tile for places without a photo or artwork. It fills the same box (`className` sets the
// size), so grids keep their rhythm; the link around it already announces the name and count.
function PlaceFallback({ place, className, count }) {
  return <span className={`${className ?? ''} ${styles.frame}`} aria-hidden="true">
    <span className={styles.fallback} data-tone={toneOf(place.name)}>
      <span className={styles.name}>{place.name}</span>
      {count > 0 && <span className={styles.count}>{institutionLabel({ institutions: count })}</span>}
    </span>
  </span>;
}

// Uploaded photo, then a window into the shared landmark artwork (`art` = { src, width, height }),
// then the designed tile. A photo that fails to load (deleted from the library) falls through too.
export default function PlaceVisual({ place, art, className, count = place.institutions, decorative = false }) {
  const [failed, setFailed] = useState('');
  const image = place.image?.url && place.image.url !== failed ? place.image : null;
  if (image) {
    return <img className={`${className ?? ''} ${styles.photo}`} src={tileImageUrl(image.url)} alt={decorative ? '' : image.alt || place.name}
      loading="lazy" decoding="async" onError={() => setFailed(image.url)} />;
  }
  if (art && place.crop) {
    const label = decorative ? { 'aria-hidden': true, focusable: 'false' } : { role: 'img', 'aria-label': `${place.landmark || place.name} — illustrative ${place.name} landmark` };
    return <svg className={className} viewBox={place.crop.join(' ')} preserveAspectRatio="xMidYMid slice" {...label}>
      <image href={art.src} x="0" y="0" width={art.width} height={art.height} />
    </svg>;
  }
  return <PlaceFallback place={place} className={className} count={count} />;
}
