'use client';
/**
 * Staff leads list (CRM work screen). The shell renders the page title and the section tabs, so this starts with
 * the toolbar: search, saved views and active filter chips on the left; sort, filters, columns, download and
 * "Add lead" on the right. Below: one quick-view strip (Hot, Follow-up today, Overdue, …) that filters the
 * table, stage tabs with counts, then the server-paged table with row menus and a sticky bulk bar.
 * Built for large volumes: server paging (25/50/100), debounced search, cached counts, no per-row requests.
 *
 * Embeddable (e.g. the submissions of one school drive):
 *   <LeadsManager
 *     initial={searchParams}      // starting filters (the URL params on /admin/leads; `add=1` opens "Add lead")
 *     fixedFilters={{ form: id }} // merged into every list/count/export request; hidden from the drawer, chips and URL
 *     syncUrl={false}             // default true: filters, page, rows per page and sort live in the /admin/leads URL
 *     formId={id}                 // scopes GET /leads/columns (adds that form's answer columns) and the saved column choice;
 *                                 // implies fixedFilters={{ form: id }} so answer columns always have their form in scope
 *     heading="Registrations" />  // what the rows are, for the summary line and screen readers (default "Leads")
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import AdminDrawer from '@/features/admin/AdminDrawer';
import RowMenu from '@/features/admin/crm/RowMenu';
import { useToaster } from '@/features/admin/crm/toast';
import { HeatChip, ScoreMeter } from '@/features/admin/crm/ui';
import { CHANNELS, can, OPEN_STAGES, STAGES } from '@/features/admin/crm/meta';
import { dateTimeOf, displayName, relativeTime } from '@/features/admin/crm/format';
import { PageToolbar, StatStrip, ViewTabs } from '@/features/admin/ui/Page';
import ActiveFilterChips from '@/features/admin/table/ActiveFilterChips';
import ColumnPicker from '@/features/admin/table/ColumnPicker';
import DataTable from '@/features/admin/table/DataTable';
import ExportDialog from '@/features/admin/table/ExportDialog';
import FilterDrawer, { splitList } from '@/features/admin/table/FilterDrawer';
import Pagination from '@/features/admin/table/Pagination';
import { useColumnPrefs } from '@/features/admin/table/useColumnPrefs';
import { clearServerListCache, toQuery, useServerList } from '@/features/admin/table/useServerList';
import AddLeadDrawer from './AddLeadDrawer';
import { Dash, FollowUpText, formatWhen, Person, PriorityText, StageDot } from './lead-bits';
import { BulkBar, BulkDialog } from './LeadBulk';
import { activeFilterCount, apiFilterParams, DRAWER_KEYS, EMPTY_FILTERS, leadFilterChips, leadFilterSections, readFilters, urlParams, withoutPaging } from './lead-filters';
import { formatCount, isQuick, LEAD_PAGE_SIZES, LEAD_STATUSES, LEADS_FLASH_KEY, LEADS_QUERY_KEY, whatsAppLink } from './lead-format';
import { activeViewOf, CLEAR_VIEW, personName, useCrmMeta, useSavedViews, viewKeys, viewsFor } from './lead-views';
import styles from './Leads.module.css';

const NO_FILTERS = {};
const NOUN = { one: 'lead', many: 'leads' };
// Shown while /leads/columns loads so the skeleton has a familiar shape.
const PLACEHOLDER_COLUMNS = ['Lead', 'Temperature', 'Stage', 'Next follow-up', 'Priority', 'Assigned to', 'Course'].map((label) => ({ key: label, label }));
// The CRM order: who, how warm, where in the pipeline, what to do next, how urgent, who holds it. Registry defaults are not CRM-ordered.
// The defaults fit a 1280px screen without a horizontal scrollbar; Source, Received, Score… are one click away in Columns.
const CRM_DEFAULTS = ['fullName', 'heat', 'status', 'nextFollowUp', 'priority', 'assigned', 'course'];
// Fixed column widths (px) for the fixed-layout table; columns without one (Lead, Course, form answers) share the rest.
const WIDTHS = { heat: 100, status: 112, nextFollowUp: 120, priority: 84, assigned: 140, createdAt: 120, channel: 128, score: 100, ref: 132, phone: 132, email: 190, tags: 150, lastActivity: 104, _menu: 44 };
const SYNTHETIC_ASSIGNED = { key: 'assigned', label: 'Assigned to', group: 'Lead' };
const MENU_COLUMN = { key: '_menu', label: 'Actions', width: WIDTHS._menu };
const LABELS = { fullName: 'Lead', status: 'Stage', nextFollowUp: 'Next follow-up', createdAt: 'Received' };
const SORTS = [{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }];

// Prefetch target after a page loads: the next numbered page, or the next cursor page past the skip limit.
// Matches what Pagination asks for, so a click on Next is usually served from the cache.
function nextPage(data, params) {
  if (!data?.hasNext) return null;
  const page = Number(params.page || 1) + 1;
  const reachable = Math.floor(data.maxSkip / Number(params.limit || LEAD_PAGE_SIZES[0])) + 1;
  return page <= reachable ? { ...params, page, cursor: '', dir: '' } : { ...params, page, cursor: data.cursors?.last ?? '', dir: 'after' };
}

const isOpen = (item) => OPEN_STAGES.includes(item.status);
const muted = (title) => <Dash title={title} />;

function StageText({ status }) {
  const config = STAGES[status] ?? { label: status, tone: 'neutral' };
  return <StageDot label={config.label} tone={config.tone} />;
}

function AssigneeCell({ item, people, text }) {
  const ids = item.assignedEmployeeIds ?? [];
  if (!ids.length) return muted('Unassigned');
  const known = ids.map((id) => people.get(id)).filter(Boolean).map(personName);
  const names = known.length ? known : String(text ?? '').split(';').map((value) => displayName(value.trim())).filter(Boolean);
  if (!names.length) return <Person name={`${ids.length} assigned`} />;
  return <Person name={names[0]} email={names[0]} extra={names.length - 1} title={names.join(', ')} />;
}

function LeadCell({ item }) {
  const name = item.applicant?.fullName || 'Name not provided';
  const phone = item.applicant?.phone;
  const wa = whatsAppLink(phone);
  return <div className={styles.leadCell}>
    <div className={styles.leadMain}>
      <Link className={styles.leadName} href={`/admin/leads/${item.id}`} title={`${name} · ${item.ref}`}>{name}</Link>
      <small className={styles.leadSub}>{phone ? <a href={`tel:${phone}`}>{phone}</a> : 'No mobile'}<span aria-hidden="true"> · </span><span>{item.ref}</span></small>
    </div>
    {phone && <span className={styles.quick}>
      <a href={`tel:${phone}`} aria-label={`Call ${name}`} title="Call"><Icon name="phone" /></a>
      {wa && <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${name}`} title="WhatsApp"><Icon name="chat" /></a>}
    </span>}
  </div>;
}

function courseCell(item) {
  const preference = item.preference ?? {};
  const school = item.school ?? {};
  const primary = preference.courseName || item.careerField?.name || school.name || '';
  const secondary = preference.institutionName || [school.district, school.state].filter(Boolean).join(', ') || '';
  if (!primary && !secondary) return muted('No course recorded');
  return <div className={styles.course} title={[primary, secondary].filter(Boolean).join(' · ')}><span>{primary || secondary}</span>{primary && secondary && <small>{secondary}</small>}</div>;
}

/** Name a saved view (the current filters). */
function SaveViewDialog({ open, onClose, onSave, existing }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const clash = existing.some((view) => view.name.toLowerCase() === name.trim().toLowerCase());
  function submit(event) {
    event.preventDefault();
    if (name.trim().length < 2) { setError('Give the view a name of at least 2 characters.'); return; }
    onSave(name); setName(''); setError('');
  }
  return <AdminDrawer open={open} onClose={onClose} variant="confirm" title="Save this view" subtitle="Saves the current search, filters, stage and sort for you, in this browser.">
    {open && <form className={styles.dialogForm} onSubmit={submit} noValidate>
      <label className="adm-label" htmlFor="save-view-name">Name
        <input id="save-view-name" className="adm-input" value={name} maxLength={40} autoFocus placeholder="e.g. Hot leads in Dehradun" aria-invalid={error ? 'true' : undefined} aria-describedby="save-view-help"
          onChange={(event) => { setName(event.target.value); setError(''); }} />
        {error ? <span className="adm-error" role="alert">{error}</span>
          : <span className="adm-hint" id="save-view-help">{clash ? 'A view with this name exists; saving replaces it.' : 'Only you see your saved views.'}</span>}
      </label>
      <div className={styles.dialogActions}>
        <button type="button" className="adm-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="adm-btn adm-btn--primary">{clash ? 'Replace view' : 'Save view'}</button>
      </div>
    </form>}
  </AdminDrawer>;
}

