'use client';
import { useState } from 'react';
import { monogram } from './labels';
import styles from './Directory.module.css';

// Crests and campus photographs are served from the institutions' own sites until the crawler has
// re-hosted them, so a file can be missing, moved or refused at any moment. A broken-image box is
// the one thing that makes a directory look abandoned, so every remote image falls back in place:
// the crest becomes the monogram, the photograph becomes the panel's own gradient.
// An http:// source cannot load at all under the site's image policy, so it is treated as missing.
export const secureImage = (url) => (/^https:\/\//i.test(String(url ?? '')) ? url : '');

// The markup is server-rendered, so an image can fail before React is listening and `onError` would
// never fire. The ref re-checks on mount: a finished image with no pixels is a failed one.
const useBrokenImage = () => {
  const [failed, setFailed] = useState(false);
  const mark = (node) => { if (node?.complete && node.naturalWidth === 0) setFailed(true); };
  return [failed, { ref: mark, onError: () => setFailed(true) }];
};

export function UniversityLogo({ item, size = 'md', className = '' }) {
  const [failed, guard] = useBrokenImage();
  const px = size === 'lg' ? 112 : size === 'sm' ? 44 : 60;
  const logo = failed ? '' : secureImage(item.logoUrl);
  return <span className={`${styles.logo} ${className}`} data-size={size} data-fallback={logo ? undefined : true} aria-hidden="true">
    {logo ? <img {...guard} src={logo} alt="" width={px} height={px} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      : monogram(item.name)}
  </span>;
}

/** A campus photograph inside an already-styled panel; `children` is what shows without one. */
export function CampusPhoto({ src, children = null }) {
  const [failed, guard] = useBrokenImage();
  const photo = failed ? '' : secureImage(src);
  if (!photo) return children;
  return <img {...guard} src={photo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
}
