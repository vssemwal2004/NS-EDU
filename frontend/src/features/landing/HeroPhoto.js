'use client';
import { getHeroImage } from '@/lib/hero-image';
import { useContent } from '@/providers/ContentProvider';

// Compact mobile/tablet crop keeps the students in frame without a freehand cutout.
export default function HeroPhoto({ className }) {
  const hero = useContent('media')?.hero;
  const props = getHeroImage(hero ?? null);
  if (!props) return null;
  return <>
    <link rel="preload" href={props.src} as="image" />
    <svg className={className} viewBox="945 160 600 524" preserveAspectRatio="xMidYMin slice" role="img" aria-label={props.alt}>
      <image href={props.src} x="0" y="0" width={hero.width} height={hero.height} />
    </svg>
  </>;
}
