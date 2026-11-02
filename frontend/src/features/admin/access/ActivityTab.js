'use client';
// Activity: the audit log as a server-paged table with person, action and date filters.
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { dateTimeOf, relativeTime } from '@/features/admin/crm/format';
import { Avatar } from '@/features/admin/crm/ui';
import Pagination from '@/features/admin/table/Pagination';
import { PageToolbar } from '@/features/admin/ui/Page';
import { AUDIT_ACTIONS, describeAudit, whoLabel } from './access-model';
import { ErrorPanel, TableSkeleton } from './AccessParts';
import access from './Access.module.css';
import styles from './Activity.module.css';

const SIZES = [25, 50, 100];

export default function ActivityTab({ request, data, params, setParams }) {
  const { staff, roles, catalogue } = data;
  const [actor, setActor] = useState(() => params.get('actor') ?? '');
  const [typed, setTyped] = useState(actor);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(SIZES[0]);
  const [state, setState] = useState({ status: 'loading', items: [], total: 0, error: null });
  const [attempt, setAttempt] = useState(0);

  // Typing an email (when the staff list is not available) waits 300 ms before asking the server.
  useEffect(() => {
    if (staff.length || typed === actor) return undefined;
    const timer = window.setTimeout(() => { setActor(typed.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [typed, actor, staff.length]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) query.set('action', action);
    if (actor) query.set('actor', actor);
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    request(`/access/audit?${query}`, { signal: controller.signal })
      .then((result) => setState({ status: 'ready', items: result.items, total: result.total, error: null }))
      .catch((error) => { if (error.name !== 'AbortError') setState((previous) => ({ ...previous, status: 'error', error })); });
    return () => controller.abort();
  }, [request, action, actor, from, to, page, limit, attempt]);

  // Any filter change: back to page 1, keep the old rows (dimmed) until the new ones arrive.
  const change = (apply) => (value) => { setState((previous) => ({ ...previous, status: 'loading' })); apply(value); setPage(1); };
  const chooseActor = change((value) => { setActor(value); setTyped(value); setParams({ actor: value || null }); });
  const retry = () => { setState((previous) => ({ ...previous, status: 'loading' })); setAttempt((value) => value + 1); };
  const clear = () => { change(() => { setAction(''); setFrom(''); setTo(''); setActor(''); setTyped(''); setParams({ actor: null }); })(); };

  const names = useMemo(() => ({
    roleName: (slug) => roles.find((role) => role.slug === slug)?.name ?? '',
    staffName: (id) => { const person = staff.find((candidate) => candidate.id === id); return person ? (person.name || whoLabel(person.email)) : ''; },
  }), [roles, staff]);
  const nameByEmail = useMemo(() => new Map(staff.map((person) => [person.email, person.name || whoLabel(person.email)])), [staff]);
  const actors = useMemo(() => [...new Set([...staff.map((person) => person.email), ...(actor ? [actor] : [])])].sort((a, b) => (nameByEmail.get(a) ?? a).localeCompare(nameByEmail.get(b) ?? b)), [staff, actor, nameByEmail]);
  const filtering = Boolean(action || actor || from || to);
  const loading = state.status === 'loading';
  const rows = state.items.map((row) => ({ row, info: describeAudit(row, { catalogue, ...names }) }));

  return <>
    <PageToolbar summary={state.status === 'ready' || state.items.length ? <><strong className="crm-tabnum">{state.total.toLocaleString('en-IN')}</strong> {state.total === 1 ? 'event' : 'events'}</> : null} start={<>
      <label className="sr-only" htmlFor="audit-actor">Person</label>
      {staff.length ? <select id="audit-actor" className={`adm-select ${access.compactSelect}`} value={actor} onChange={(event) => chooseActor(event.target.value)}>
        <option value="">Everyone</option>
        {actors.map((email) => <option key={email} value={email}>{nameByEmail.get(email) ?? whoLabel(email)}</option>)}
      </select>
        : <input id="audit-actor" type="search" className={`adm-input ${access.compactSelect}`} value={typed} placeholder="Person’s email" onChange={(event) => setTyped(event.target.value)} />}
      <label className="sr-only" htmlFor="audit-action">Action</label>
      <select id="audit-action" className={`adm-select ${access.compactSelect}`} value={action} onChange={(event) => change(setAction)(event.target.value)}>
        <option value="">All actions</option>
        {AUDIT_ACTIONS.map((group) => <optgroup key={group.label} label={group.label}>{group.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</optgroup>)}
      </select>
      <span className={styles.range}>
        <label className="sr-only" htmlFor="audit-from">From</label>
        <input id="audit-from" type="date" className="adm-input" value={from} max={to || undefined} onChange={(event) => change(setFrom)(event.target.value)} />
        <span aria-hidden="true">–</span>
        <label className="sr-only" htmlFor="audit-to">To</label>
        <input id="audit-to" type="date" className="adm-input" value={to} min={from || undefined} onChange={(event) => change(setTo)(event.target.value)} />
      </span>
      {filtering && <button type="button" className="adm-btn adm-btn--ghost" onClick={clear}>Clear</button>}
    </>} />

    {state.status === 'error' ? <ErrorPanel error={state.error} onRetry={retry} title="Could not load the activity log" />
      : loading && !state.items.length ? <TableSkeleton rows={10} columns={4} label="Loading activity" />
        : <div className={`adm-panel ${access.tablePanel}`}>
          {rows.length ? <div className={access.scroll} data-busy={loading || undefined} tabIndex={0} role="region" aria-label="Activity log" aria-busy={loading}>
            <table className={`${access.table} ${styles.table}`}>
              <thead><tr><th scope="col" className={styles.colWhen}>When</th><th scope="col" className={styles.colWho}>Who</th><th scope="col">Action</th><th scope="col" className={styles.colTarget}>Target</th><th scope="col">Details</th></tr></thead>
              <tbody>{rows.map(({ row, info }) => <tr key={row.id}>
                <td title={dateTimeOf(row.at)}><span className={access.truncate}>{relativeTime(row.at)}</span><small className={styles.sub}>{dateTimeOf(row.at)}</small></td>
                <td title={row.actor}><span className={styles.who}><Avatar name={nameByEmail.get(row.actor) ?? whoLabel(row.actor)} email={row.actor} size={20} /><span className={access.truncate}>{nameByEmail.get(row.actor) ?? whoLabel(row.actor)}</span></span></td>
                <td title={info.text}><span className={styles.action}><Icon name={info.icon} /><span className={access.truncate}>{info.text}</span></span></td>
                <td title={row.targetLabel || undefined}>{row.targetLabel ? <span className={access.truncate}>{row.targetLabel}</span> : <span className={access.muted}>—</span>}</td>
                <td title={info.detail || undefined}>{info.detail ? <span className={`${access.truncate} ${styles.detail}`}>{info.detail}</span> : <span className={access.muted}>—</span>}</td>
              </tr>)}</tbody>
            </table>
          </div>
            : <div className={access.empty}>
              <p>{filtering ? 'No activity matches these filters.' : 'No activity yet. Role, staff and lead changes appear here.'}</p>
              {filtering && <button type="button" className="adm-btn adm-btn--sm" onClick={clear}>Clear filters</button>}
            </div>}
          {state.total > 0 && <Pagination page={page} pageSize={limit} pageSizes={SIZES} total={state.total} rowCount={state.items.length} hasNext={page * limit < state.total} hasPrevious={page > 1}
            disabled={loading} noun="events" onPage={(next) => { setState((previous) => ({ ...previous, status: 'loading' })); setPage(next); }}
            onPageSize={(size) => { setState((previous) => ({ ...previous, status: 'loading' })); setLimit(size); setPage(1); }}
            onNext={() => setPage((value) => value + 1)} onPrevious={() => setPage((value) => value - 1)} />}
        </div>}
  </>;
}
