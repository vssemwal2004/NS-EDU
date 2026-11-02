'use client';
/**
 * Pipeline board: one compact Kanban column per stage (count and share in the header), best leads first, with drag and drop (and the "⋮" menu as the
 * keyboard / touch alternative, with Undo), toolbar filters and a phone layout that shows one stage at a time.
 * Data: GET /crm/board (first 20 per stage) and GET /crm/board/:status?page= (Load more). Moves: PATCH /leads/:id/status.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import ConfirmDialog from '@/features/admin/crm/ConfirmDialog';
import { useToaster } from '@/features/admin/crm/toast';
import { CHANNELS, HEATS, HEAT_ORDER, STAGES, STAGE_ORDER, can } from '@/features/admin/crm/meta';
import { formatNumber } from '@/features/admin/crm/format';
import FollowUpDialog from '@/features/admin/lead-actions/FollowUpDialog';
import LogCallDialog from '@/features/admin/lead-actions/LogCallDialog';
import { copyText } from '@/features/admin/lead-actions/contact';
import { toQuery } from '@/features/admin/table/useServerList';
import { PageToolbar, ViewTabs } from '@/features/admin/ui/Page';
import BoardCard from './BoardCard';
import styles from './Pipeline.module.css';

const CLOSED = new Set(['not-interested', 'closed']);
const NO_FILTERS = { q: '', heats: [], assignee: '', channel: '' };
const cx = (...parts) => parts.filter(Boolean).join(' ');

// ---- pure helpers over { [status]: { items, total, … } } ----
const touch = (columns, status, patch) => ({ ...columns, [status]: { ...columns[status], ...patch(columns[status]) } });
const removeFrom = (columns, status, id) => (columns[status] && columns[status].items.some((item) => item.id === id)
  ? touch(columns, status, (col) => ({ items: col.items.filter((item) => item.id !== id), total: Math.max(0, col.total - 1) })) : columns);
const insertInto = (columns, status, lead, index = 0) => (columns[status]
  ? touch(columns, status, (col) => ({ items: [...col.items.slice(0, index), lead, ...col.items.slice(index)], total: col.total + 1 })) : columns);
const CARD_KEYS = ['status', 'crm', 'assignedEmployeeIds', 'applicant', 'preference', 'updatedAt'];
const pickCard = (item) => Object.fromEntries(CARD_KEYS.filter((key) => item?.[key] !== undefined).map((key) => [key, item[key]]));
function syncLead(columns, updated) {
  const from = STAGE_ORDER.find((status) => columns[status]?.items.some((item) => item.id === updated.id));
  if (!from) return columns;
  const existing = columns[from].items.find((item) => item.id === updated.id);
  const merged = { ...existing, ...pickCard(updated) };
  if (merged.status && merged.status !== from && columns[merged.status]) return insertInto(removeFrom(columns, from, merged.id), merged.status, merged);
  return touch(columns, from, (col) => ({ items: col.items.map((item) => (item.id === merged.id ? merged : item)) }));
}
const normalise = (data) => Object.fromEntries(data.columns.map((col) => [col.status, { ...col, page: 1, more: false, hasNext: col.total > col.items.length }]));

export default function PipelineBoard() {
  const { admin, request } = useAdminSession();
  const toast = useToaster();
  const perms = useMemo(() => ({
    move: can(admin, 'leads.change_status'), notes: can(admin, 'leads.notes'), heat: can(admin, 'crm.heat'), remove: can(admin, 'leads.delete'), create: can(admin, 'leads.create'),
  }), [admin]);
  const wide = admin?.isOwner || admin?.leadScope === 'team' || admin?.leadScope === 'all';

  const [filters, setFilters] = useState(NO_FILTERS);
  const [qInput, setQInput] = useState('');
  const [meta, setMeta] = useState({ assignees: [] });
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState({ key: null, columns: null, error: '' });
  const [showClosed, setShowClosed] = useState(false);
  const [activeStage, setActiveStage] = useState('new');
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState('');
  const [movedId, setMovedId] = useState('');
  const [pending, setPending] = useState(null);       // { lead, to } waiting for confirmation (closing stages)
  const [removing, setRemoving] = useState(null);     // { lead, busy, error }
  const [logLead, setLogLead] = useState(null);
  const [followLead, setFollowLead] = useState(null);
  const dragRef = useRef(null);
  const boardRef = useRef(null);
  const columnRefs = useRef({});
  const loadedRef = useRef(loaded);
  useEffect(() => { loadedRef.current = loaded; });

  const params = useMemo(() => ({ q: filters.q, heat: filters.heats.join(','), assignee: filters.assignee, channel: filters.channel }), [filters]);
  const query = toQuery(params);
  const key = `${query}|${version}`;

  // Filters apply 300 ms after the last keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((current) => (current.q === qInput.trim() ? current : { ...current, q: qInput.trim() })), 300);
    return () => window.clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    const controller = new AbortController();
    request('/crm/meta', { signal: controller.signal }).then((data) => setMeta({ assignees: data.assignees ?? [] })).catch(() => {});
    return () => controller.abort();
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    request(`/crm/board${query ? `?${query}` : ''}`, { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted && data) setLoaded({ key, columns: normalise(data), error: '' }); })
      .catch((failure) => { if (controller.signal.aborted || failure.name === 'AbortError') return; setLoaded({ key, columns: null, error: failure.message || 'Could not load the board.' }); });
    return () => controller.abort();
  }, [key, query, request]);

  const mutate = useCallback((fn) => setLoaded((current) => (current.columns ? { ...current, columns: fn(current.columns) } : current)), []);
  const people = useMemo(() => {
    const map = new Map(meta.assignees.map((person) => [person.id, person]));
    if (admin && !map.has(admin.id)) map.set(admin.id, { id: admin.id, name: admin.name, email: admin.email });
    return map;
  }, [meta.assignees, admin]);

  const columns = loaded.columns;
  const busy = loaded.key !== key;
  const stages = useMemo(() => STAGE_ORDER.filter((status) => columns?.[status]), [columns]);
  const shown = stages.filter((status) => showClosed || !CLOSED.has(status));
  const current = shown.includes(activeStage) ? activeStage : shown[0];
  const totals = useMemo(() => Object.fromEntries(stages.map((status) => [status, columns[status].total])), [stages, columns]);
  const grand = stages.reduce((sum, status) => sum + totals[status], 0);
  const closedTotal = stages.filter((status) => CLOSED.has(status)).reduce((sum, status) => sum + totals[status], 0);
  const filtered = Boolean(filters.q || filters.heats.length || filters.assignee || filters.channel);

  // ---- moving a lead ----
  const moveRef = useRef(null);
  const moveLead = useCallback(async (lead, to, { undo = false } = {}) => {
    const from = lead.status;
    if (!to || from === to) return;
    const name = lead.applicant?.fullName || 'Lead';
    const index = Math.max(0, loadedRef.current.columns?.[from]?.items.findIndex((item) => item.id === lead.id) ?? 0);
    mutate((cols) => insertInto(removeFrom(cols, from, lead.id), to, { ...lead, status: to }));
    setMovedId(lead.id);
    window.setTimeout(() => setMovedId((id) => (id === lead.id ? '' : id)), 1300);
    try {
      const result = await request(`/leads/${lead.id}/status`, { method: 'PATCH', body: { status: to } });
      if (result?.item) mutate((cols) => syncLead(cols, { ...result.item, status: to }));
      toast.success(`${name} moved to ${STAGES[to].label}`, undo ? undefined : { action: { label: 'Undo', onClick: () => moveRef.current({ ...lead, status: to }, from, { undo: true }) } });
    } catch (failure) {
      mutate((cols) => insertInto(removeFrom(cols, to, lead.id), from, lead, index));
      toast.error(`${name} could not be moved: ${failure.message}`);
    }
  }, [mutate, request, toast]);

  useEffect(() => { moveRef.current = moveLead; });

  const requestMove = useCallback((lead, to) => {
    if (!perms.move || to === lead.status) return;
    if (CLOSED.has(to)) setPending({ lead, to }); else moveLead(lead, to);
  }, [moveLead, perms.move]);

  const setHeat = useCallback(async (lead, heat) => {
    try {
      const result = await request(`/crm/leads/${lead.id}`, { method: 'PATCH', body: { heat } });
      if (result?.item) mutate((cols) => syncLead(cols, result.item));
      toast.success(heat === 'auto' ? 'Temperature handed back to the score' : `Marked ${HEATS[heat].label.toLowerCase()}`);
    } catch (failure) { toast.error(failure.message); }
  }, [mutate, request, toast]);
  async function deleteLead() {
    const { lead } = removing;
    setRemoving({ lead, busy: true, error: '' });
    try {
      await request(`/crm/leads/${lead.id}`, { method: 'DELETE' });
      mutate((cols) => removeFrom(cols, lead.status, lead.id));
      setRemoving(null);
      toast.success(`${lead.applicant?.fullName || 'Lead'} moved to the Lead bin`);
    } catch (failure) { setRemoving({ lead, busy: false, error: failure.message }); }
  }
  async function loadMore(status) {
    const col = loadedRef.current.columns?.[status];
    if (!col || col.more) return;
    const startKey = loadedRef.current.key;
    mutate((cols) => touch(cols, status, () => ({ more: true })));
    try {
      const data = await request(`/crm/board/${status}?${toQuery({ ...params, page: col.page + 1 })}`);
      setLoaded((cur) => {
        if (cur.key !== startKey || !cur.columns) return cur;
        const seen = new Set(cur.columns[status].items.map((item) => item.id));
        const items = [...cur.columns[status].items, ...data.items.filter((item) => !seen.has(item.id))];
        return { ...cur, columns: touch(cur.columns, status, () => ({ items, page: data.page ?? col.page + 1, hasNext: Boolean(data.hasNext), more: false })) };
      });
    } catch (failure) {
      mutate((cols) => touch(cols, status, () => ({ more: false })));
      toast.error(`Could not load more leads: ${failure.message}`);
    }
  }

  const act = useMemo(() => ({
    move: requestMove, heat: setHeat, log: setLogLead, follow: setFollowLead, remove: (lead) => setRemoving({ lead, busy: false, error: '' }),
    copy: async (phone) => { if (await copyText(phone)) toast.success(`Copied ${phone}`); else toast.error('Could not copy the number'); },
  }), [requestMove, setHeat, toast]);

  // ---- drag and drop ----
  const onDragStart = useCallback((event, lead) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', lead.id);
    dragRef.current = { id: lead.id, from: lead.status };
    window.requestAnimationFrame(() => setDrag(dragRef.current));
  }, []);
  const onDragEnd = useCallback(() => { dragRef.current = null; setDrag(null); setOver(''); }, []);
  function onColumnOver(event, status) {
    if (!dragRef.current) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (over !== status) setOver(status);
    const board = boardRef.current;
    if (board) { const rect = board.getBoundingClientRect(); if (event.clientX < rect.left + 70) board.scrollLeft -= 22; else if (event.clientX > rect.right - 70) board.scrollLeft += 22; }
  }
  function onColumnDrop(event, status) {
    const dragged = dragRef.current;
    if (!dragged) return;
    event.preventDefault();
    const lead = loadedRef.current.columns?.[dragged.from]?.items.find((item) => item.id === dragged.id);
    onDragEnd();
    if (lead) requestMove(lead, status);
  }

  function focusStage(status) {
    if (CLOSED.has(status)) setShowClosed(true);
    setActiveStage(status);
    window.setTimeout(() => columnRefs.current[status]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }), 60);
  }
  const clearAll = () => { setQInput(''); setFilters(NO_FILTERS); };
  const openTotal = grand - closedTotal;
  const heatValue = filters.heats.length === 1 ? filters.heats[0] : '';

  return <div className={styles.page}>
    <PageToolbar start={<>
      <label className={styles.search}><span className="sr-only">Search leads by name, phone or reference</span>
        <Icon name="search" /><input type="search" value={qInput} onChange={(event) => setQInput(event.target.value)} placeholder="Search name, phone, ref" />
      </label>
      <label className={styles.filter}><span className="sr-only">Temperature</span>
        <select className="adm-select" value={heatValue} onChange={(event) => setFilters((cur) => ({ ...cur, heats: event.target.value ? [event.target.value] : [] }))}>
          <option value="">Any temperature</option>
          {HEAT_ORDER.map((heat) => <option key={heat} value={heat}>{HEATS[heat].label}</option>)}
        </select>
      </label>
      {(wide || meta.assignees.length > 0) && <label className={styles.filter}><span className="sr-only">Assigned to</span>
        <select className="adm-select" value={filters.assignee} onChange={(event) => setFilters((cur) => ({ ...cur, assignee: event.target.value }))}>
          <option value="">Anyone</option><option value="me">Assigned to me</option>{wide && <option value="unassigned">Unassigned</option>}
          {meta.assignees.filter((person) => person.id !== admin?.id).map((person) => <option key={person.id} value={person.id}>{person.name || person.email}</option>)}
        </select>
      </label>}
      <label className={styles.filter}><span className="sr-only">Source</span>
        <select className="adm-select" value={filters.channel} onChange={(event) => setFilters((cur) => ({ ...cur, channel: event.target.value }))}>
          <option value="">All sources</option>
          {Object.entries(CHANNELS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
        </select>
      </label>
      {filtered && <button type="button" className="adm-btn adm-btn--ghost" onClick={clearAll}><Icon name="close" />Clear</button>}
      <p className={styles.summary} aria-live="polite">{columns ? <><strong className="crm-tabnum">{formatNumber(openTotal)}</strong> open{filtered ? ' (filtered)' : ''} · <span className="crm-tabnum">{formatNumber(closedTotal)}</span> closed</> : 'Loading…'}</p>
    </>}>
      <button type="button" className="adm-btn" aria-pressed={showClosed} onClick={() => setShowClosed((value) => !value)}><Icon name="lock" />{showClosed ? 'Hide closed' : 'Show closed'}</button>
      <button type="button" className={cx('adm-btn adm-btn--icon', busy && styles.spin)} onClick={() => setVersion((value) => value + 1)} aria-label="Refresh the board" title="Refresh the board"><Icon name="refresh" /></button>
      {perms.create && <Link className="adm-btn adm-btn--primary" href="/admin/leads?add=1"><Icon name="plus" />Add lead</Link>}
    </PageToolbar>

    {loaded.error && !columns && <div className={cx('adm-panel', styles.errorBox)} role="alert"><Icon name="alert" /><span>{loaded.error}</span><button type="button" className="adm-btn adm-btn--sm" onClick={() => setVersion((value) => value + 1)}>Retry</button></div>}

    {columns && <div className={styles.phoneTabs}>
      <ViewTabs label="Choose a stage" value={current} onChange={(status) => focusStage(status)} items={shown.map((status) => ({ key: status, label: STAGES[status].label, count: totals[status] }))} />
    </div>}

    {!columns && !loaded.error && <div className={styles.board} aria-busy="true" aria-label="Loading the board">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className={styles.skeletonCol}><i /><i /><i /><i /></div>)}
    </div>}

    {columns && grand === 0 && filtered && <div className={cx('adm-panel', styles.emptyBoard)}>No leads match these filters. <button type="button" className="adm-btn adm-btn--sm" onClick={clearAll}>Clear filters</button></div>}

    {columns && !(grand === 0 && filtered) && <div ref={boardRef} className={styles.board} aria-busy={busy} aria-label="Pipeline columns">
      {shown.map((status) => {
        const col = columns[status];
        const stage = STAGES[status];
        const closed = CLOSED.has(status);
        const share = grand ? Math.round((col.total / grand) * 100) : 0;
        return <section key={status} ref={(node) => { columnRefs.current[status] = node; }} className={styles.column} data-active={status === current} data-drop={over === status && drag?.from !== status}
          aria-labelledby={`col-${status}`} onDragOver={(event) => onColumnOver(event, status)} onDrop={(event) => onColumnDrop(event, status)}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOver((value) => (value === status ? '' : value)); }}>
          <header className={styles.columnHead}>
            <h2 id={`col-${status}`} className={styles.columnTitle}><i className="crm-tone" data-tone={stage.tone} aria-hidden="true" />{stage.label}</h2>
            <span className={`crm-tabnum ${styles.columnCount}`} title={`${formatNumber(col.total)} leads · ${share}% of the pipeline${filtered ? ' (filtered)' : ''}`}>{formatNumber(col.total)}</span>
          </header>
          <div className={styles.columnBody}>
            <div className={styles.dropHint}>Drop to move to {stage.label}</div>
            {col.items.length === 0 && <p className={styles.empty} title={perms.move && !filtered ? 'Drag a card here, or use a card’s ⋮ menu' : undefined}>{filtered ? 'No matches' : 'No leads'}</p>}
            {col.items.map((lead) => <BoardCard key={lead.id} lead={lead} closed={closed} perms={perms} people={people} dragging={drag?.id === lead.id} moved={movedId === lead.id}
              onDragStart={onDragStart} onDragEnd={onDragEnd} act={act} />)}
            {col.hasNext && <button type="button" className={cx('adm-btn adm-btn--sm adm-btn--ghost', styles.loadMore)} disabled={col.more} onClick={() => loadMore(status)}>{col.more ? 'Loading…' : `Show ${formatNumber(Math.min(20, col.total - col.items.length))} more of ${formatNumber(col.total - col.items.length)}`}</button>}
          </div>
        </section>;
      })}
    </div>}

    <ConfirmDialog open={Boolean(pending)} icon="swap" title={pending ? `Move ${pending.lead.applicant?.fullName || 'this lead'} to ${STAGES[pending.to].label}?` : ''} confirmLabel={pending ? `Move to ${STAGES[pending.to].label}` : 'Move'}
      onCancel={() => setPending(null)} onConfirm={() => { const { lead, to } = pending; setPending(null); moveLead(lead, to); }}>
      <p>{pending?.to === 'closed' ? 'Closed leads leave the working pipeline and stop showing follow-up reminders.' : 'Leads marked not interested leave the working pipeline.'} You can move the lead back to any stage later, and the move is recorded in its history.</p>
    </ConfirmDialog>
    <ConfirmDialog open={Boolean(removing)} tone="danger" icon="trash" title={removing ? `Delete ${removing.lead.applicant?.fullName || 'this lead'}?` : ''} confirmLabel="Move to the Lead bin" busy={removing?.busy} error={removing?.error}
      onCancel={() => setRemoving(null)} onConfirm={deleteLead}>
      <p>The lead disappears from the board and the leads list. It goes to the Lead bin, where people who can see every lead can restore it.</p>
    </ConfirmDialog>
    <LogCallDialog open={Boolean(logLead)} lead={logLead ? { id: logLead.id, name: logLead.applicant?.fullName, phone: logLead.applicant?.phone } : null} onClose={() => setLogLead(null)}
      onLogged={({ lead, followUpAt }) => { if (lead) mutate((cols) => syncLead(cols, lead)); toast.success(followUpAt ? 'Call logged and next follow-up planned' : 'Call logged'); }} />
    <FollowUpDialog open={Boolean(followLead)} mode="create" lead={followLead ? { id: followLead.id, name: followLead.applicant?.fullName, phone: followLead.applicant?.phone } : null} onClose={() => setFollowLead(null)}
      onSaved={(result) => { if (result?.lead) mutate((cols) => syncLead(cols, result.lead)); toast.success('Follow-up scheduled'); }} />
  </div>;
}
