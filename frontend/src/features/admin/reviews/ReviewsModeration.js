'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useToaster } from '@/features/admin/crm/toast';
import { PageToolbar, ViewTabs } from '@/features/admin/ui/Page';
import { Stars } from '@/features/reviews/Stars';
import styles from './ReviewsModeration.module.css';

const VIEWS = [
  { key: 'pending', label: 'Waiting', icon: 'clock' },
  { key: 'approved', label: 'Published', icon: 'checkCircle' },
  { key: 'rejected', label: 'Rejected', icon: 'ban' },
];
const REJECT_REASONS = ['Contains personal contact details', 'Spam or advertising', 'Abusive or offensive language', 'Not about Gyaan Vidhya'];
const when = (value) => (value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Moderation queue for student reviews (GET/PATCH/DELETE /api/admin/reviews). Approve publishes a
 * review; Feature pins an approved one to the start of the homepage strip. The text is never edited:
 * a review is published as written or not at all.
 */
export default function ReviewsModeration() {
  const toast = useToaster();
  const [status, setStatus] = useState('pending');
  const [rating, setRating] = useState('');
  const [data, setData] = useState({ items: [], nextCursor: null, counts: {} });
  const [state, setState] = useState({ loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const request = useRef(0);

  // Callers set the loading state themselves (a filter change, Refresh, Load more), so the first load
  // from the effect below never sets state synchronously.
  const load = useCallback(({ cursor = null } = {}) => {
    const ticket = ++request.current;
    const query = new URLSearchParams({ status, limit: '25', ...(rating && { rating }), ...(cursor && { cursor }) });
    api(`/admin/reviews?${query}`).then((result) => {
      if (ticket !== request.current) return; // a newer filter's answer wins
      setData((current) => ({ ...result, items: cursor ? [...current.items, ...result.items] : result.items }));
      setState({ loading: false, error: '' });
    }).catch((error) => {
      if (ticket === request.current) setState({ loading: false, error: error.message });
    });
  }, [status, rating]);

  useEffect(() => { load(); }, [load]);
  const reload = (options) => { setState({ loading: true, error: '' }); load(options); };

  const act = async (review, body, message) => {
    setBusy(review.id);
    try {
      const { item } = await api(`/admin/reviews/${review.id}`, { method: 'PATCH', body });
      const leaves = item.status !== status;
      setData((current) => {
        const listed = current.items.some((row) => row.id === review.id);
        const moved = item.status !== review.status;
        return {
          ...current,
          // Leaving this tab removes it; an Undo that brings it back to this tab puts it on top again.
          items: leaves ? current.items.filter((row) => row.id !== review.id)
            : listed ? current.items.map((row) => (row.id === review.id ? item : row)) : [item, ...current.items],
          counts: moved ? { ...current.counts, [review.status]: Math.max(0, (current.counts[review.status] ?? 1) - 1), [item.status]: (current.counts[item.status] ?? 0) + 1 } : current.counts,
        };
      });
      setRejecting(null);
      toast.success(message, leaves ? { action: { label: 'Undo', onClick: () => act(item, { status: review.status, featured: review.featured, rejectReason: review.rejectReason }, 'Change undone') } } : undefined);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (review) => {
    if (!window.confirm(`Delete this review by ${review.displayName} permanently? The student can write a new one.`)) return;
    setBusy(review.id);
    try {
      await api(`/admin/reviews/${review.id}`, { method: 'DELETE' });
      setData((current) => ({ ...current, items: current.items.filter((row) => row.id !== review.id), counts: { ...current.counts, [status]: Math.max(0, (current.counts[status] ?? 1) - 1) } }));
      toast.success('Review deleted');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  const counts = data.counts ?? {};
  return <div className={styles.screen}>
    <PageToolbar summary={`${(counts.approved ?? 0).toLocaleString('en-IN')} published · ${(counts.pending ?? 0).toLocaleString('en-IN')} waiting`}>
      <label className={styles.filter}><span className="sr-only">Rating</span>
        <select className="adm-select" value={rating} onChange={(event) => { setRating(event.target.value); setState({ loading: true, error: '' }); }}>
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{value > 1 ? 's' : ''}</option>)}
        </select>
      </label>
      <button type="button" className="adm-btn" onClick={() => reload()} disabled={state.loading}><Icon name="refresh" />Refresh</button>
      <a className="adm-btn" href="/reviews" target="_blank" rel="noopener noreferrer"><Icon name="external" />Public page</a>
    </PageToolbar>
    <ViewTabs label="Review status" value={status} onChange={(key) => { setStatus(key); setRejecting(null); setState({ loading: true, error: '' }); }} items={VIEWS.map((view) => ({ ...view, count: counts[view.key] ?? null }))} />

    {state.error && <p className={styles.error} role="alert">{state.error} <button type="button" className="adm-btn adm-btn--sm" onClick={() => reload()}>Try again</button></p>}
    {!state.loading && !state.error && data.items.length === 0 && <div className={`adm-panel ${styles.empty}`}>
      <Icon name={status === 'pending' ? 'checkCircle' : 'chat'} />
      <p>{status === 'pending' ? 'Nothing waiting — every review has been checked.' : `No ${VIEWS.find((view) => view.key === status).label.toLowerCase()} reviews${rating ? ` with ${rating} stars` : ''}.`}</p>
    </div>}

    <ul className={styles.list} aria-busy={state.loading || undefined}>
      {data.items.map((review) => <li key={review.id} className={`adm-panel ${styles.item}`} data-featured={review.featured || undefined}>
        <div className={styles.head}>
          <Stars value={review.rating} size="sm" label={`${review.rating} out of 5`} />
          <strong>{review.name}</strong>
          <span className={styles.shownAs}>shown as “{review.displayName}”</span>
          {review.verified && <span className={styles.badge} data-tone="good"><Icon name="checkCircle" />Verified login</span>}
          {review.featured && <span className={styles.badge} data-tone="gold"><Icon name="star" />Featured</span>}
          <time className={styles.time} dateTime={review.submittedAt}>{when(review.submittedAt)}</time>
        </div>
        <p className={styles.meta}>{[review.stage && VIEW_STAGE[review.stage], review.course, review.institution, review.city].filter(Boolean).join(' · ')}</p>
        {review.title && <p className={styles.title}>{review.title}</p>}
        <p className={styles.text}>{review.text}</p>
        {review.status === 'rejected' && review.rejectReason && <p className={styles.reason}><Icon name="alert" />Rejected: {review.rejectReason}</p>}
        {review.moderatedBy && <p className={styles.moderated}>Last checked by {review.moderatedBy} · {when(review.moderatedAt)}</p>}

        {rejecting === review.id ? <form className={styles.rejectForm} onSubmit={(event) => {
          event.preventDefault();
          act(review, { status: 'rejected', rejectReason: new FormData(event.currentTarget).get('reason') }, 'Review rejected');
        }}>
          <label className="adm-label">Reason shown to the student (optional)
            <input className="adm-input" name="reason" list={`reasons-${review.id}`} maxLength={200} autoFocus />
            <datalist id={`reasons-${review.id}`}>{REJECT_REASONS.map((reason) => <option key={reason} value={reason} />)}</datalist>
          </label>
          <div className={styles.actions}>
            <button type="button" className="adm-btn" onClick={() => setRejecting(null)}>Cancel</button>
            <button type="submit" className="adm-btn adm-btn--danger" disabled={busy === review.id}><Icon name="ban" />Reject</button>
          </div>
        </form> : <div className={styles.actions}>
          {review.status !== 'approved' && <button type="button" className="adm-btn adm-btn--primary" disabled={busy === review.id} onClick={() => act(review, { status: 'approved' }, 'Review published')}><Icon name="check" />Approve</button>}
          {review.status === 'approved' && <button type="button" className="adm-btn" aria-pressed={review.featured} disabled={busy === review.id} onClick={() => act(review, { featured: !review.featured }, review.featured ? 'Removed from featured' : 'Featured on the homepage')}><Icon name="star" />{review.featured ? 'Unfeature' : 'Feature'}</button>}
          {review.status !== 'rejected' && <button type="button" className="adm-btn" disabled={busy === review.id} onClick={() => setRejecting(review.id)}><Icon name="ban" />Reject</button>}
          {review.status !== 'pending' && <button type="button" className="adm-btn adm-btn--ghost" disabled={busy === review.id} onClick={() => act(review, { status: 'pending', featured: false }, 'Moved back to waiting')}><Icon name="undo" />Back to waiting</button>}
          <button type="button" className={`adm-btn adm-btn--ghost ${styles.delete}`} disabled={busy === review.id} onClick={() => remove(review)}><Icon name="trash" />Delete</button>
        </div>}
      </li>)}
    </ul>
    {data.nextCursor && <div className={styles.moreRow}><button type="button" className="adm-btn" disabled={state.loading} onClick={() => reload({ cursor: data.nextCursor })}>{state.loading ? 'Loading…' : 'Load more'}</button></div>}
  </div>;
}

const VIEW_STAGE = { school: 'Class 11–12 student', college: 'College student', graduate: 'Graduate', parent: 'Parent' };
