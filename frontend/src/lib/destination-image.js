import { mediaImage } from './hero-image';

// Twelve art windows and the decoration share one optimized, cached download of `media.destinationsArt`.
export function getDestinationImage(art) {
  return mediaImage(art, 900)?.src || null;
}
