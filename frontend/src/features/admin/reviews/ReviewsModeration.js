'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { useAdminSession } from '@/features/admin/AdminSession';
import BulkBar from '@/features/admin/crm/BulkBar';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import { canAny } from '@/features/admin/crm/meta';
import RowMenu from '@/features/admin/crm/RowMenu';
import { useToaster } from '@/features/admin/crm/toast';
import { PageToolbar, ViewTabs } from '@/features/admin/ui/Page';
import { Stars } from '@/features/reviews/Stars';
import styles from './ReviewsModeration.module.css';
import { useStickyState } from '../ui/useStickyState';

const VIEWS = [
  { key: 'pending', label: 'Waiting', icon: 'clock' },
  { key: 'approved', label: 'Published', icon: 'checkCircle' },
  { key: 'rejected', label: 'Rejected', icon: 'ban' },
];
const REJECT_REASONS = ['Contains personal contact details', 'Spam or advertising', 'Abusive or offensive language', 'Not about Gyaan Vidhya'];
const BULK_WORDS = { approve: 'published', reject: 'rejected', pending: 'moved back to waiting', delete: 'deleted' };
const when = (value) => (value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const reviews = (count) => `${count.toLocaleString('en-IN')} review${count === 1 ? '' : 's'}`;

/**
 * Moderation queue for student reviews (GET/PATCH/DELETE /api/admin/reviews, POST /bulk). Approve publishes a
 * review; Feature pins an approved one to the start of the homepage strip. The text is never edited:
 * a review is published as written or not at all.
 * Permissions: reviews.moderate approves / rejects / features, reviews.delete deletes; content.edit allows both.
 */
export default function ReviewsModeration() {
  const { admin } = useAdminSession();
  const toast = useToaster();
  const canModerate = canAny(admin, ['reviews.moderate', 'content.edit']);
  const canDelete = canAny(admin, ['reviews.delete', 'content.edit']);
  // The bulk endpoint sits behind reviews.moderate, so a bulk delete needs both.
  const canBulkDelete = canDelete; // the bulk endpoint checks reviews.delete for deletes, reviews.moderate for the rest
  const [status, setStatus] = useStickyState('reviews:status', 'pending');
  const [rating, setRating] = useStickyState('reviews:rating', '');
  const [data, setData] = useState({ items: [], nextCursor: null, counts: {} });
  const [state, setState] = useState({ loading: true, error: '' });
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [deleting, setDeleting] = useState(null); // { review } | { bulk: true }
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });
  const [bulk, setBulk] = useState(null); // { action, reason?, busy?, error? } while a bulk dialog is open
  const [selected, setSelected] = useState([]);
  const request = useRef(0);

  // A selection belongs to one tab and rating filter; it never silently carries over.
  const selectionKey = `${status}|${rating}`;
  const [selectionFor, setSelectionFor] = useState(selectionKey);
  if (selectionFor !== selectionKey) { setSelectionFor(selectionKey); if (selected.length) setSelected([]); }

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
      if (leaves) setSelected((current) => current.filter((id) => id !== review.id));
      setRejecting(null);
      toast.success(message, leaves ? { action: { label: 'Undo', onClick: () => act(item, { status: review.status, featured: review.featured, rejectReason: review.rejectReason }, 'Change undone') } } : undefined);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(null);
    }
  };

  async function removeOne(review) {
    setDeleteState({ busy: true, error: '' });
    try {
      await api(`/admin/reviews/${review.id}`, { method: 'DELETE' });
      setData((current) => ({ ...current, items: current.items.filter((row) => row.id !== review.id), counts: { ...current.counts, [status]: Math.max(0, (current.counts[status] ?? 1) - 1) } }));
      setSelected((current) => current.filter((id) => id !== review.id));
      setDeleting(null); setDeleteState({ busy: false, error: '' });
      toast.success('Review deleted');
    } catch (error) { setDeleteState({ busy: false, error: error.message }); }
  }

  /** POST /admin/reviews/bulk; returns false when nothing was done (the dialog shows the error). */
  async function runBulk(action, rejectReason) {
    const ids = [...selected];
    const result = await api('/admin/reviews/bulk', { method: 'POST', body: { ids, action, ...(action === 'reject' && rejectReason && { rejectReason }) } });
    const failed = result.failed ?? [];
    if (!result.done && failed.length) throw new Error(failed[0].error);
    const message = `${reviews(result.done)} ${BULK_WORDS[action]}.`;
    if (failed.length) toast.warn(`${message} ${reviews(failed.length)} could not be changed: ${failed[0].error}`); else toast.success(message);
    setSelected([]);
    reload();
  }
  async function confirmBulk() {
    setBulk((current) => ({ ...current, busy: true, error: '' }));
    try { await runBulk(bulk.action, bulk.reason?.trim()); setBulk(null); } catch (error) { setBulk((current) => ({ ...current, busy: false, error: error.message })); }
  }
  async function confirmBulkDelete() {
    setDeleteState({ busy: true, error: '' });
    try { await runBulk('delete'); setDeleting(null); setDeleteState({ busy: false, error: '' }); } catch (error) { setDeleteState({ busy: false, error: error.message }); }
  }
  const askDelete = (target) => { setDeleteState({ busy: false, error: '' }); setDeleting(target); };
  const askBulk = (action) => setBulk({ action, reason: '', busy: false, error: '' });

  const menuFor = (review) => [
    { key: 'approve', label: 'Approve and publish', icon: 'check', hidden: !canModerate || review.status === 'approved', onSelect: () => act(review, { status: 'approved' }, 'Review published') },
    { key: 'feature', label: review.featured ? 'Unfeature' : 'Feature on the homepage', icon: 'star', hidden: !canModerate || review.status !== 'approved', onSelect: () => act(review, { featured: !review.featured }, review.featured ? 'Removed from featured' : 'Featured on the homepage') },
    { key: 'reject', label: 'Reject…', icon: 'ban', hidden: !canModerate || review.status === 'rejected', onSelect: () => setRejecting(review.id) },
    { key: 'pending', label: 'Back to waiting', icon: 'undo', hidden: !canModerate || review.status === 'pending', onSelect: () => act(review, { status: 'pending', featured: false }, 'Moved back to waiting') },
    { divider: true },
    { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !canDelete, onSelect: () => askDelete({ review }) },
  ];
  const bulkMenu = [
    { key: 'approve', label: 'Approve and publish', icon: 'check', hidden: !canModerate || status === 'approved', onSelect: () => askBulk('approve') },
    { key: 'reject', label: 'Reject…', icon: 'ban', hidden: !canModerate || status === 'rejected', onSelect: () => askBulk('reject') },
    { key: 'pending', label: 'Back to waiting', icon: 'undo', hidden: !canModerate || status === 'pending', onSelect: () => askBulk('pending') },
    { divider: true },
    { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !canBulkDelete, onSelect: () => askDelete({ bulk: true }) },
  ];
  const selectable = canModerate || canDelete;

  const counts = data.counts ?? {};
  const pageIds = data.items.map((review) => review.id);
  const chosen = new Set(selected);
  const allChosen = pageIds.length > 0 && pageIds.every((id) => chosen.has(id));
  const toggle = (id, on) => setSelected((current) => (on ? [...current.filter((entry) => entry !== id), id] : current.filter((entry) => entry !== id)));
  const bulkTitle = bulk && { approve: `Publish ${reviews(selected.length)}?`, reject: `Reject ${reviews(selected.length)}?`, pending: `Move ${reviews(selected.length)} back to waiting?` }[bulk.action];

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

    {selectable && selected.length > 0 && <div className={styles.bulkDock}>
      <BulkBar count={selected.length} noun={['review', 'reviews']} onClear={() => setSelected([])} busy={Boolean(bulk?.busy || deleteState.busy)}
        quick={[{ key: 'approve', label: 'Approve', icon: 'check', hidden: status === 'approved', onSelect: () => askBulk('approve') }]} menu={bulkMenu} />
    </div>}
    {selectable && data.items.length > 0 && <label className={styles.selectAll}>
      <input type="checkbox" checked={allChosen} ref={(node) => { if (node) node.indeterminate = selected.length > 0 && !allChosen; }}
        onChange={(event) => setSelected(event.target.checked ? pageIds : [])} />
      Select all {pageIds.length.toLocaleString('en-IN')} loaded
    </label>}

    <ul className={styles.list} aria-busy={state.loading || undefined}>
      {data.items.map((review) => <li key={review.id} className={`adm-panel ${styles.item}`} data-featured={review.featured || undefined} data-selected={chosen.has(review.id) || undefined}>
        <div className={styles.head}>
          {selectable && <input type="checkbox" className={styles.pick} checked={chosen.has(review.id)} aria-label={`Select the review by ${review.name}`} onChange={(event) => toggle(review.id, event.target.checked)} />}
          <Stars value={review.rating} size="sm" label={`${review.rating} out of 5`} />
          <strong>{review.name}</strong>
          <span className={styles.shownAs}>shown as “{review.displayName}”</span>
          {review.verified && <span className={styles.badge} data-tone="good"><Icon name="checkCircle" />Verified login</span>}
          {review.featured && <span className={styles.badge} data-tone="gold"><Icon name="star" />Featured</span>}
          <time className={styles.time} dateTime={review.submittedAt}>{when(review.submittedAt)}</time>
          <RowMenu label={`Actions for the review by ${review.name}`} items={menuFor(review)} />
        </div>
        <div className={styles.body}>
          <p className={styles.meta}>{[review.stage && VIEW_STAGE[review.stage], review.course, review.institution, review.city].filter(Boolean).join(' · ')}</p>
          {review.title && <p className={styles.title}>{review.title}</p>}
          <p className={styles.text}>{review.text}</p>
          {review.status === 'rejected' && review.rejectReason && <p className={styles.reason}><Icon name="alert" />Rejected: {review.rejectReason}</p>}
          {review.moderatedBy && <p className={styles.moderated}>Last checked by {review.moderatedBy} · {when(review.moderatedAt)}</p>}
        </div>

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
        </form> : canModerate && <div className={styles.actions}>
          {review.status !== 'approved' && <button type="button" className="adm-btn adm-btn--primary" disabled={busy === review.id} onClick={() => act(review, { status: 'approved' }, 'Review published')}><Icon name="check" />Approve</button>}
          {review.status === 'approved' && <button type="button" className="adm-btn" aria-pressed={review.featured} disabled={busy === review.id} onClick={() => act(review, { featured: !review.featured }, review.featured ? 'Removed from featured' : 'Featured on the homepage')}><Icon name="star" />{review.featured ? 'Unfeature' : 'Feature'}</button>}
          {review.status !== 'rejected' && <button type="button" className="adm-btn" disabled={busy === review.id} onClick={() => setRejecting(review.id)}><Icon name="ban" />Reject</button>}
        </div>}
      </li>)}
    </ul>
    {data.nextCursor && <div className={styles.moreRow}><button type="button" className="adm-btn" disabled={state.loading} onClick={() => reload({ cursor: data.nextCursor })}>{state.loading ? 'Loading…' : 'Load more'}</button></div>}

    <ConfirmDialog open={Boolean(deleting)} tone="danger" icon="trash" busy={deleteState.busy} error={deleteState.error}
      title={deleting?.bulk ? `Delete ${reviews(selected.length)}?` : 'Delete this review?'} confirmLabel={deleting?.bulk ? 'Delete reviews' : 'Delete review'}
      requireText={deleting?.bulk && selected.length >= 5 ? 'DELETE' : undefined}
      onCancel={() => setDeleting(null)} onConfirm={() => (deleting?.bulk ? confirmBulkDelete() : removeOne(deleting.review))}>
      {deleting?.bulk ? <p>The selected reviews are removed permanently. Their authors can write new ones.</p>
        : deleting && <p>The review by <strong>{deleting.review.displayName}</strong> is removed permanently. The student can write a new one.</p>}
    </ConfirmDialog>

    <ConfirmDialog open={Boolean(bulk)} tone={bulk?.action === 'reject' ? 'danger' : 'primary'} icon={bulk?.action === 'reject' ? 'ban' : bulk?.action === 'pending' ? 'undo' : 'check'}
      title={bulkTitle} confirmLabel={bulk?.action === 'reject' ? 'Reject reviews' : bulk?.action === 'pending' ? 'Move back' : 'Publish reviews'}
      busy={bulk?.busy} error={bulk?.error} onCancel={() => setBulk(null)} onConfirm={confirmBulk}>
      {bulk?.action === 'approve' && <p>The selected reviews appear on the public reviews page as written.</p>}
      {bulk?.action === 'pending' && <p>The selected reviews leave the public page (and the featured strip) and wait to be checked again.</p>}
      {bulk?.action === 'reject' && <>
        <p>The selected reviews are hidden from the public page. The same reason is shown to every student.</p>
        <label className={`adm-label ${styles.bulkReason}`}>Reason shown to the students (optional)
          <input className="adm-input" list="reasons-bulk" maxLength={200} value={bulk.reason} onChange={(event) => setBulk((current) => ({ ...current, reason: event.target.value }))} />
          <datalist id="reasons-bulk">{REJECT_REASONS.map((reason) => <option key={reason} value={reason} />)}</datalist>
        </label>
      </>}
    </ConfirmDialog>
  </div>;
}

const VIEW_STAGE = { school: 'Class 11–12 student', college: 'College student', graduate: 'Graduate', parent: 'Parent' };
