import { getImageProps } from 'next/image';

// Twelve art windows and the decoration share one optimized, cached download.
export function getDestinationImage() {
  return getImageProps({
    src: '/images/study-destinations-reference.png',
    width: 900,
    height: 445,
    alt: '',
  }).props.src;
}
