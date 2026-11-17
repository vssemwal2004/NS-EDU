'use client';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Stars } from './Stars';
import styles from './Reviews.module.css';

const TONES = 6;
const toneOf = (text) => [...String(text)].reduce((sum, char) => sum + char.codePointAt(0), 0) % TONES;
const initials = (name) => String(name).split(' ').filter(Boolean).slice(0, 2).map((part) => [...part][0]).join('').toUpperCase();
const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

/**
 * One review. `compact` = the homepage strip: fixed height, text clamped, no expand control (the card
 * moves). The full list shows the whole text with "Read more" for long reviews.
 */
export default function ReviewCard({ review, compact = false, as: Tag = 'article', hidden = false }) {
  const [open, setOpen] = useState(false);
  const long = review.text.length > 320;
  const subtitle = [review.stage, review.course].filter(Boolean).join(' · ');
  const where = [review.institution, review.city].filter(Boolean).join(', ');
  return <Tag className={styles.card} data-compact={compact || undefined} data-featured={review.featured || undefined} aria-hidden={hidden || undefined}
    tabIndex={compact ? undefined : -1}>
    <header className={styles.cardHead}>
      <span className={styles.avatar} data-tone={toneOf(review.name)} aria-hidden="true">{initials(review.name)}</span>
      <div className={styles.who}>
        <p className={styles.name}>{review.name}{review.verified && <span className={styles.verified} title="Written from a verified Gyaan Vidhya account"><Icon name="checkCircle" /><span className="sr-only">Verified account</span></span>}</p>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <span className={styles.quote} aria-hidden="true">“</span>
    </header>
    <div className={styles.ratingRow}>
      <Stars value={review.rating} size="sm" label={`Rated ${review.rating} out of 5`} />
      {review.featured && <span className={styles.featuredTag}>Featured</span>}
    </div>
    {review.title && <h3 className={styles.cardTitle}>{review.title}</h3>}
    <p className={styles.text} data-clamped={(compact || (long && !open)) || undefined}>{review.text}</p>
    {!compact && long && <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Show less' : 'Read more'}</button>}
    <footer className={styles.cardFoot}>
      {where && <span><Icon name="location" />{where}</span>}
      {review.publishedAt && <time dateTime={review.publishedAt}>{dateLabel(review.publishedAt)}</time>}
    </footer>
  </Tag>;
}