/** Rename or delete saved views. */
function ManageViewsDrawer({ open, onClose, views, actions, onApply }) {
  const [names, setNames] = useState({});
  const valueOf = (view) => names[view.id] ?? view.name;
  return <AdminDrawer open={open} onClose={onClose} title="Saved views" subtitle="Your saved filter sets for the leads list. They are kept in this browser.">
    {open && <div className={styles.manage}>
      {!views.length && <p className="adm-hint">No saved views. Filter the list, then choose “Save current view…”.</p>}
      <ul className={styles.viewList}>
        {views.map((view) => <li key={view.id}>
          <label className="sr-only" htmlFor={`view-name-${view.id}`}>Name of {view.name}</label>
          <input id={`view-name-${view.id}`} className="adm-input" value={valueOf(view)} maxLength={40}
            onChange={(event) => setNames((current) => ({ ...current, [view.id]: event.target.value }))}
            onBlur={() => { if (valueOf(view).trim() && valueOf(view) !== view.name) actions.rename(view.id, valueOf(view)); }} />
          <button type="button" className="adm-btn adm-btn--sm" onClick={() => { onApply(view); onClose(); }}>Open</button>
          <button type="button" className="adm-btn adm-btn--sm adm-btn--icon adm-btn--ghost" aria-label={`Delete ${view.name}`} title="Delete view" onClick={() => actions.remove(view.id)}><Icon name="trash" /></button>
        </li>)}
      </ul>
      <div className={styles.dialogActions}><button type="button" className="adm-btn adm-btn--primary" onClick={onClose}>Done</button></div>
    </div>}
  </AdminDrawer>;
}

