'use client';
// The console home pairs live admissions numbers with the next actions for the current staff member.
import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import { displayName, initialsOf, relativeTime } from './crm/format';
import { ACTIVITY, can, canAny, OPEN_STAGES, OUTCOMES } from './crm/meta';
import { FollowUpBadge } from './crm/ui';
import { cx, ErrorBanner, n, useTick } from './analytics/shared';
import { useServerList } from './table/useServerList';
import DistributionCard from './DistributionCard';
import { Card, Donut, Pipeline, Week } from './dashboard/charts';
import Insights from './dashboard/Insights';
import styles from './Dashboard.module.css';

const ANALYTICS = ['analytics.view_own', 'analytics.view_team', 'analytics.view_all'];
const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
const istHour = () => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
const greeting = () => { const hour = istHour(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };
const OPEN = OPEN_STAGES.join(',');
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const when = (value) => (value ? dateTime.format(new Date(value)) : '—');
const plural = (count, word) => `${n(count)} ${word}${count === 1 ? '' : 's'}`;

const QUICK = [
  { label: 'Add a lead', href: '/admin/leads?add=1', icon: 'plus', permission: 'leads.create', tone: 'bad' },
  { label: 'School drive', href: '/admin/drives?add=1', icon: 'building', permission: 'drives.create', tone: 'info' },
  { label: 'Add students', href: '/admin/reference-students/new', icon: 'userPlus', permission: 'students.create', tone: 'purple' },
  { label: 'Add a university', href: '/admin/institutions?new=1', icon: 'book', permission: 'catalogue.create', tone: 'warn' },
  { label: 'Review queue', href: '/admin/data/review', icon: 'checkCircle', permission: 'data.view', tone: 'good' },
  { label: 'Pipeline board', href: '/admin/leads/board', icon: 'board', permission: ['leads.view_own', 'leads.view_team', 'leads.view_all'], tone: 'orange' },
];

/** The stat cards. Each card's tone is a jewel colour with one job (see crm-tokens.css). */
function statItems(data) {
  const { leads, tasks, catalogue, students } = data;
  const own = leads?.scope === 'own';
  const items = [];
  if (leads) {
    items.push({ key: 'new', label: own ? 'My leads created today' : 'New leads today', value: leads.newToday, icon: 'inbox', tone: 'info', href: '/admin/leads?range=today' });
    items.push({ key: 'open', label: own ? 'My open leads' : 'Open leads', value: leads.open, icon: 'layers', tone: 'purple', href: `/admin/leads?status=${OPEN}` });
    items.push({ key: 'hot', label: 'Hot, waiting for a call', value: leads.hotWaiting, icon: 'flame', tone: 'bad', href: '/admin/leads?heat=hot&status=new' });
    const admitted = leads.byStage?.find((stage) => stage.status === 'admitted');
    if (admitted) items.push({ key: 'admitted', label: 'Admitted', value: admitted.count, icon: 'cap', tone: 'good', href: '/admin/leads?status=admitted' });
  } else if (tasks) {
    items.push({ key: 'mine-today', label: 'My follow-ups today', value: tasks.today, icon: 'calendar', tone: 'warn', href: '/admin/my-day' });
  }
  if (catalogue) items.push({ key: 'held', label: 'Waiting to publish', value: catalogue.held, icon: 'checkCircle', tone: 'warn', href: '/admin/data/review' });
  if (catalogue && !leads) items.push({ key: 'unverified', label: 'Live, not yet verified', value: catalogue.visible, icon: 'eye', tone: 'info', href: '/admin/data/review?view=visible' });
  if (students) items.push({ key: 'students', label: 'New students this week', value: students.new7d, icon: 'people', tone: 'good', href: '/admin/students' });
  return items.slice(0, 4);
}

function OverviewHeader({ name, data, admin }) {
  const tasks = data?.tasks;
  const leads = data?.leads;
  const overdue = tasks?.overdue ?? leads?.overdue ?? 0;
  const dueToday = tasks?.today ?? leads?.dueToday ?? 0;
  const hot = leads?.hotWaiting ?? 0;
  const parts = [overdue && `${plural(overdue, 'follow-up')} ${overdue === 1 ? 'is' : 'are'} overdue`, hot && `${plural(hot, 'hot lead')} ${hot === 1 ? 'is' : 'are'} waiting for a first call`].filter(Boolean);
  const line = !data ? 'Loading your day…' : parts.length ? `${parts.join(' and ')}. Start with those.` : dueToday ? `${plural(dueToday, 'follow-up')} due today. Nothing overdue.` : 'Nothing is overdue. A good day to reach new leads.';
  return <section className={styles.overview}>
    <header className={styles.overviewHead}>
      <div>
        <h1>Admissions overview</h1>
        <p>{greeting()}, {name}. {line}</p>
      </div>
      <div className={styles.overviewActions}>
        <span className={styles.date}><Icon name="calendar" />{today.format(new Date())}</span>
        {can(admin, 'leads.notes') && <Link className="adm-btn" href="/admin/my-day">Start my day<Icon name="arrow" /></Link>}
        {can(admin, 'leads.create') && <Link className="adm-btn adm-btn--primary" href="/admin/leads?add=1"><Icon name="plus" />Add a lead</Link>}
      </div>
    </header>
    {(tasks || leads) && <dl className={styles.todayCounts} aria-label="Follow-up priorities">
      <div className="crm-tone" data-tone="bad"><dt>Overdue</dt><dd>{n(overdue)}</dd></div>
      <div className="crm-tone" data-tone="warn"><dt>Due today</dt><dd>{n(dueToday)}</dd></div>
      {leads && <div className="crm-tone" data-tone="wine"><dt>Hot, not called</dt><dd>{n(hot)}</dd></div>}
    </dl>}
  </section>;
}

function StatCards({ items, loading }) {
  return <ul className={styles.stats} aria-label="Today">
    {items.map((item) => <li key={item.key}>
      <Link href={item.href} className={cx('crm-tone', styles.stat)} data-tone={item.tone}>
        <span className={styles.statBadge}><Icon name={item.icon} /></span>
        <span className={styles.statText}>
          <strong className={cx(styles.statValue, 'crm-tabnum')}>{loading ? '…' : n(item.value)}</strong>
          <span className={styles.statLabel}>{item.label}</span>
        </span>
      </Link>
    </li>)}
  </ul>;
}


function Attention({ data }) {
  const [expanded, setExpanded] = useState(false);
  const rows = [];
  if (data.tasks?.overdue) rows.push({ key: 'tasks', href: '/admin/my-day', title: `${plural(data.tasks.overdue, 'follow-up')} of yours ${data.tasks.overdue === 1 ? 'is' : 'are'} overdue`, meta: 'Open My day to clear them', tone: 'bad', word: 'Overdue', initials: '!' });
  for (const item of data.attention ?? []) {
    const who = item.assignee ? displayName(item.assignee) : 'not assigned';
    rows.push(item.kind === 'overdue'
      ? { key: `o${item.id}`, href: `/admin/leads/${item.id}`, title: item.name || 'Unnamed lead', meta: `Due ${when(item.at)} · ${who}`, tone: 'bad', word: 'Overdue', initials: initialsOf(item.name) }
      : { key: `h${item.id}`, href: `/admin/leads/${item.id}`, title: item.name || 'Unnamed lead', meta: `Arrived ${when(item.at)} · ${who}`, tone: 'warn', word: 'Hot, not called', initials: initialsOf(item.name) });
  }
  if (data.catalogue?.held) rows.push({ key: 'held', href: '/admin/data/review', title: `${n(data.catalogue.held)} directory records waiting to publish`, meta: 'Imported or crawled, not yet reviewed', tone: 'info', word: 'Review', initials: n(data.catalogue.held) });
  const previewLength = 4;
  const visible = expanded ? rows : rows.slice(0, previewLength);
  return <Card title="Needs attention" className={styles.attention} action={data.leads?.overdue > 0 && <Link className={styles.cardLink} href="/admin/leads?followUp=overdue">All {n(data.leads.overdue)} overdue</Link>}>
    {!rows.length ? <p className={styles.empty}><Icon name="checkCircle" />Nothing needs attention right now.</p>
      : <ul className={styles.rows} id="attention-queue">{visible.map((row) => <li key={row.key}>
        <Link href={row.href} className={styles.row}>
          <span className={cx('crm-tone', styles.avatar)} data-tone={row.tone}>{row.initials}</span>
          <span className={styles.who}><strong>{row.title}</strong><small>{row.meta}</small></span>
          <span className={cx('crm-tone', styles.chip)} data-tone={row.tone}>{row.word}</span>
        </Link>
      </li>)}</ul>}
    {rows.length > previewLength && <div className={styles.attentionFoot}>
      <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" aria-controls="attention-queue" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
        {expanded ? 'Show fewer' : `Show ${n(rows.length - previewLength)} more`}<Icon name="chevron" />
      </button>
    </div>}
  </Card>;
}

function FollowUps({ tasks }) {
  return <Card title="My follow-ups" meta={`${n(tasks.overdue)} overdue · ${n(tasks.today)} today`} action={<Link className={styles.cardLink} href="/admin/my-day">My day</Link>}>
    {!tasks.items.length ? <p className={styles.empty}><Icon name="checkCircle" />No open follow-ups.</p>
      : <ul className={styles.rows}>{tasks.items.map((task) => <li key={task.id}>
        <Link className={styles.row} href={task.leadId ? `/admin/leads/${task.leadId}` : '/admin/my-day'}>
          <span className={styles.who}><strong>{task.leadName || task.title}</strong><small>{task.title}</small></span>
          <FollowUpBadge at={task.dueAt} compact />
        </Link>
      </li>)}</ul>}
  </Card>;
}

function Activity({ items, scope }) {
  return <Card title="Recent activity" meta={scope === 'all' ? 'Everyone' : scope === 'team' ? 'Your team' : 'You'}>
    {!items.length ? <p className={styles.empty}><Icon name="note" />No activity yet.</p>
      : <ul className={styles.rows}>{items.slice(0, 6).map((item) => <li key={item.id}>
        <Link className={styles.row} href={`/admin/leads/${item.leadId}`}>
          <span className={styles.activityIcon}><Icon name={ACTIVITY[item.kind]?.icon ?? 'note'} /></span>
          <span className={styles.who}><strong>{item.leadName || 'Unnamed lead'}</strong><small>{[`${ACTIVITY[item.kind]?.label ?? 'Note'}${item.outcome ? ` · ${OUTCOMES[item.outcome]?.label ?? item.outcome}` : ''}`, displayName(item.by) || 'Staff'].join(' · ')}</small></span>
          <span className={styles.time}>{relativeTime(item.at)}</span>
        </Link>
      </li>)}</ul>}
  </Card>;
}

function QuickActions({ admin }) {
  const items = QUICK.filter((item) => [].concat(item.permission).some((key) => can(admin, key)));
  if (!items.length) return null;
  return <Card title="Quick actions" className={styles.full}>
    <ul className={styles.quick}>{items.map((item) => <li key={item.href}>
      <Link className={cx('crm-tone', styles.quickTile)} data-tone={item.tone} href={item.href}><span><Icon name={item.icon} /></span>{item.label}</Link>
    </li>)}</ul>
  </Card>;
}

export default function Dashboard() {
  const { admin, request } = useAdminSession();
  useTick(60_000);
  const { data, error, loading, busy, refreshing, reload } = useServerList(request, '/home', {}, { scope: admin?.id ?? '' });
  const name = (admin?.name || displayName(admin?.email ?? '') || 'there').split(' ')[0];
  const items = data ? statItems(data) : [1, 2, 3, 4].map((key) => ({ key, label: '…', value: 0, icon: 'clock', tone: 'neutral', href: '#' }));
  const analytics = canAny(admin, ANALYTICS);
  const showAttention = Boolean(data?.attention || data?.catalogue);
  const showWeek = Boolean(data?.leads?.week?.length);
  return <div className={styles.page}>
    <OverviewHeader name={name} data={data} admin={admin} />
    {error && !data ? <ErrorBanner title="Your dashboard could not load." message={error} onRetry={reload} />
      : <>
        {items.length > 0 && <StatCards items={items} loading={loading || !data} />}
        {(showWeek || showAttention) && <div className={styles.priorityGrid} data-paired={showWeek && showAttention || undefined}>
          {showWeek && <Week days={data.leads.week} />}
          {showAttention && <Attention data={data} />}
        </div>}
        {data && <div className={styles.grid}>
          {data.tasks && <FollowUps tasks={data.tasks} />}
          {data.activity && <Activity items={data.activity} scope={data.leads?.scope} />}
          <QuickActions admin={admin} />
          <div className={styles.full}><DistributionCard /></div>
        </div>}
        {analytics ? <Insights /> : data?.leads?.byStage && <div className={styles.stageGrid}>
          <Pipeline stages={data.leads.byStage} />
          <Donut stages={data.leads.byStage} />
        </div>}
        {data?.generatedAt && <p className={styles.updated}><Icon name="clock" />{busy || refreshing ? 'Updating…' : `Updated ${relativeTime(data.generatedAt)}`}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={reload} disabled={busy || refreshing}><Icon name="refresh" />Refresh</button></p>}
      </>}
  </div>;
}
