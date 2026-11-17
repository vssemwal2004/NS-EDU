'use client';
import { useId, useState } from 'react';
import styles from './Reviews.module.css';

const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z';

function Star({ fill = 1, clipId }) {
  // `fill` 0..1 — a partial star is drawn by clipping the gold copy over the empty outline.
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={STAR_PATH} className={styles.starEmpty} />
    {fill > 0 && <>
      {fill < 1 && <clipPath id={clipId}><rect x="0" y="0" width={24 * fill} height="24" /></clipPath>}
      <path d={STAR_PATH} className={styles.starFull} clipPath={fill < 1 ? `url(#${clipId})` : undefined} />
    </>}
  </svg>;
}

/** Read-only stars. `value` may be fractional (e.g. 4.3 for an average). */
export function Stars({ value = 0, size = 'md', label }) {
  const id = useId().replace(/:/g, '');
  const rounded = Math.round(value * 10) / 10;
  return <span className={styles.stars} data-size={size} role="img" aria-label={label ?? `${rounded} out of 5 stars`}>
    {[0, 1, 2, 3, 4].map((index) => <Star key={index} fill={Math.max(0, Math.min(1, value - index))} clipId={`${id}-${index}`} />)}
  </span>;
}

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Star picker: a radio group, so arrow keys, Tab and screen readers work without extra code. */
export function StarInput({ value, onChange, name = 'rating', error, describedBy }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return <fieldset className={styles.starInput} aria-describedby={describedBy} data-invalid={error ? true : undefined}>
    <legend className={styles.fieldLabel}>Your rating <span aria-hidden="true">*</span></legend>
    <div className={styles.starRow} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((stars) => <label key={stars} className={styles.starOption} data-on={stars <= shown || undefined} onMouseEnter={() => setHover(stars)}>
        <input type="radio" name={name} value={stars} checked={value === stars} onChange={() => onChange(stars)} className="sr-only" />
        <Star fill={stars <= shown ? 1 : 0} />
        <span className="sr-only">{stars} star{stars > 1 ? 's' : ''} — {WORDS[stars]}</span>
      </label>)}
      <span className={styles.starWord} aria-hidden="true">{WORDS[shown] || 'Tap a star'}</span>
    </div>
  </fieldset>;
}
