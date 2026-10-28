'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from '@/features/admin/AdminSession';
import { formatDay } from '@/features/admin/leads/lead-format';
import tableStyles from '@/features/admin/table/Table.module.css';
import { toQuery, useServerList } from '@/features/admin/table/useServerList';
import BarList, { formatShare } from '@/features/admin/ui/BarList';
import KpiCard from '@/features/admin/ui/KpiCard';
import TrendChart from '@/features/admin/ui/TrendChart';
import styles from './LeadsDashboard.module.css';

const PRESETS = [
  { value: 'today', label: 'Today' }, { value: '7d', label: '7 days' }, { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' }, { value: 'month', label: 'This month' },
];
const DEFAULT_RANGE = '30d';
const MAX_DAYS = 400;
const DAY_MS = 86_400_000;
// Presets the leads list also understands; any other range links to it by dates.
const LIST_RANGES = ['today', '7d', '30d', 'month'];
// Mirrors backend PIPELINE_STATUSES (lead-insights.js): every status before admitted or closed.
const OPEN_STATUSES = ['new', 'contacted', 'in-progress', 'applied-to-university'];
const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const first = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim();
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const shortDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const longDay = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const count = (value) => (typeof value === 'number' ? value.toLocaleString('en-IN') : '—');

/** URL → API params: one preset, or a custom from/to (India dates). */
export function readRange(source = {}) {
  const range = first(source.range);
  if (PRESETS.some((preset) => preset.value === range)) return { range };
  const from = first(source.from);
  const to = first(source.to);
  if (isDay(from) && isDay(to) && from <= to) return { from, to };
  return { range: DEFAULT_RANGE };
}
function customError({ from, to }) {
  if (!isDay(from) || !isDay(to)) return 'Choose both a start and an end date.';
  if (from > to) return 'The start date must be on or before the end date.';
  if ((Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_DAYS) return `Choose a range of at most ${MAX_DAYS} days.`;
  return '';
}
const leadsHref = (params) => { const query = toQuery(params); return query ? `/admin/leads?${query}` : '/admin/leads'; };
const rangeParams = (range) => (range && LIST_RANGES.includes(range.preset) ? { range: range.preset } : range ? { from: range.from, to: range.to } : {});

function Card({ title, note, href, linkLabel = 'View leads', wide = false, loading = false, children }) {
  const id = useId();
  return <section className={styles.card} data-wide={wide || undefined} aria-labelledby={id} aria-busy={loading || undefined}>
    <header className={styles.cardHeader}>
      <div><h3 id={id}>{title}</h3>{note && <p>{note}</p>}</div>
      {href && !loading && <Link className={styles.cardLink} href={href}>{linkLabel}<span className="sr-only">: {title}</span><Icon name="arrow" /></Link>}
    </header>
    {loading ? <div className={styles.skeleton} aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div> : children}
  </section>;
}

function Workload({ employees, unassigned, range }) {
  const id = useId();
  const share = (part, whole) => (whole ? formatShare(part, whole) : '');
  return <div className={tableStyles.scroll} role="region" aria-labelledby={id} tabIndex={0}>
    <table className={`${tableStyles.table} ${styles.workload}`}>
      <caption id={id} className="sr-only">Leads per employee submitted in the selected range</caption>
      <thead><tr><th scope="col">Employee</th><th scope="col">Assigned</th><th scope="col">Open</th><th scope="col">Contacted</th><th scope="col">Admitted</th></tr></thead>
      <tbody>
        {employees.map((row) => <tr key={row.id}>
          <td data-label="Employee"><Link className={styles.personLink} href={leadsHref({ ...range, assignee: row.id })}>{row.email}</Link></td>
          <td data-label="Assigned"><strong>{count(row.assigned)}</strong></td>
          <td data-label="Open">{count(row.open)}</td>
          <td data-label="Contacted">{count(row.contacted)}{row.assigned > 0 && <small>{share(row.contacted, row.assigned)} of assigned</small>}</td>
          <td data-label="Admitted">{count(row.admitted)}{row.assigned > 0 && <small>{share(row.admitted, row.assigned)} of assigned</small>}</td>
        </tr>)}
        {typeof unassigned === 'number' && <tr className={styles.unassignedRow}>
          <td data-label="Employee"><Link className={styles.personLink} href={leadsHref({ ...range, assignee: 'unassigned' })}>Not assigned yet</Link></td>
          <td data-label="Assigned"><strong>{count(unassigned)}</strong></td>
          {['Open', 'Contacted', 'Admitted'].map((label) => <td key={label} data-label={label}><span aria-hidden="true">—</span><span className="sr-only">Not applicable</span></td>)}
        </tr>}
      </tbody>
    </table>
  </div>;
}

export default function LeadsDashboard({ initial }) {
  const router = useRouter();
  const { admin, request } = useAdminSession();
  const isAdmin = admin?.role !== 'employee';
  const [params, setParams] = useState(() => readRange(initial));
  const [customOpen, setCustomOpen] = useState(() => !params.range);
  const [draft, setDraft] = useState(() => ({ from: params.from ?? '', to: params.to ?? '' }));
  const [draftError, setDraftError] = useState('');
  const formId = useId();
  const { data, error, loading, busy, refreshing, reload } = useServerList(request, '/leads/insights', params, { scope: admin?.id ?? admin?.email ?? '' });

  const choose = (next) => {
    setParams(next);
    const query = next.range === DEFAULT_RANGE ? '' : toQuery(next);
    router.replace(query ? `/admin/leads/dashboard?${query}` : '/admin/leads/dashboard', { scroll: false });
  };
  const pickPreset = (value) => { setCustomOpen(false); setDraftError(''); choose({ range: value }); };
  const toggleCustom = () => {
    if (!customOpen && !draft.from && !draft.to && data?.range) setDraft({ from: data.range.from, to: data.range.to });
    setCustomOpen(!customOpen);
  };
  const applyCustom = (event) => {
    event.preventDefault();
    const message = customError(draft);
    setDraftError(message);
    if (!message) choose({ from: draft.from, to: draft.to });
  };

  const range = data?.range;
  const scope = rangeParams(range);
  const total = data?.total ?? 0;
  const show = !loading && Boolean(data);
  const kpis = data?.kpis ?? {};
  const allTime = [kpis.open, kpis.closed, kpis.admitted].every((value) => typeof value === 'number') ? kpis.open + kpis.closed + kpis.admitted : null;
  const peak = data?.trend?.reduce((best, item) => (item.count > (best?.count ?? 0) ? item : best), null);
  const rangeText = range ? (range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`) : '';
  const trend = (data?.trend ?? []).map((item) => {
    const day = new Date(`${item.date}T00:00:00Z`);
    return { key: item.date, value: item.count, short: shortDay.format(day), long: longDay.format(day) };
  });
  const rows = (list, toRow) => (total ? (list ?? []).map(toRow) : []);
  const empty = 'No leads in this range.';

  return <div className={styles.dashboard}>
    <section className={styles.header} aria-label="Date range">
      <div className={styles.headText}>
        <p className={styles.eyebrow}>{isAdmin ? 'All leads' : 'Leads assigned to you'}</p>
        <h2>{range ? rangeText : 'Leads dashboard'}</h2>
        <p className={styles.headMeta} aria-live="polite">
          {range ? `${range.days.toLocaleString('en-IN')} ${range.days === 1 ? 'day' : 'days'} · ${count(total)} ${total === 1 ? 'lead' : 'leads'} · India time` : loading ? 'Loading…' : ''}
          {(busy || refreshing) && <span className={styles.updating}> · Updating…</span>}
        </p>
      </div>
      <div className={styles.controls}>
        <div className={`${tableStyles.presetChips} ${styles.presets}`} role="group" aria-label="Date range presets">
          {PRESETS.map((preset) => <button key={preset.value} type="button" aria-pressed={params.range === preset.value} onClick={() => pickPreset(preset.value)}>{preset.label}</button>)}
          <button type="button" aria-pressed={!params.range} aria-expanded={customOpen} aria-controls={formId} onClick={toggleCustom}><Icon name="calendar" />Custom</button>
        </div>
        <div className={styles.headActions}>
          {data?.generatedAt && <span className={styles.updated}>Updated {clock.format(new Date(data.generatedAt))}</span>}
          <button type="button" className="button button--ghost" onClick={reload} disabled={busy || refreshing}><Icon name="refresh" />Refresh</button>
          <Link className="button button--outline" href={leadsHref(scope)}><Icon name="eligibility" />Open leads</Link>
        </div>
      </div>
      {customOpen && <form id={formId} className={styles.custom} onSubmit={applyCustom} noValidate>
        <label>From<input type="date" className={styles.dateInput} value={draft.from} max={draft.to || istToday()} onChange={(event) => setDraft({ ...draft, from: event.target.value })} aria-invalid={Boolean(draftError) || undefined} aria-describedby={draftError ? `${formId}-error` : undefined} /></label>
        <label>To<input type="date" className={styles.dateInput} value={draft.to} min={draft.from || undefined} max={istToday()} onChange={(event) => setDraft({ ...draft, to: event.target.value })} aria-invalid={Boolean(draftError) || undefined} aria-describedby={draftError ? `${formId}-error` : undefined} /></label>
        <button type="submit" className="button button--primary">Apply</button>
        <p className={styles.customHint}>Up to {MAX_DAYS} days, India time, both days included.</p>
        {draftError && <p id={`${formId}-error`} className={styles.customError} role="alert">{draftError}</p>}
      </form>}
    </section>

    {error && !data ? <div className={tableStyles.state} role="alert">
      <Icon name="shield" />
      <div><strong>The dashboard could not load.</strong><p>{error}</p></div>
      <div className={styles.errorActions}>
        <button type="button" className="button button--outline" onClick={reload}>Try again</button>
        {params.range !== DEFAULT_RANGE && <button type="button" className="button button--ghost" onClick={() => pickPreset(DEFAULT_RANGE)}>Show the last 30 days</button>}
      </div>
    </div> : <>
      <section className={styles.kpis} aria-label="Key figures">
        <KpiCard label="Today" icon="calendar" loading={!show} value={kpis.today} note="Since midnight" href={leadsHref({ range: 'today' })} />
        <KpiCard label="Yesterday" icon="calendar" loading={!show} value={kpis.yesterday} note="Full day, India time" href={leadsHref({ range: 'yesterday' })} />
        <KpiCard label="Last 7 days" icon="trend" loading={!show} value={kpis.last7} note={typeof kpis.last7 === 'number' ? `${(kpis.last7 / 7).toLocaleString('en-IN', { maximumFractionDigits: 1 })} a day` : ''} href={leadsHref({ range: '7d' })} />
        <KpiCard label="Last 30 days" icon="chart" loading={!show} value={kpis.last30} note={typeof kpis.last30 === 'number' ? `${(kpis.last30 / 30).toLocaleString('en-IN', { maximumFractionDigits: 1 })} a day` : ''} href={leadsHref({ range: '30d' })} />
        <KpiCard label="Open" icon="eligibility" loading={!show} value={kpis.open} note="All time · still being worked" href={leadsHref({ status: OPEN_STATUSES.join(',') })} />
        <KpiCard label="Admitted" icon="cap" loading={!show} value={kpis.admitted} note={allTime ? `All time · ${formatShare(kpis.admitted, allTime)} of all leads` : 'All time'} href={leadsHref({ status: 'admitted' })} />
      </section>

      <div className={styles.grid} data-busy={busy || undefined}>
        <Card wide loading={!show} title="Leads per day" href={leadsHref(scope)}
          note={total ? `${count(total)} in ${rangeText}${peak ? ` · busiest: ${formatDay(peak.date)} (${count(peak.count)})` : ''}` : `No leads in ${rangeText || 'this range'}`}>
          <TrendChart data={trend} title={`Leads per day, ${rangeText}`} />
        </Card>
        <Card loading={!show} title="Source" note="Share of leads in this range" href={leadsHref(scope)}>
          <BarList label="Leads by source" total={total} emptyText={empty} rows={rows(data?.byChannel, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, channel: row.value }) }))} />
        </Card>
        <Card loading={!show} title="Status funnel" note="Where this range’s leads are now" href={leadsHref(scope)}>
          <BarList label="Leads by status, in funnel order" total={total} emptyText={empty} rows={rows(data?.byStatus, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, status: row.value }) }))} />
        </Card>
        <Card loading={!show} title="Top states" note="Applicant’s state · top 12" href={leadsHref(scope)}>
          <BarList label="Leads by applicant state" total={total} emptyText={empty} rows={rows(data?.byState, (row) => ({ key: row.value || '-', label: row.label, value: row.count, href: row.value ? leadsHref({ ...scope, state: row.value }) : undefined }))} />
        </Card>
        <Card loading={!show} title="Top courses" note="Website applications · top 10" href={leadsHref({ ...scope, channel: 'web-apply' })}>
          <BarList label="Website applications by course" emptyText="No course chosen on website applications in this range." rows={rows(data?.byCourse, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, course: row.value }) }))} />
        </Card>
        <Card loading={!show} title="Top school drives" note="QR registrations · top 10" href={leadsHref({ ...scope, channel: 'school-drive' })}>
          <BarList label="School drive registrations by drive" emptyText="No school drive registrations in this range." rows={rows(data?.bySchool, (row) => ({
            key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, form: row.value }),
            hint: [row.title && row.title !== row.label ? row.title : '', [row.district, row.state].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
          }))} />
        </Card>
        <Card loading={!show} title="Career fields" note="Counsellor callbacks · top 10" href={leadsHref({ ...scope, channel: 'callback' })}>
          <BarList label="Counsellor callbacks by career field" emptyText="No counsellor callbacks in this range." rows={rows(data?.byCareerField, (row) => ({ key: row.value, label: row.label, value: row.count, href: leadsHref({ ...scope, careerField: row.value }) }))} />
        </Card>
        {isAdmin && (!show || Array.isArray(data?.employees)) && <Card wide loading={!show} title="Team workload" note="Leads submitted in this range, by assignee" href={leadsHref(scope)}>
          {data?.employees?.length || data?.unassigned
            ? <Workload employees={data.employees ?? []} unassigned={data.unassigned} range={scope} />
            : <p className={styles.muted}>No employees yet. <Link href="/admin/employees">Add an employee</Link> to assign leads.</p>}
        </Card>}
      </div>
    </>}
  </div>;
}
