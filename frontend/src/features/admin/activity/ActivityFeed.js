'use client';
// Team activity feed (GET /crm/activity): calls, messages, notes and stage changes, grouped by day, newest first.
// Used by the Activity log page (with filters) and by the profile page (`mine`, compact, no filters).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '../AdminSession';
import { displayName, initialsOf, relativeTime } from '../crm/format';
import { ACTIVITY, OUTCOMES, STAGES } from '../crm/meta';
import styles from './Activity.module.css';
import { useStickyState } from '../ui/useStickyState';

const TYPES = [['', 'All activity'], ['call', 'Calls'], ['whatsapp', 'WhatsApp'], ['email', 'Emails'], ['meeting', 'Meetings'], ['visit', 'Campus visits'], ['note', 'Notes'], ['stage', 'Stage changes']];
const dayKey = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(value));
const dayTitle = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const toQuery = (params) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined)).toString();

function dayLabel(key) {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';
  return dayTitle.format(new Date(`${key}T12:00:00+05:30`));
}

function sentence(item) {
  if (item.type === 'stage') return <>moved the lead to <span className="crm-tone" data-tone={STAGES[item.status]?.tone ?? 'neutral'}>{item.statusLabel || STAGES[item.status]?.label || item.status}</span></>;
  const verb = { note: 'added a note', call: 'logged a call', whatsapp: 'sent a WhatsApp message', email: 'sent an email', meeting: 'logged a meeting', visit: 'logged a campus visit' }[item.kind] ?? 'added a note';
  return <>{verb}{item.outcome && <> · <em>{OUTCOMES[item.outcome]?.label ?? item.outcome}</em></>}</>;
}

function Entry({ item, mine }) {
  const stage = item.type === 'stage';
  const tone = stage ? STAGES[item.status]?.tone ?? 'neutral' : 'wine';
  const who = item.by === 'System' ? 'System' : displayName(item.by) || 'Someone';
  return <li className={styles.entry}>
    <span className={`crm-tone ${styles.node}`} data-tone={tone} aria-hidden="true"><Icon name={stage ? 'layers' : ACTIVITY[item.kind]?.icon ?? 'note'} /></span>
    <div className={styles.entryBody}>
      <p className={styles.line}>
        {!mine && <><span className={styles.avatar} aria-hidden="true">{initialsOf(who)}</span><strong>{who}</strong> </>}
        {mine ? <span className={styles.capital}>{sentence(item)}</span> : sentence(item)}
        <span className={styles.on}> on </span>
        <Link href={`/admin/leads/${item.leadId}`} className={styles.lead}>{item.leadName || 'Unnamed lead'}</Link>
        {item.leadRef && <span className={styles.ref}>{item.leadRef}</span>}
      </p>
      {item.text && <p className={styles.text}>{item.text}</p>}
    </div>
    <time className={styles.time} dateTime={new Date(item.at).toISOString()} title={relativeTime(item.at)}>{clock.format(new Date(item.at))}</time>
  </li>;
}

/** `mine`: only the signed-in person's activity, no filters (profile page). `limit` caps the first page. */
export default function ActivityFeed({ mine = false, limit = 40, compact = false }) {
  const { request } = useAdminSession();
  const [people, setPeople] = useState([]);
  // The log's filters are remembered; the profile's own feed (mine) has none.
  const [filters, setFilters] = useStickyState(mine ? '' : 'activity-log', { author: '', kind: '', from: '', to: '' });
  const [state, setState] = useState({ items: [], next: null, status: 'loading', error: '' });
  const query = useMemo(() => ({ ...(mine ? { mine: '1' } : filters), limit }), [mine, filters, limit]);

  useEffect(() => {
    if (mine) return undefined;
    const controller = new AbortController();
    request('/crm/meta', { signal: controller.signal }).then((meta) => setPeople(meta.assignees ?? [])).catch(() => {});
    return () => controller.abort();
  }, [mine, request]);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    request(`/crm/activity?${toQuery(query)}`, { signal: controller.signal })
      .then((data) => setState({ items: data.items ?? [], next: data.next ?? null, status: 'ready', error: '' }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ items: [], next: null, status: 'error', error: error.message || 'Could not load activity.' }); });
    return () => controller.abort();
  }, [query, request]);

  const more = useCallback(async () => {
    if (!state.next) return;
    setState((current) => ({ ...current, status: 'more' }));
    try {
      const data = await request(`/crm/activity?${toQuery({ ...query, before: state.next })}`);
      setState((current) => ({ items: [...current.items, ...(data.items ?? [])], next: data.next ?? null, status: 'ready', error: '' }));
    } catch (error) { setState((current) => ({ ...current, status: 'ready', error: error.message })); }
  }, [query, request, state.next]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of state.items) { const key = dayKey(item.at); if (!map.has(key)) map.set(key, []); map.get(key).push(item); }
    return [...map.entries()];
  }, [state.items]);
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const filtered = Object.values(filters).some(Boolean);

  return <div className={styles.feed} data-compact={compact || undefined}>
    {!mine && <div className={styles.filters}>
      <label className="sr-only" htmlFor="activity-person">Person</label>
      <select id="activity-person" className="adm-select" value={filters.author} onChange={set('author')}>
        <option value="">Everyone I can see</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.name || displayName(person.email)}</option>)}
      </select>
      <label className="sr-only" htmlFor="activity-type">Type</label>
      <select id="activity-type" className="adm-select" value={filters.kind} onChange={set('kind')}>
        {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className={styles.date}>From<input type="date" className="adm-input" value={filters.from} max={filters.to || undefined} onChange={set('from')} /></label>
      <label className={styles.date}>To<input type="date" className="adm-input" value={filters.to} min={filters.from || undefined} onChange={set('to')} /></label>
      {filtered && <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => setFilters({ author: '', kind: '', from: '', to: '' })}><Icon name="close" />Clear</button>}
    </div>}

    {state.status === 'error' ? <p className={styles.error} role="alert"><Icon name="alert" />{state.error}</p>
      : state.status === 'loading' ? <div className={styles.skeleton} aria-label="Loading activity">{[1, 2, 3, 4].map((key) => <span key={key} />)}</div>
        : !state.items.length ? <div className={styles.empty}><span><Icon name="history" /></span><strong>{filtered ? 'Nothing matches these filters' : mine ? 'No activity yet' : 'No activity yet'}</strong><p>{mine ? 'Calls, messages, notes and stage moves you log on leads appear here.' : 'Calls, messages, notes and stage moves by your team appear here as they happen.'}</p></div>
          : <>
            {groups.map(([key, items]) => <section key={key} className={styles.day} aria-label={dayLabel(key)}>
              <h3 className={styles.dayTitle}><span>{dayLabel(key)}</span><small>{items.length} {items.length === 1 ? 'entry' : 'entries'}</small></h3>
              <ol className={styles.list}>{items.map((item) => <Entry key={item.id} item={item} mine={mine} />)}</ol>
            </section>)}
            {state.next && <button type="button" className={`adm-btn ${styles.more}`} onClick={more} disabled={state.status === 'more'}>{state.status === 'more' ? 'Loading…' : 'Show older activity'}</button>}
          </>}
  </div>;
}
