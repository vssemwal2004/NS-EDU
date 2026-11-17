'use client';
import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import RatingSummary from './RatingSummary';
import ReviewCard from './ReviewCard';
import WriteReview from './WriteReview';
import styles from './Reviews.module.css';

// Below this many reviews the strip does not move: a looping row of two cards looks broken.
const MIN_FOR_MOTION = 4;
// Each moving copy needs at least this many cards so the loop never shows a gap on wide screens.
const MIN_PER_COPY = 8;
const SECONDS_PER_CARD = 7;

function fill(list) {
  if (!list.length) return list;
  const out = [...list];
  while (out.length < MIN_PER_COPY) out.push(...list);
  return out;
}

/**
 * One endlessly scrolling row. The list is rendered twice and the track slides by exactly one copy,
 * so the loop is seamless. The second copy is hidden from assistive technology (it repeats the first).
 * Hover, keyboard focus and the pause button stop it; reduced-motion users get a swipeable row instead.
 */
function Marquee({ items, reverse = false, paused }) {
  const cards = fill(items);
  return <div className={styles.marquee} data-paused={paused || undefined}>
    <div className={styles.track} data-reverse={reverse || undefined} style={{ '--marquee-duration': `${cards.length * SECONDS_PER_CARD}s` }}>
      <ul className={styles.copy}>{cards.map((review, index) => <li key={`${review.id}-${index}`}><ReviewCard review={review} compact hidden={index >= items.length} /></li>)}</ul>
      <ul className={styles.copy} aria-hidden="true">{cards.map((review, index) => <li key={`${review.id}-dup-${index}`}><ReviewCard review={review} compact hidden /></li>)}</ul>
    </div>
  </div>;
}

/** Homepage section: rating summary, two rows of reviews moving in opposite directions, and the CTAs. */
export default function StudentReviews({ summary, items = [] }) {
  const [paused, setPaused] = useState(false);
  const moving = items.length >= MIN_FOR_MOTION;
  // Two rows once there is enough to keep them different; otherwise one.
  const split = items.length >= MIN_PER_COPY * 2 ? Math.ceil(items.length / 2) : items.length;
  const rows = moving ? [items.slice(0, split), items.length > split ? items.slice(split) : null].filter(Boolean) : [];

  return <section className={styles.band} aria-labelledby="student-reviews-title">
    <div className={`container ${styles.bandInner}`}>
      <div className={styles.bandHead}>
        <div className={styles.bandCopy}>
          <p className={styles.eyebrow}><Icon name="chat" />Student reviews</p>
          <h2 id="student-reviews-title">Students on their Gyaan Vidhya experience</h2>
          <p className={styles.lead}>Real reviews from signed-in students and parents. Every review is checked by our team before it appears — we never edit what people say.</p>
          {items.length > 0 && <div className={styles.ctaRow}>
            <WriteReview />
            <Link className="lux-button lux-button--outline" href="/reviews">Read all reviews<Icon name="arrow" /></Link>
          </div>}
        </div>
        <RatingSummary summary={summary} />
      </div>
    </div>

    {moving ? <div className={styles.rows} role="region" aria-label="Recent student reviews, scrolling">
      {rows.map((row, index) => <Marquee key={index} items={row} reverse={index === 1} paused={paused} />)}
      <div className={`container ${styles.marqueeControls}`}>
        <button type="button" className={styles.pause} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          <Icon name={paused ? 'play' : 'pause'} />{paused ? 'Play' : 'Pause'} scrolling
        </button>
      </div>
    </div> : <div className="container">
      {items.length > 0 ? <ul className={styles.staticRow}>{items.map((review) => <li key={review.id}><ReviewCard review={review} compact /></li>)}</ul>
        : <div className={styles.empty}>
          <span className={styles.emptyIcon}><Icon name="chat" /></span>
          <div><h3>Be the first to share your experience</h3><p>Used Gyaan Vidhya to explore courses, compare colleges or apply? Your review helps the next student choose with confidence.</p></div>
          <WriteReview label="Write the first review" className="lux-button lux-button--primary" />
        </div>}
    </div>}
  </section>;
}
