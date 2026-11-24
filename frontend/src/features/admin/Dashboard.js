'use client';
// The console home (/admin/dashboard): an oxblood greeting with today's follow-up numbers, jewel-coloured stat cards,
// the lead distribution card,
// the pipeline by stage (bar + donut), new leads over the last 7 days, what needs attention, the person's follow-ups,
// recent activity and quick actions. Colours follow the Jewel palette (see crm/crm-tokens.css): each stage keeps
// its colour everywhere. Analytics live under Analytics; this is the start of the day.
import Link from 'next/link';
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

const ANALYTICS = ['analytics.view_own', 'analytics.view_team', 'analytics.view_all'];
import styles from './Dashboard.module.css';

const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });
const istHour = () => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
const greeting = () => { const hour = istHour(); return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'; };
const OPEN = OPEN_STAGES.join(',');
const dateTime = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const when = (value) => (value ? dateTime.format(new Date(value)) : '—');
const plural = (count, word) => `${n(count)} ${word}${count === 1 ? '' : 's'}`;

const QUICK = [
  { label: 'Add a lead', href: '/admin/leads?add=1', icon: 'plus', permission: 'leads.create', tone: 'bad' },
  { label: 'School drive', href: '/admin/drives?add=1', icon: 'building', permission: 'drives.manage', tone: 'info' },
  { label: 'Add students', href: '/admin/reference-students/new', icon: 'userPlus', permission: 'students.create', tone: 'purple' },
  { label: 'Add a university', href: '/admin/institutions?new=1', icon: 'book', permission: 'catalogue.edit', tone: 'warn' },
  { label: 'Review queue', href: '/admin/data/review', icon: 'checkCircle', permission: 'data.manage', tone: 'good' },
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

function Hero({ name, data, admin }) {
  const tasks = data?.tasks;
  const leads = data?.leads;
  const overdue = tasks?.overdue ?? leads?.overdue ?? 0;
  const dueToday = tasks?.today ?? leads?.dueToday ?? 0;
  const hot = leads?.hotWaiting ?? 0;
  const parts = [overdue && `${plural(overdue, 'follow-up')} ${overdue === 1 ? 'is' : 'are'} overdue`, hot && `${plural(hot, 'hot lead')} ${hot === 1 ? 'is' : 'are'} waiting for a first call`].filter(Boolean);
  const line = !data ? 'Loading your day…' : parts.length ? `${parts.join(' and ')}. Start with those.` : dueToday ? `${plural(dueToday, 'follow-up')} due today. Nothing overdue.` : 'Nothing is overdue. A good day to reach new leads.';
  return <section className={styles.hero}>
    <svg className={styles.arches} viewBox="0 0 420 230" aria-hidden="true">
      <g opacity=".55"><path d="M10 230V120Q10 60 70 40Q130 60 130 120V230" /><path d="M150 230V100Q150 34 210 12Q270 34 270 100V230" /><path d="M290 230V120Q290 60 350 40Q410 60 410 120V230" /></g>
      <g opacity=".3"><path d="M30 230V128Q30 78 70 62Q110 78 110 128V230" /><path d="M172 230V108Q172 54 210 36Q248 54 248 108V230" /><path d="M310 230V128Q310 78 350 62Q390 78 390 128V230" /></g>
    </svg>
    <div className={styles.heroCopy}>
      <p className="adm-eyebrow">{today.format(new Date())}</p>
      <h1>{greeting()}, {name}.</h1>
      <p>{line}</p>
      <div className={styles.heroActions}>
        {can(admin, 'leads.notes') && <Link className="adm-btn adm-btn--gold" href="/admin/my-day">Start my day<Icon name="arrow" /></Link>}
        {can(admin, 'leads.create') && <Link className={styles.ghost} href="/admin/leads?add=1"><Icon name="plus" />Add a lead</Link>}
      </div>
    </div>
    {(tasks || leads) && <dl className={styles.heroStats}>
      <div><dt><i data-tone="bad" />Overdue</dt><dd>{n(overdue)}</dd></div>
      <div><dt><i data-tone="warn" />Due today</dt><dd>{n(dueToday)}</dd></div>
      {leads && <div><dt><i />Hot, not called</dt><dd>{n(hot)}</dd></div>}
    </dl>}
  </section>;
}

function StatCards({ items, loading }) {
  return <ul className={styles.stats} aria-label="Today">
    {items.map((item) => <li key={item.key}>
      <Link href={item.href} className={cx('crm-tone', styles.stat)} data-tone={item.tone}>
        <Icon name={item.icon} className={styles.glyph} />
        <span className={styles.statBadge}><Icon name={item.icon} /></span>
        <span className={styles.statLabel}>{item.label}</span>
        <strong className={cx(styles.statValue, 'crm-tabnum')}>{loading ? '…' : n(item.value)}</strong>
      </Link>
    </li>)}
  </ul>;
}


function Attention({ data }) {
  const rows = [];
  if (data.tasks?.overdue) rows.push({ key: 'tasks', href: '/admin/my-day', title: `${plural(data.tasks.overdue, 'follow-up')} of yours ${data.tasks.overdue === 1 ? 'is' : 'are'} overdue`, meta: 'Open My day to clear them', tone: 'bad', word: 'Overdue', initials: '!' });
  for (const item of data.attention ?? []) {
    const who = item.assignee ? displayName(item.assignee) : 'not assigned';
    rows.push(item.kind === 'overdue'
      ? { key: `o${item.id}`, href: `/admin/leads/${item.id}`, title: item.name || 'Unnamed lead', meta: `Due ${when(item.at)} · ${who}`, tone: 'bad', word: 'Overdue', initials: initialsOf(item.name) }
      : { key: `h${item.id}`, href: `/admin/leads/${item.id}`, title: item.name || 'Unnamed lead', meta: `Arrived ${when(item.at)} · ${who}`, tone: 'warn', word: 'Hot, not called', initials: initialsOf(item.name) });
  }
  if (data.catalogue?.held) rows.push({ key: 'held', href: '/admin/data/review', title: `${n(data.catalogue.held)} directory records waiting to publish`, meta: 'Imported or crawled, not yet reviewed', tone: 'info', word: 'Review', initials: n(data.catalogue.held) });
  return <Card title="Needs attention" action={data.leads?.overdue > 0 && <Link className={styles.cardLink} href="/admin/leads?followUp=overdue">All {n(data.leads.overdue)} overdue</Link>}>
    {!rows.length ? <p className={styles.empty}><Icon name="checkCircle" />Nothing needs attention right now.</p>
      : <ul className={styles.rows}>{rows.map((row) => <li key={row.key}>
        <Link href={row.href} className={styles.row}>
          <span className={cx('crm-tone', styles.avatar)} data-tone={row.tone}>{row.initials}</span>
          <span className={styles.who}><strong>{row.title}</strong><small>{row.meta}</small></span>
          <span className={cx('crm-tone', styles.chip)} data-tone={row.tone}>{row.word}</span>
        </Link>
      </li>)}</ul>}
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
  return <Card title="Quick actions">
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
  return <div className={styles.page}>
    <Hero name={name} data={data} admin={admin} />
    {error && !data ? <ErrorBanner title="Your dashboard could not load." message={error} onRetry={reload} />
      : <>
        {items.length > 0 && <StatCards items={items} loading={loading || !data} />}
        {/* People with analytics get the filtered Insights block (16 sections); others the simple stage overview. */}
        {canAny(admin, ANALYTICS) ? <Insights /> : data?.leads?.byStage && <div className={styles.grid}>
          <Pipeline stages={data.leads.byStage} />
          <Donut stages={data.leads.byStage} />
          {data.leads.week && <Week days={data.leads.week} />}
        </div>}
        {data && <div className={styles.grid}>
          {(data.attention || data.catalogue) && <Attention data={data} />}
          {data.tasks && <FollowUps tasks={data.tasks} />}
          {data.activity && <Activity items={data.activity} scope={data.leads?.scope} />}
          <QuickActions admin={admin} />
          <div className={styles.full}><DistributionCard /></div>
        </div>}
        {data?.generatedAt && <p className={styles.updated}><Icon name="clock" />{busy || refreshing ? 'Updating…' : `Updated ${relativeTime(data.generatedAt)}`}
          <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={reload} disabled={busy || refreshing}><Icon name="refresh" />Refresh</button></p>}
      </>}
  </div>;
}
