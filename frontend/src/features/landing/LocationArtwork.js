import { useId } from 'react';
import { getDestinationImage } from '@/lib/destination-image';
import styles from './LocationDiscovery.module.css';

export function DestinationArt({ destination, className }) {
  return <svg className={className} viewBox={destination.crop.join(' ')} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${destination.landmark} — illustrative ${destination.name} landmark`}>
    <image href={getDestinationImage()} x="0" y="0" width="1784" height="882" />
  </svg>;
}

export function LocationBackdrop({ className }) {
  const id = useId();
  return <div className={className} aria-hidden="true">
    <svg className={styles.campusSketch} viewBox="1315 0 469 122" focusable="false">
      <defs>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" />
          <stop offset=".65" stopColor="white" />
          <stop offset="1" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-mask`}><rect x="1315" y="0" width="469" height="122" fill={`url(#${id}-fade)`} /></mask>
      </defs>
      <image href={getDestinationImage()} x="0" y="0" width="1784" height="882" mask={`url(#${id}-mask)`} />
    </svg>
    <svg className={styles.treeSketch} viewBox="0 770 80 112" focusable="false">
      <defs><clipPath id={`${id}-tree`}><rect x="0" y="770" width="45" height="112" /></clipPath></defs>
      <image href={getDestinationImage()} x="0" y="0" width="1784" height="882" clipPath={`url(#${id}-tree)`} />
    </svg>
    <svg className={styles.contours} viewBox="0 0 1784 882" preserveAspectRatio="none" focusable="false">
      <g fill="none" stroke="var(--color-art)" strokeWidth="1" opacity=".32">
        <path d="M-15 70Q85 65 165-12M-15 82Q100 74 185-12M1380-12Q1580 92 1800 70" />
        <path d="M-12 830Q84 816 182 895M-12 845Q91 830 155 895M1610 895Q1700 802 1800 760" />
      </g>
    </svg>
  </div>;
}
