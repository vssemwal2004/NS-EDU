'use client';
import { useId } from 'react';
import { getHeroImage } from '@/lib/hero-image';
import { useContent } from '@/providers/ContentProvider';

// The approved hero visual supplies the original campus sketch, curves and photo.
// Its UI is removed with a feathered mask; all page content remains real components.
export default function CampusArtwork({ className }) {
  const id = useId();
  const hero = useContent('media')?.hero;
  const source = getHeroImage(hero ?? null);
  if (!source) return null;
  return <>
    <link rel="preload" href={source.src} as="image" />
    <svg className={className} viewBox="0 120 1672 564" preserveAspectRatio="xMaxYMin slice" role="img" aria-label={source.alt}>
      <defs>
        <filter id={`${id}-blend`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="8" /></filter>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="120" width="1672" height="564">
          <rect x="0" y="120" width="1672" height="564" fill="white" />
          <g fill="black" filter={`url(#${id}-blend)`}>
            <rect x="70" y="143" width="810" height="416" rx="14" />
            <rect x="125" y="550" width="680" height="120" rx="12" />
            <rect x="0" y="561" width="120" height="123" />
            <rect x="800" y="140" width="145" height="190" rx="8" />
            <rect x="1530" y="139" width="142" height="138" rx="8" />
          </g>
        </mask>
      </defs>
      <image href={source.src} x="0" y="0" width={hero.width} height={hero.height} mask={`url(#${id})`} />
    </svg>
  </>;
}
