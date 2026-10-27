'use client';
import { useId } from 'react';
import { getDestinationImage } from '@/lib/destination-image';
import { useContent } from '@/providers/ContentProvider';
import PlaceVisual from './PlaceVisual';
import styles from './LocationDiscovery.module.css';

// Crops are windows into `media.destinationsArt` (1784 × 882 by default).
function useDestinationArt() {
  const art = useContent('media')?.destinationsArt;
  const src = getDestinationImage(art);
  return src ? { src, width: art.width, height: art.height } : null;
}

// Always fills its box: uploaded photo, landmark crop, or the designed tile (see PlaceVisual).
export function DestinationArt({ destination, className }) {
  const art = useDestinationArt();
  return <PlaceVisual place={destination} art={art} className={className} />;
}

export function LocationBackdrop({ className }) {
  const id = useId();
  const art = useDestinationArt();
  return <div className={className} aria-hidden="true">
    {art && <svg className={styles.campusSketch} viewBox="1315 0 469 122" focusable="false">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset=".65" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-mask`}><rect x="1315" y="0" width="469" height="122" fill={`url(#${id}-fade)`} /></mask>
      </defs>
      <image href={art.src} x="0" y="0" width={art.width} height={art.height} mask={`url(#${id}-mask)`} />
    </svg>}
    {art && <svg className={styles.treeSketch} viewBox="0 770 80 112" focusable="false">
      <defs><clipPath id={`${id}-tree`}><rect x="0" y="770" width="45" height="112" /></clipPath></defs>
      <image href={art.src} x="0" y="0" width={art.width} height={art.height} clipPath={`url(#${id}-tree)`} />
    </svg>}
    <svg className={styles.contours} viewBox="0 0 1784 882" preserveAspectRatio="none" focusable="false">
      <g fill="none" stroke="var(--color-art)" strokeWidth="1" opacity=".32">
        <path d="M-15 70Q85 65 165-12M-15 82Q100 74 185-12M1380-12Q1580 92 1800 70" />
        <path d="M-12 830Q84 816 182 895M-12 845Q91 830 155 895M1610 895Q1700 802 1800 760" />
      </g>
    </svg>
  </div>;
}
