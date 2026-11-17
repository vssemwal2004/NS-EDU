'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import ReviewCard from './ReviewCard';
import styles from './Reviews.module.css';

const FILTERS = [null, 5, 4, 3, 2, 1];
const hrefFor = (rating) => (rating ? `/reviews?rating=${rating}` : '/reviews');

/**
 * The full list on /reviews: the first page comes from the server; "Show more" follows the cursor.
 * Thousands of reviews stay cheap: each click reads one indexed page of 12.
 * The page keys this component by the rating filter, so a new filter starts a fresh list.
 */
export default function ReviewList({ initial, rating = null }) {
  const [items, setItems] = useState(initial?.items ?? []);
  const [cursor, setCursor] = useState(initial?.nextCursor ?? null);
  const [state, setState] = useState({ loading: false, error: '' });
  const listRef = useRef(null);

  const more = async () => {
    setState({ loading: true, error: '' });
    try {
      const firstNew = items.length;
      const data = await api(`/reviews?limit=12&cursor=${encodeURIComponent(cursor)}${rating ? `&rating=${rating}` : ''}`);
      setItems((current) => [...current, ...data.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setCursor(data.nextCursor);
      setState({ loading: false, error: '' });
      // Keyboard users continue from the first newly loaded review.
      window.requestAnimationFrame(() => listRef.current?.children[firstNew]?.querySelector('article')?.focus());
    } catch (error) {
      setState({ loading: false, error: error.message });
    }
  };

  return <div className={styles.listBlock}>
    <nav className={styles.filters} aria-label="Filter reviews by rating">
      {FILTERS.map((value) => <Link key={value ?? 'all'} href={hrefFor(value)} scroll={false} className={styles.filter} aria-current={value === rating ? 'page' : undefined}>
        {value ? <>{value}<Icon name="star" /></> : 'All reviews'}
      </Link>)}
    </nav>
    {initial === null ? <p className={styles.listNote} role="status">Reviews could not be loaded right now. Please refresh in a moment.</p>
      : items.length === 0 ? <p className={styles.listNote}>{rating ? `No ${rating}-star reviews yet.` : 'No reviews yet — be the first to write one.'}</p>
        : <ul className={styles.list} ref={listRef}>{items.map((review) => <li key={review.id}><ReviewCard review={review} /></li>)}</ul>}
    {state.error && <p className={styles.formError} role="alert">{state.error}</p>}
    {cursor && <div className={styles.moreRow}>
      <button type="button" className="lux-button lux-button--outline" onClick={more} disabled={state.loading}>{state.loading ? 'Loading…' : 'Show more reviews'}</button>
    </div>}
  </div>;
}
