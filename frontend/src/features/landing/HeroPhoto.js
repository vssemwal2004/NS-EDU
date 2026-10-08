import { getHeroImage } from '@/lib/hero-image';

// Compact mobile/tablet crop keeps the students in frame without a freehand cutout.
export default function HeroPhoto({ className }) {
  const props = getHeroImage();
  return <>
    <link rel="preload" href={props.src} as="image" />
    <svg className={className} viewBox="945 160 600 524" preserveAspectRatio="xMidYMin slice" role="img" aria-label={props.alt}>
      <image href={props.src} x="0" y="0" width="1672" height="941" />
    </svg>
  </>;
}
