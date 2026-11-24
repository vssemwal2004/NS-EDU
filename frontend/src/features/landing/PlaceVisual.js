'use client';
import { useState } from 'react';
import { resizedImage } from '@/lib/image-url';
import styles from './PlaceVisual.module.css';

const TONES = 6;
const tileImageUrl = (url) => resizedImage(url, 800);
// Stable per name, so a place keeps its colour between visits and neighbours rarely match.
const toneOf = (name) => [...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7) % TONES;

// A designed tile for places without a photo or artwork. It fills the same box (`className` sets the
// size), so grids keep their rhythm. Every caller already prints the name and count beside the tile,
// so the tile itself carries only a monogram: repeating them inside the picture read as a duplicate.
function PlaceFallback({ place, className }) {
  return <span className={`${className ?? ''} ${styles.frame}`} aria-hidden="true">
    <span className={styles.fallback} data-tone={toneOf(place.name)}>
      <span className={styles.monogram}>{place.name.trim().slice(0, 1)}</span>
    </span>
  </span>;
}

// Featured places with known crops use the matching landmark from the shared artwork.
// Other places use an uploaded photo, then the designed tile.
export default function PlaceVisual({ place, art, className, decorative = false }) {
  const [failed, setFailed] = useState('');
  if (art && place.crop) {
    const label = decorative ? { 'aria-hidden': true, focusable: 'false' } : { role: 'img', 'aria-label': `${place.landmark || place.name} — illustrative ${place.name} landmark` };
    return <svg className={className} viewBox={place.crop.join(' ')} preserveAspectRatio="xMidYMid slice" {...label}>
      <image href={art.src} x="0" y="0" width={art.width} height={art.height} />
    </svg>;
  }
  const image = place.image?.url && place.image.url !== failed ? place.image : null;
  if (image) {
    return <img className={`${className ?? ''} ${styles.photo}`} src={tileImageUrl(image.url)} alt={decorative ? '' : image.alt || place.name} title={image.credit || undefined}
      loading="lazy" decoding="async" onError={() => setFailed(image.url)} />;
  }
  return <PlaceFallback place={place} className={className} />;
}
