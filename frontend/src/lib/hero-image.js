import { getImageProps } from 'next/image';

// Shared optimized source: the photo and campus decoration reuse one download.
export function getHeroImage() {
  return getImageProps({
    src: '/images/approved-reference.png',
    width: 840,
    height: 473,
    alt: 'Three students exploring their next chapter together in a university library',
  }).props;
}