export default function LeadsManager({ initial = NO_FILTERS, fixedFilters = NO_FILTERS, syncUrl = true, formId = '', heading = 'Leads' }) {
  const { admin, request } = useAdminSession();
  const { assignees, people } = useCrmMeta();
  const search = useSearchParams();
  const leadScope = admin?.leadScope ?? 'own';
  const canCreate = can(admin, 'leads.create');
  const canExport = can(admin, 'leads.export');
  const canAssign = can(admin, 'leads.assign');
  const canNotes = can(admin, 'leads.notes');
  const bulkAllowed = useMemo(() => (can(admin, 'leads.bulk') ? {
    status: can(admin, 'leads.change_status'), heat: can(admin, 'crm.heat'), priority: can(admin, 'crm.heat'), tag: can(admin, 'crm.heat'),
    assign: canAssign && assignees.length > 0, delete: can(admin, 'leads.delete'),
  } : null), [admin, assignees.length, canAssign]);
  const selectable = Boolean(bulkAllowed) && Object.values(bulkAllowed).some(Boolean);
  const scope = admin?.id ?? '';
  const fixedKey = toQuery({ ...(formId && { form: formId }), ...fixedFilters });
  const fixed = useMemo(() => Object.fromEntries(new URLSearchParams(fixedKey)), [fixedKey]);
  const hidden = useMemo(() => Object.keys(fixed), [fixed]);
  const scoped = hidden.length > 0;
  const views = useMemo(() => viewsFor(admin), [admin]);
  const [savedViews, savedActions] = useSavedViews(scoped ? '' : admin?.id);

  const [filters, setFilters] = useState(() => {
    const start = readFilters(initial);
    return { ...start, ...Object.fromEntries(hidden.map((key) => [key, ''])) };
  });
  const [query, setQuery] = useState(filters.q);
  const [panel, setPanel] = useState(() => (!scoped && String(initial.add ?? '') === '1' ? 'add' : ''));
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [rowAction, setRowAction] = useState(null);
  const toast = useToaster();
  const router = useRouter();

  // A school drive chosen in the filters (or fixed by the embedding page) adds that form's answer columns.
  const columnsForm = fixed.form || formId || filters.form;
  const columnsInfo = useServerList(request, '/leads/columns', { form: columnsForm }, { scope });
  const options = useServerList(request, '/leads/filter-options', {}, { scope }).data;
  // Stage counts exist for all leads or for one school drive; other fixed scopes hide them.
  const statsScoped = hidden.length === 1 && hidden[0] === 'form';
  const stats = useServerList(request, '/leads/stats', statsScoped ? { form: fixed.form } : {}, { scope, enabled: !scoped || statsScoped });
  // Quick-view counts: one cached request (indexed counts on the server), never one request per view.
  const viewCounts = useServerList(request, '/leads/view-counts', {}, { scope, enabled: !scoped && Boolean(admin) });
  // Team leads do not get the registry's "Assigned to" column (it is company-wide), but they do see who holds each lead.
  const columnItems = useMemo(() => {
    const items = columnsInfo.data?.items;
    if (!items) return null;
    return leadScope === 'team' && !items.some((column) => column.key === SYNTHETIC_ASSIGNED.key) ? [...items, SYNTHETIC_ASSIGNED] : items;
  }, [columnsInfo.data, leadScope]);
  const available = useMemo(() => columnItems?.map((column) => column.key) ?? [], [columnItems]);
  const defaults = useMemo(() => {
    const picked = CRM_DEFAULTS.filter((key) => available.includes(key));
    return picked.length ? picked : columnsInfo.data?.defaults ?? [];
  }, [available, columnsInfo.data]);
  // "v3": the dense defaults (they fit 1280px); column choices saved before the redesign are ignored once.
  const [visibleKeys, saveColumns] = useColumnPrefs(admin ? `gv-admin-cols:leads:v3:${admin.id}${formId ? `:${formId}` : ''}` : '', available, defaults);
  const columnsReady = Boolean(columnsInfo.data) && !columnsInfo.busy && visibleKeys.length > 0;
  const registryKeys = useMemo(() => new Set(columnsInfo.data?.items.map((column) => column.key) ?? []), [columnsInfo.data]);

  const filterParams = useMemo(() => apiFilterParams(filters, fixed), [filters, fixed]);
  const list = useServerList(request, '/leads', {
    ...filterParams, page: filters.page, limit: filters.limit, sort: filters.sort === 'newest' ? '' : filters.sort,
    cursor: filters.cursor, dir: filters.dir, columns: visibleKeys.filter((key) => registryKeys.has(key)).join(','),
  }, { scope, enabled: columnsReady, next: nextPage });
  const data = list.data;
  const items = data?.items ?? [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = query.trim();
      setFilters((current) => (current.q === q ? current : { ...withoutPaging(current), q }));
      setSelectedIds([]);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Filters live in the URL (shareable, survive Back) and in session storage for the detail page's back link.
  useEffect(() => {
    if (!syncUrl) return;
    const queryString = toQuery(urlParams(filters));
    window.history.replaceState(null, '', `/admin/leads${queryString ? `?${queryString}` : ''}`);
    try { window.sessionStorage.setItem(LEADS_QUERY_KEY, queryString ? `?${queryString}` : ''); } catch { /* storage unavailable */ }
  }, [filters, syncUrl]);

  // The shell's "New → Lead" links to /admin/leads?add=1, also while this list is already open.
  const addParam = search?.get('add');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (addParam === '1' && !scoped && canCreate) setPanel('add');
  }, [addParam, scoped, canCreate]);

  // A one-line message left by the lead page (e.g. after deleting a lead).
  useEffect(() => {
    try {
      const flash = window.sessionStorage.getItem(LEADS_FLASH_KEY);
      if (flash) { window.sessionStorage.removeItem(LEADS_FLASH_KEY); toast.success(flash); }
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch, { keepPage = false } = {}) => {
    setFilters((current) => ({ ...(keepPage ? current : withoutPaging(current)), ...patch }));
    setSelectedIds([]);
  }, []);
  const countFor = useCallback((draft, signal) => request(`/leads?${toQuery({ ...apiFilterParams(draft, fixed), limit: LEAD_PAGE_SIZES[0] })}`, { signal }).then((result) => result.total), [fixed, request]);
  function close() {
    if (panel === 'add' && syncUrl && new URLSearchParams(window.location.search).has('add')) {
      const queryString = toQuery(urlParams(filters));
      window.history.replaceState(null, '', `/admin/leads${queryString ? `?${queryString}` : ''}`);
    }
    setPanel('');
  }
  function clearAll() {
    setQuery('');
    setFilters((current) => ({ ...readFilters({}), limit: current.limit, sort: current.sort }));
    setSelectedIds([]);
  }
  function refresh() {
    clearServerListCache('/leads');
    list.reload(); stats.reload(); viewCounts.reload();
  }
  function bulkDone(message) {
    setBulkAction(null); setSelectedIds([]); toast.success(message); refresh();
  }
  function rowDone(message) {
    setRowAction(null); toast.success(message); refresh();
  }
  function copyPhone(phone) {
    (window.navigator.clipboard?.writeText(phone) ?? Promise.reject(new Error('unavailable')))
      .then(() => toast.success(`Copied ${phone}.`), () => toast.error('Could not copy. Select the number and copy it by hand.'));
  }
  function menuItems(item) {
    const href = `/admin/leads/${item.id}`;
    const phone = item.applicant?.phone;
    const email = item.applicant?.email;
    const wa = whatsAppLink(phone);
    const open = isOpen(item);
    const act = (action) => () => setRowAction({ action, lead: item });
    return [
      { key: 'open', label: 'Open lead', icon: 'eye', href },
      { key: 'call', label: 'Call', icon: 'phone', hint: phone, disabled: !phone, reason: 'This lead has no mobile number', onSelect: () => { window.location.href = `tel:${phone}`; } },
      { key: 'wa', label: 'WhatsApp', icon: 'chat', disabled: !wa, reason: 'This lead has no mobile number', onSelect: () => window.open(wa, '_blank', 'noopener,noreferrer') },
      { key: 'email', label: 'Email', icon: 'mail', disabled: !email, reason: 'This lead has no email address', onSelect: () => { window.location.href = `mailto:${email}`; } },
      { divider: true },
      { key: 'log', label: 'Log activity', icon: 'note', hidden: !canNotes, href: `${href}#log` },
      { key: 'follow', label: 'Schedule follow-up', icon: 'calendar', hidden: !canNotes, disabled: !open, reason: 'Closed leads have no follow-ups', href: `${href}#follow-up` },
      { key: 'stage', label: 'Change stage…', icon: 'trend', hidden: !can(admin, 'leads.change_status'), onSelect: act('status') },
      { key: 'heat', label: 'Set temperature…', icon: 'flame', hidden: !can(admin, 'crm.heat'), onSelect: act('heat') },
      { key: 'priority', label: 'Set priority…', icon: 'flag', hidden: !can(admin, 'crm.heat'), onSelect: act('priority') },
      { divider: true },
      { key: 'assign', label: 'Assign…', icon: 'userPlus', hidden: !(canAssign && assignees.length), onSelect: act('assign') },
      { key: 'edit', label: 'Edit details', icon: 'edit', hidden: !can(admin, 'leads.edit'), href: `${href}#edit` },
      { key: 'copy', label: 'Copy phone number', icon: 'copy', disabled: !phone, reason: 'This lead has no mobile number', onSelect: () => copyPhone(phone) },
      { divider: true },
      { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', hidden: !can(admin, 'leads.delete'), onSelect: act('delete') },
    ];
  }

  // ---- quick views, stage tabs, chips ----
  const view = scoped ? null : activeViewOf(filters, views);
  const statuses = splitList(filters.status);
  const counts = new Map((stats.data?.byStatus ?? []).map((row) => [row.status, row.count]));
  const showStages = !scoped || statsScoped;
  const states = options?.states ?? [];
  const sections = leadFilterSections({ options, assignees, scope: leadScope, hidden });
  const viewOwned = view ? viewKeys(view) : [];
  const chips = leadFilterChips({ filters, options, assignees, hidden, skip: viewOwned, statusChip: statuses.length > 1 || !showStages, onChange: (patch) => update(patch) });
  // The stage shown as a selected tab and the filters owned by the active quick view are not counted again on the Filters button.
  const stageInTabs = showStages && statuses.length === 1 && !viewOwned.includes('status');
  const filterCount = activeFilterCount(filters, hidden) - (view ? viewOwned.filter((key) => filters[key]).length : 0) - (stageInTabs ? 1 : 0);
  const anyFilter = filterCount > 0 || Boolean(filters.q) || Boolean(view);
  const pickView = (item) => {
    const owns = (target) => target && 'status' in target.params;
    if (view?.key === item.key) update({ ...CLEAR_VIEW, ...(owns(item) && { status: '' }) });
    else update({ ...CLEAR_VIEW, ...((owns(item) || owns(view)) && { status: '' }), ...item.params });
  };
  const countOf = viewCounts.data?.counts ?? {};
  const statItems = views.map((item) => ({
    key: item.key, label: item.label, icon: item.icon, tone: item.tone, active: view?.key === item.key,
    value: typeof countOf[item.key] === 'number' ? countOf[item.key] : viewCounts.data ? '—' : '…',
    onClick: () => pickView(item),
  }));
  const stageValue = statuses.length === 1 ? statuses[0] : statuses.length ? '' : 'all';
  const stageTabs = [
    { key: 'all', label: 'All stages', count: stats.data ? stats.data.total : undefined },
    ...LEAD_STATUSES.map((status) => ({ key: status.value, label: STAGES[status.value]?.label ?? status.label, count: stats.data ? counts.get(status.value) ?? 0 : undefined })),
  ];

  // ---- saved views ----
  const currentQuery = toQuery({ ...urlParams(withoutPaging(filters)), page: '', limit: '' });
  const activeSaved = savedViews.find((item) => item.query === currentQuery);
  function applySaved(item) {
    const next = readFilters(Object.fromEntries(new URLSearchParams(item.query)));
    setQuery(next.q);
    setFilters((current) => ({ ...next, limit: current.limit }));
    setSelectedIds([]);
  }
  const savedMenu = [
    { heading: 'Your views' },
    ...savedViews.map((item) => ({ key: item.id, label: item.name, icon: 'bookmark', hint: item.id === activeSaved?.id ? 'Open' : undefined, onSelect: () => applySaved(item) })),
    ...(!savedViews.length ? [{ key: 'none', label: 'No saved views yet', disabled: true, reason: 'Filter the list, then save it as a view' }] : []),
    { divider: true },
    { key: 'save', label: 'Save current view…', icon: 'plus', disabled: !currentQuery, reason: 'Choose a filter, stage, search or sort first', onSelect: () => setPanel('save') },
    { key: 'manage', label: 'Rename or delete…', icon: 'edit', hidden: !savedViews.length, onSelect: () => setPanel('manage') },
  ];

  // ---- table ----
  const columnList = columnItems;
  const shownKeys = visibleKeys.filter((key) => !(key === 'phone' && visibleKeys.includes('fullName')) && !(key === 'university' && visibleKeys.includes('course')));
  const tableColumns = columnList
    ? [...shownKeys.map((key) => columnList.find((column) => column.key === key)).filter(Boolean).map((column) => ({ ...column, label: LABELS[column.key] ?? column.label, width: WIDTHS[column.key], className: styles[`col_${column.key}`] })), { ...MENU_COLUMN, className: styles.menuCell }]
    : PLACEHOLDER_COLUMNS;
  const noun = 'leads';
  const count = !data ? 'Loading…' : data.total === null ? 'Many leads (the count timed out)' : `${formatCount(data.total)} ${data.total === 1 ? 'lead' : 'leads'}`;
  const totalText = heading === 'Leads' ? count : `${heading} · ${count}`;
  const newToday = stats.data?.last14Days?.at(-1)?.count;
  const scopeText = leadScope === 'own' ? 'assigned to you' : leadScope === 'team' ? 'you and your team' : '';

  function renderCell(item, column) {
    const value = item.values?.[column.key];
    const blank = value === '' || value === null || value === undefined;
    const crm = item.crm ?? {};
    switch (column.key) {
      case '_menu': return <RowMenu label={`Actions for ${item.applicant?.fullName || item.ref}`} items={menuItems(item)} />;
      case 'fullName': return <LeadCell item={item} />;
      case 'ref': return <><Link className={styles.refLink} href={`/admin/leads/${item.id}`}>{item.ref}</Link>{isQuick(item) && <span className={styles.mode} title="Submitted with the one-screen quick apply form">Quick</span>}</>;
      case 'status': return <StageText status={item.status} />;
      case 'channel': return CHANNELS[item.channel]?.label ?? value ? <span className={styles.truncate}>{CHANNELS[item.channel]?.label ?? value}</span> : muted();
      case 'heat': return crm.heat ? <HeatChip heat={crm.heat} source={crm.heatSource} score={crm.score} size="sm" /> : muted('Not scored yet');
      case 'priority': return <PriorityText priority={crm.priority ?? 'normal'} />;
      case 'nextFollowUp': return <FollowUpText at={crm.nextFollowUpAt} closed={!isOpen(item)} />;
      case 'score': return <ScoreMeter score={crm.score} />;
      case 'tags': return crm.tags?.length ? <span className={styles.truncate} title={crm.tags.join(', ')}>{crm.tags.join(', ')}</span> : muted();
      case 'lastActivity': return crm.lastActivityAt ? <span title={dateTimeOf(crm.lastActivityAt)}>{relativeTime(crm.lastActivityAt)}</span> : muted();
      case 'createdAt': return <span className="crm-tabnum" title={dateTimeOf(item.createdAt)}>{formatWhen(item.createdAt)}</span>;
      case 'course': return courseCell(item);
      case 'assigned': return <AssigneeCell item={item} people={people} text={value} />;
      case 'phone': return blank ? muted() : <a className={styles.cellLink} href={`tel:${value}`}>{value}</a>;
      case 'email': return blank ? muted() : <a className={styles.cellLink} href={`mailto:${value}`} title={value}>{value}</a>;
      default: return blank ? muted() : <span className={styles.truncate} title={String(value)}>{String(value)}</span>;
    }
  }

  function openRow(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const row = event.target.closest?.('tbody tr');
    if (!row || event.target.closest('a, button, input, select, label, textarea, [role="menu"]')) return;
    if (window.getSelection?.().toString()) return; // selecting text to copy is not a click
    const link = row.querySelector('a[href^="/admin/leads/"]');
    if (link) router.push(link.getAttribute('href'));
  }

  const emptyState = <>
    <p>{anyFilter || statuses.length ? `No ${noun} match these filters.` : leadScope === 'own' ? 'No leads are assigned to you yet.' : 'No leads yet.'}</p>
    {(anyFilter || statuses.length > 0) && <button type="button" className="adm-btn" onClick={clearAll}>Clear filters</button>}</>;

  return <div className={styles.manager}>
    <PageToolbar start={<>
      <label className={styles.search}><Icon name="search" /><span className="sr-only">Search {noun}</span>
        <input type="search" value={query} maxLength={100} placeholder="Search ref, name, mobile or email" onChange={(event) => setQuery(event.target.value)} />
      </label>
      {!scoped && syncUrl && <RowMenu label="Saved views" align="start" className={styles.menuButton} items={savedMenu}
        trigger={<><Icon name="bookmark" /><span>{activeSaved ? activeSaved.name : 'Saved views'}</span><Icon name="chevron" /></>} />}
      <ActiveFilterChips chips={chips} onClearAll={chips.length > 1 || (chips.length && (filters.q || view)) ? clearAll : null} />
    </>}>
      <label className={styles.sort}><span className="sr-only">Sort</span>
        <select className="adm-select" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>
          {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
        </select>
      </label>
      <button type="button" className="adm-btn" aria-haspopup="dialog" onClick={() => setPanel('filters')}>
        <Icon name="filter" />Filters{filterCount > 0 && <span className={styles.count} aria-label={`${filterCount} active`}>{filterCount}</span>}
      </button>
      <button type="button" className="adm-btn" aria-haspopup="dialog" aria-label="Columns" title="Columns" disabled={!columnsInfo.data} onClick={() => setPanel('columns')}><Icon name="layers" /><span className={styles.btnText}>Columns</span></button>
      {canExport && <button type="button" className="adm-btn" aria-haspopup="dialog" aria-label="Download" title="Download" disabled={!columnsInfo.data} onClick={() => setPanel('export')}><Icon name="download" /><span className={styles.btnText}>Download</span></button>}
      {canCreate && !scoped && <button type="button" className="adm-btn adm-btn--primary" aria-haspopup="dialog" onClick={() => setPanel('add')}><Icon name="plus" />Add lead</button>}
    </PageToolbar>

    {!scoped && <StatStrip label="Quick views" items={statItems} loading={!viewCounts.data && !viewCounts.error} />}

    <div className={styles.stageRow}>
      {showStages && <ViewTabs label="Filter by stage" value={stageValue} items={stageTabs} onChange={(key) => update({ status: key === 'all' ? '' : key })} />}
      <p className={styles.summary} aria-live="polite"><strong>{totalText}</strong>
        {showStages && typeof newToday === 'number' && <span> · {formatCount(newToday)} new today</span>}
        {scopeText && <span> · {scopeText}</span>}</p>
      <button type="button" className="adm-btn adm-btn--sm adm-btn--ghost adm-btn--icon" aria-label="Refresh the list" title="Refresh" onClick={refresh} disabled={list.busy}><Icon name="refresh" /></button>
    </div>

    {/* A click anywhere on a row (not on its links, buttons or checkbox) opens the lead, like the name link does. */}
    <section className={`adm-panel ${styles.tableCard}`} aria-label={heading} onClick={openRow}>
      <DataTable columns={tableColumns} rows={items} loading={list.loading} busy={list.busy || columnsInfo.busy} pageSize={filters.limit}
        caption={`${heading}, ${filters.sort === 'oldest' ? 'oldest' : 'newest'} first`} scrollKey={`${filters.page}|${filters.cursor}`}
        error={columnsInfo.error || list.error} onRetry={columnsInfo.error ? columnsInfo.reload : list.reload}
        selectable={selectable} selectedIds={selectedIds} onSelectionChange={setSelectedIds} rowLabel={(item) => item.ref} renderCell={renderCell}
        empty={emptyState} />
      {data && !list.error && (items.length > 0 || filters.page > 1) && <Pagination page={filters.page} pageSize={filters.limit} pageSizes={LEAD_PAGE_SIZES}
        total={data.total} totalExact={data.totalExact} rowCount={items.length} hasNext={data.hasNext} hasPrevious={data.hasPrevious} maxSkip={data.maxSkip}
        disabled={list.busy} noun={noun}
        onPage={(page) => update({ page, cursor: '', dir: '' }, { keepPage: true })}
        onPageSize={(limit) => update({ limit })}
        onNext={() => update({ page: filters.page + 1, cursor: data.cursors?.last ?? '', dir: 'after' }, { keepPage: true })}
        onPrevious={() => update({ page: Math.max(1, filters.page - 1), cursor: data.cursors?.first ?? '', dir: 'before' }, { keepPage: true })} />}
    </section>

    {selectedIds.length > 0 && bulkAllowed && <BulkBar count={selectedIds.length} allowed={bulkAllowed} onAction={setBulkAction} onClear={() => setSelectedIds([])} />}

    <FilterDrawer open={panel === 'filters'} onClose={close} title="Filter leads" subtitle="Combine any filters; the count updates as you choose."
      sections={sections} value={filters} emptyValue={EMPTY_FILTERS} countFor={countFor} noun={NOUN}
      onApply={(draft) => { update(Object.fromEntries(DRAWER_KEYS.filter((key) => !hidden.includes(key)).map((key) => [key, draft[key] ?? '']))); close(); }} />
    {columnList && <ColumnPicker open={panel === 'columns'} onClose={close} columns={columnList} value={visibleKeys} defaults={defaults}
      onApply={(keys) => { saveColumns(keys.join(',') === defaults.join(',') ? null : keys); close(); }} />}
    {canExport && columnsInfo.data && <ExportDialog open={panel === 'export'} onClose={close} request={request} checkPath="/leads/export/check" downloadPath="/api/admin/leads/export"
      columns={columnsInfo.data.items} visibleKeys={visibleKeys.filter((key) => registryKeys.has(key))} formats={columnsInfo.data.formats ?? []} params={filterParams} noun={NOUN} onDone={(message) => toast.success(message)} />}
    {canCreate && admin && !scoped && <AddLeadDrawer open={panel === 'add'} onClose={close} request={request} admin={admin} states={states} assignees={assignees} canAssign={canAssign && assignees.length > 0}
      onCreated={(item) => { close(); toast.success(`Lead ${item.ref} added.`, { action: { label: 'Open', onClick: () => router.push(`/admin/leads/${item.id}`) } }); refresh(); }} />}
    {!scoped && <SaveViewDialog open={panel === 'save'} onClose={close} existing={savedViews}
      onSave={(name) => { const saved = savedActions.save(name, currentQuery); close(); toast.success(`View “${saved.name}” saved.`); }} />}
    {!scoped && <ManageViewsDrawer open={panel === 'manage'} onClose={close} views={savedViews} actions={savedActions} onApply={applySaved} />}
    <BulkDialog action={rowAction?.action ?? bulkAction} ids={rowAction ? [rowAction.lead.id] : selectedIds} lead={rowAction?.lead ?? null} request={request} assignees={assignees}
      onClose={() => { setRowAction(null); setBulkAction(null); }} onDone={rowAction ? rowDone : bulkDone} />
  </div>;
}
