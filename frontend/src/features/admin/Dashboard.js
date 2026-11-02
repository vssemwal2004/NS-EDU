'use client';
// The console home (/admin/dashboard): a greeting, today's numbers for this person, what needs attention,
// their follow-ups, recent activity and shortcuts. Analytics live under Analytics; this is the start of the day.
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useAdminSession } from './AdminSession';
import { displayName, relativeTime } from './crm/format';
import { ACTIVITY, can, OPEN_STAGES, OUTCOMES } from './crm/meta';
import { FollowUpBadge } from './crm/ui';
import { cx, Empty, ErrorBanner, n, PanelLink, PanelSkeletons, useTick } from './analytics/shared';
import styles from './analytics/Analytics.module.css';
import { useServerList } from './table/useServerList';
import { PageToolbar, Panel, StatStrip } from './ui/Page';

const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
const istHour = () => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
const greeting = () => { const hour = istHour(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };
const OPEN = OPEN_STAGES.join(',');
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const when = (value) => (value ? dateTime.format(new Date(value)) : '—');

// Two calm groups of plain links: things to create, and places to go.
const SHORTCUTS = [
  { group: 'Create', items: [
    { label: 'Add a lead', href: '/admin/leads?add=1', icon: 'plus', permission: 'leads.create' },
    { label: 'New school drive', href: '/admin/drives?add=1', icon: 'building', permission: 'drives.manage' },
    { label: 'Add a university', href: '/admin/institutions?new=1', icon: 'building', permission: 'catalogue.edit' },
    { label: 'Add staff', href: '/admin/access?tab=team&add=1', icon: 'userPlus', permission: 'team.manage' },
  ] },
  { group: 'Go to', items: [
    { label: 'My day', href: '/admin/my-day', icon: 'calendar', permission: 'leads.notes' },
    { label: 'Pipeline board', href: '/admin/leads/board', icon: 'board', permission: ['leads.view_own', 'leads.view_team', 'leads.view_all'] },
    { label: 'CRM performance', href: '/admin/crm', icon: 'chart', permission: ['analytics.view_own', 'analytics.view_team', 'analytics.view_all'] },
    { label: 'Lead volume', href: '/admin/leads/dashboard', icon: 'bars', permission: ['analytics.view_own', 'analytics.view_team', 'analytics.view_all'] },
    { label: 'Review queue', href: '/admin/data/review', icon: 'checkCircle', permission: 'data.manage' },
    { label: 'Search insights', href: '/admin/insights', icon: 'trend', permission: 'analytics.search' },
  ] },
];

function statItems(data) {
  const { leads, tasks, catalogue, students } = data;
  const own = leads?.scope === 'own';
  const items = [];
  if (tasks && own) {
    items.push(
      { key: 'mine-overdue', label: 'My overdue follow-ups', value: tasks.overdue, icon: tasks.overdue ? 'alert' : 'check', tone: tasks.overdue ? 'bad' : 'good', href: '/admin/my-day' },
      { key: 'mine-today', label: 'My follow-ups today', value: tasks.today, icon: 'calendar', tone: 'warn', href: '/admin/my-day' },
      { key: 'mine-upcoming', label: 'Coming up', value: tasks.upcoming, icon: 'clock', tone: 'neutral', href: '/admin/my-day' },
    );
  }
  if (leads) {
    items.push(
      { key: 'new', label: own ? 'New leads for me today' : 'New leads today', value: leads.newToday, icon: 'inbox', tone: 'neutral', href: '/admin/leads?range=today' },
      { key: 'hot', label: 'Hot, waiting for a call', value: leads.hotWaiting, icon: 'flame', tone: leads.hotWaiting ? 'bad' : 'neutral', href: '/admin/leads?heat=hot&status=new' },
    );
    if (!own) items.splice(1, 0, { key: 'open', label: 'Open leads', value: leads.open, icon: 'layers', tone: 'neutral', href: `/admin/leads?status=${OPEN}` });
    if (!own) items.push({ key: 'overdue', label: 'Overdue follow-ups', value: leads.overdue, icon: leads.overdue ? 'alert' : 'check', tone: leads.overdue ? 'bad' : 'good', href: '/admin/leads?followUp=overdue' });
    else items.push({ key: 'open', label: 'My open leads', value: leads.open, icon: 'layers', tone: 'neutral', href: `/admin/leads?status=${OPEN}` });
  }
  if (catalogue) items.push({ key: 'held', label: 'Waiting to publish', value: catalogue.held, icon: 'checkCircle', tone: catalogue.held ? 'warn' : 'good', href: '/admin/data/review' });
  if (catalogue && !leads) items.push({ key: 'unverified', label: 'Live, not yet verified', value: catalogue.visible, icon: 'eye', tone: 'neutral', href: '/admin/data/review?view=visible' });
  if (students) items.push({ key: 'students', label: 'New students this week', value: students.new7d, icon: 'people', tone: 'neutral', href: '/admin/students' });
  return items.slice(0, 6);
}

function Attention({ data }) {
  const rows = [];
  if (data.tasks?.overdue) rows.push({ key: 'tasks', href: '/admin/my-day', title: `${n(data.tasks.overdue)} of your follow-ups are overdue`, tone: 'bad', word: 'Overdue' });
  for (const item of data.attention ?? []) {
    const who = item.assignee ? displayName(item.assignee) : 'Not assigned';
    rows.push(item.kind === 'overdue'
      ? { key: `o${item.id}`, href: `/admin/leads/${item.id}`, title: item.name || 'Unnamed lead', meta: `Due ${when(item.at)} · ${who}`, tone: 'bad', word: 'Overdue' }
      : { key: `h${item.id}`, href: `/admin/leads/${item.id}`, title: item.name || 'Unnamed lead', meta: `Arrived ${when(item.at)} · ${who}`, tone: 'bad', word: 'Hot, not called' });
  }
  if (data.catalogue?.held) rows.push({ key: 'held', href: '/admin/data/review', title: `${n(data.catalogue.held)} directory records waiting to publish`, tone: 'info', word: 'Review' });
  const links = [data.leads?.overdue > 0 && { href: '/admin/leads?followUp=overdue', label: `All ${n(data.leads.overdue)} overdue` }, data.leads?.hotWaiting > 0 && { href: '/admin/leads?heat=hot&status=new', label: `All ${n(data.leads.hotWaiting)} hot` }].filter(Boolean);
  return <Panel title="Needs attention" description="Oldest overdue follow-ups, the newest hot leads nobody has called, and directory records waiting for review."
    actions={links.length > 0 && links.map((link) => <PanelLink key={link.href} href={link.href}>{link.label}</PanelLink>)}>
    {!rows.length ? <Empty title="Nothing needs attention" />
      : <ul className={styles.list}>{rows.map((row) => <li key={row.key}>
        <Link className={styles.item} href={row.href} data-single={row.meta ? undefined : ''}>
          <strong>{row.title}</strong>
          {row.meta && <small>{row.meta}</small>}
          <span className={cx('crm-tone', styles.status)} data-tone={row.tone}>{row.word}</span>
        </Link>
      </li>)}</ul>}
  </Panel>;
}

function FollowUps({ tasks }) {
  return <Panel title="My follow-ups" meta={`${n(tasks.overdue)} overdue · ${n(tasks.today)} today · ${n(tasks.upcoming)} later`} actions={<PanelLink href="/admin/my-day" label="open all follow-ups">My day</PanelLink>}>
    {!tasks.items.length ? <Empty title="No open follow-ups" />
      : <ul className={styles.list}>{tasks.items.map((task) => <li key={task.id}>
        <Link className={styles.item} href={task.leadId ? `/admin/leads/${task.leadId}` : '/admin/my-day'}>
          <strong>{task.leadName || task.title}</strong>
          <small>{task.title}</small>
          <FollowUpBadge at={task.dueAt} compact />
        </Link>
      </li>)}</ul>}
  </Panel>;
}

function Activity({ items, scope }) {
  return <Panel title="Recent activity" description={scope === 'all' ? 'Latest calls, messages and notes by anyone.' : scope === 'team' ? 'Latest calls, messages and notes by your team.' : 'Your latest calls, messages and notes.'}>
    {!items.length ? <Empty title="No activity yet" />
      : <ul className={styles.list}>{items.map((item) => <li key={item.id}>
        <Link className={styles.item} href={`/admin/leads/${item.leadId}`}>
          <strong>{item.leadName || 'Unnamed lead'}</strong>
          <small>{[`${ACTIVITY[item.kind]?.label ?? 'Note'}${item.outcome ? ` · ${OUTCOMES[item.outcome]?.label ?? item.outcome}` : ''}`, displayName(item.by) || 'Staff'].join(' · ')}</small>
          <span className={styles.itemTime}>{relativeTime(item.at)}</span>
        </Link>
      </li>)}</ul>}
  </Panel>;
}

function Shortcuts({ admin }) {
  const allowed = (item) => [].concat(item.permission).some((key) => can(admin, key));
  const groups = SHORTCUTS.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter((group) => group.items.length);
  if (!groups.length) return null;
  return <Panel className={styles.wide} title="Shortcuts">
    <nav className={styles.shortcutGroups} aria-label="Shortcuts">
      {groups.map((group) => <div key={group.group} className={styles.shortcutGroup}>
        <h3>{group.group}</h3>
        <ul className={styles.shortcuts}>{group.items.map((item) => <li key={item.href}>
          <Link className={styles.shortcut} href={item.href}><Icon name={item.icon} /><span>{item.label}</span></Link>
        </li>)}</ul>
      </div>)}
    </nav>
  </Panel>;
}

export default function Dashboard() {
  const { admin, request } = useAdminSession();
  useTick(60_000);
  const { data, error, loading, busy, refreshing, reload } = useServerList(request, '/home', {}, { scope: admin?.id ?? '' });
  const name = admin?.name || displayName(admin?.email ?? '') || 'there';
  const summary = <><strong>{greeting()}, {name.split(' ')[0]}.</strong> {today.format(new Date())}</>;
  return <div className={styles.page}>
    <PageToolbar summary={summary}>
      {data?.generatedAt && <span className={styles.updated}><Icon name="clock" />{busy || refreshing ? 'Updating…' : `Updated ${relativeTime(data.generatedAt)}`}</span>}
      <button type="button" className={cx('adm-btn', (busy || refreshing) && styles.spin)} onClick={reload} disabled={busy || refreshing}><Icon name="refresh" />Refresh</button>
      {can(admin, 'leads.create') && <Link className="adm-btn adm-btn--primary" href="/admin/leads?add=1"><Icon name="plus" />Add lead</Link>}
    </PageToolbar>
    {error && !data ? <ErrorBanner title="Your dashboard could not load." message={error} onRetry={reload} />
      : loading || !data ? <><StatStrip loading items={[1, 2, 3, 4, 5].map((key) => ({ key, label: '…', value: 0 }))} /><PanelSkeletons spans={['', '', '', 'wide']} /></>
        : <>
          {statItems(data).length > 0 && <StatStrip label="Today" items={statItems(data)} />}
          <div className={styles.grid}>
            {(data.attention || data.catalogue) && <Attention data={data} />}
            {data.tasks && <FollowUps tasks={data.tasks} />}
            {data.activity && <Activity items={data.activity} scope={data.leads?.scope} />}
            <Shortcuts admin={admin} />
          </div>
        </>}
  </div>;
}
