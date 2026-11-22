'use client';
// Admin console chrome ("Jewel" theme). The sidebar and the top bar are one oxblood frame; the page sits on an ivory
// sheet inside it with a curved top-left corner.
//  - Sidebar: an icon rail by default that slides open over the page on hover (0.8 s) and slides back when the
//    pointer leaves, so the page never shrinks. The pin at its top keeps it open; then the page slides right to make
//    room. The choice is remembered per browser (useDisplayPrefs `nav`: 'collapsed' = rail, 'expanded' = pinned).
//  - Top bar: breadcrumb, Ctrl+K search, quick-create, the follow-ups panel and the account menu.
//  - Page header: eyebrow (group), serif title, description and the section's tabs.
//  - Phones: the sidebar becomes a drawer and a bottom bar carries the five most used places.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { adminPages, canOpen, findAdminPage, homeFor, navigationFor } from '@/data/admin-navigation';
import { AdminSessionProvider, useAdminSession } from './AdminSession';
import CommandPalette from './CommandPalette';
import RowMenu from './crm/RowMenu';
import { ToastProvider } from './crm/toast';
import { relativeTime } from './crm/format';
import { useDisplayPrefs } from './crm/useDisplayPrefs';
import styles from './AdminShell.module.css';

const initials = (text) => (text || 'A').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
const holds = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));
const TEXT_SIZES = [['default', 'Default'], ['large', 'Large'], ['xlarge', 'Largest']];
const FOLLOW_UP_REFRESH = 120_000;

/** Overdue and due-today follow-up counts for the bell, the sidebar and the My day badge (every 2 minutes and on focus). */
function useFollowUps(admin, request) {
  const [counts, setCounts] = useState(null);
  const allowed = holds(admin, 'leads.notes');
  useEffect(() => {
    if (!allowed) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    let pending = false;
    const load = () => {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      request('/crm/tasks/counts', { signal })
        .then((data) => { if (!signal.aborted) setCounts(data.counts); })
        .catch(() => {})
        .finally(() => { pending = false; });
    };
    load();
    const timer = window.setInterval(load, FOLLOW_UP_REFRESH);
    window.addEventListener('focus', load);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [allowed, request]);
  return counts;
}

/** Closes a popover on an outside pointer press or Escape (focus returns to the trigger). */
function usePopover(open, setOpen, box) {
  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => { if (!box.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open, setOpen, box]);
}

function Sidebar({ admin, pinned, open, onPin, onNavigate, followUps }) {
  const pathname = usePathname();
  const groups = navigationFor(admin);
  const activeSection = findAdminPage(pathname)?.section?.label;
  const due = followUps ? followUps.overdue + followUps.today : 0;
  return <aside className={styles.sidebar} data-open={open} data-pinned={pinned} aria-label="Admin navigation">
    <div className={styles.brand}>
      <Link href={homeFor(admin)} className={styles.brandLink} aria-label="Gyaan Vidhya admin home" onClick={onNavigate}>
        <Brand variant="lockup" tone="light" className={styles.lockup} />
        <Brand variant="mark" tone="light" className={styles.mark} alt="" />
      </Link>
      <button type="button" className={styles.pin} onClick={onPin} aria-pressed={pinned}
        title={pinned ? 'Unpin: slide back to the icon rail' : 'Pin the sidebar open'} aria-label={pinned ? 'Unpin the sidebar' : 'Pin the sidebar open'}>
        <Icon name="admPin" />
      </button>
    </div>
    <nav className={styles.nav}>
      {groups.map((group) => <div key={group.label} className={styles.group}>
        <p className={styles.groupLabel}><span>{group.label}</span></p>
        <ul>{group.items.map((item) => {
          const active = item.label === activeSection;
          const badge = item.badge === 'followUps' && followUps ? followUps.overdue : 0;
          return <li key={item.label}>
            <Link href={item.href} className={styles.item} aria-current={active ? 'page' : undefined} onClick={onNavigate} title={item.label}>
              <Icon name={item.icon} />
              <span className={styles.itemLabel}>{item.label}</span>
              {badge > 0 && <span className={styles.itemBadge} aria-label={`${badge} overdue follow-ups`}>{badge > 99 ? '99+' : badge}</span>}
            </Link>
          </li>;
        })}</ul>
      </div>)}
      {/* Inside the scroll area, after the last group, so it can never cover a menu item. */}
      {followUps && <Link href="/admin/my-day" className={styles.today} onClick={onNavigate}>
        <span className="adm-eyebrow">Today</span>
        <strong>{due ? `${due} follow-up${due === 1 ? '' : 's'} to do` : 'No follow-ups due'}</strong>
        <span className={styles.todayRow}>
          <span data-tone="bad">{followUps.overdue} overdue</span>
          <span data-tone="warn">{followUps.today} today</span>
        </span>
      </Link>}
    </nav>
  </aside>;
}

/** The bell: overdue and due-today follow-ups in a panel, newest problems first. */
function FollowUpsPanel({ admin, request, followUps }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('overdue');
  const [lists, setLists] = useState({});
  const box = useRef(null);
  usePopover(open, setOpen, box);
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    Promise.all(['overdue', 'today'].map((state) => request(`/crm/tasks?state=${state}&limit=6`, { signal: controller.signal }).then((data) => [state, data.items ?? []])))
      .then((entries) => setLists(Object.fromEntries(entries))).catch(() => {});
    return () => controller.abort();
  }, [open, request]);
  if (!holds(admin, 'leads.notes')) return null;
  const due = followUps ? followUps.overdue + followUps.today : 0;
  const items = lists[tab];
  return <div className={styles.popover} ref={box}>
    <button type="button" className={styles.iconButton} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}
      aria-label={followUps ? `Follow-ups: ${followUps.overdue} overdue, ${followUps.today} due today` : 'Follow-ups'}>
      <Icon name="bell" />{due > 0 && <span className={styles.bellDot} data-overdue={followUps.overdue > 0}>{due > 99 ? '99+' : due}</span>}
    </button>
    {open && <div className={`${styles.panel} ${styles.followPanel}`} role="dialog" aria-label="Follow-ups">
      <header className={styles.panelHead}>
        <h2>Follow-ups</h2>
        <div className={styles.segment} role="tablist" aria-label="Which follow-ups">
          {[['overdue', 'Overdue', followUps?.overdue], ['today', 'Today', followUps?.today]].map(([key, label, count]) =>
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}{count ? ` ${count}` : ''}</button>)}
        </div>
      </header>
      {!items ? <p className={styles.panelNote}>Loading…</p>
        : !items.length ? <p className={styles.panelNote}>{tab === 'overdue' ? 'Nothing overdue. Well done.' : 'Nothing else due today.'}</p>
          : <ul className={styles.followList}>{items.map((task) => <li key={task.id}>
            <Link href={task.leadId ? `/admin/leads/${task.leadId}` : '/admin/my-day'} onClick={() => setOpen(false)}>
              <span className={styles.followAvatar} data-tone={tab === 'overdue' ? 'bad' : 'warn'}>{initials(task.leadName || task.title)}</span>
              <span className={styles.followText}><strong>{task.leadName || task.title}</strong><small>{task.title}</small></span>
              <span className={styles.followWhen} data-tone={tab === 'overdue' ? 'bad' : 'warn'}>{relativeTime(task.dueAt)}</span>
            </Link>
          </li>)}</ul>}
      <Link href="/admin/my-day" className={styles.panelFoot} onClick={() => setOpen(false)}>Open My day<Icon name="arrow" /></Link>
    </div>}
  </div>;
}

/** Account menu: who you are, display settings and the account links. */
function AccountMenu({ admin, prefs, update, logout }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  usePopover(open, setOpen, box);
  const showSite = admin.isOwner || holds(admin, 'content.edit');
  const who = initials(admin.name || admin.email);
  return <div className={styles.popover} ref={box}>
    <button type="button" className={styles.accountButton} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} title="Account and display">
      <span className={styles.avatar}>{who}</span>
      <span className={styles.accountName}><strong>{admin.name || admin.email}</strong><small>{admin.isOwner ? 'Owner' : 'Employee'}</small></span>
    </button>
    {open && <div className={`${styles.panel} ${styles.accountPanel}`} role="dialog" aria-label="Account and display">
      <div className={styles.accountHead}>
        <span className={`${styles.avatar} ${styles.avatarLarge}`}>{who}</span>
        <span><strong>{admin.name || (admin.isOwner ? 'Admin' : 'Employee')}</strong><small>{admin.email}</small></span>
      </div>
      <fieldset className={styles.setting}>
        <legend>Text size</legend>
        <div className={styles.segment}>
          {TEXT_SIZES.map(([value, label]) => <button key={value} type="button" aria-pressed={prefs.text === value} onClick={() => update({ text: value })}>{label}</button>)}
        </div>
      </fieldset>
      <fieldset className={styles.setting}>
        <legend>Row spacing</legend>
        <div className={styles.segment}>
          {[['comfortable', 'Comfortable'], ['compact', 'Compact']].map(([value, label]) => <button key={value} type="button" aria-pressed={prefs.density === value} onClick={() => update({ density: value })}>{label}</button>)}
        </div>
      </fieldset>
      <div className={styles.accountLinks}>
        <Link href="/admin/profile" onClick={() => setOpen(false)}><Icon name="user" />My profile</Link>
        <Link href="/admin/change-password" onClick={() => setOpen(false)}><Icon name="lock" />Change password</Link>
        {showSite && <a href="/" target="_blank" rel="noopener noreferrer"><Icon name="external" />View the public site</a>}
        <button type="button" onClick={logout}><Icon name="logout" />Log out</button>
      </div>
    </div>}
  </div>;
}

function Topbar({ admin, request, page, exact, prefs, update, onMenu, onSearch, followUps, logout }) {
  const createItems = [
    { key: 'lead', label: 'Lead', icon: 'eligibility', href: '/admin/leads?add=1', hidden: !holds(admin, 'leads.create') },
    { key: 'drive', label: 'School drive', icon: 'building', href: '/admin/drives?add=1', hidden: !holds(admin, 'drives.manage') },
    { key: 'student', label: 'Reference student', icon: 'userPlus', href: '/admin/reference-students/new', hidden: !holds(admin, 'students.create') },
    { key: 'university', label: 'University', icon: 'building', href: '/admin/institutions?new=1', hidden: !holds(admin, 'catalogue.edit') },
    { key: 'staff', label: 'Employee', icon: 'people', href: '/admin/access?tab=team&add=1', hidden: !holds(admin, 'team.manage') },
  ];
  const canCreate = createItems.some((item) => !item.hidden);
  return <header className={styles.topbar}>
    <button type="button" className={`${styles.iconButton} ${styles.menuButton}`} aria-label="Open navigation" onClick={onMenu}><Icon name="menu" /></button>
    <nav className={styles.crumb} aria-label="Breadcrumb">
      {/* "Students › Students › …": the group is skipped when it has the section's own name. */}
      {page?.group !== page?.section?.label && <span>{page?.group || 'Admin'}</span>}
      {page && (exact && page.label === page.section.label
        ? <>{page.group !== page.section.label && <Icon name="chevron" />}<span aria-current="page">{page.label}</span></>
        : <>{page.group !== page.section.label && <Icon name="chevron" />}<Link href={page.section.href}>{page.section.label}</Link></>)}
      {page && page.label !== page.section.label && <><Icon name="chevron" />{exact ? <span aria-current="page">{page.label}</span> : <Link href={page.href}>{page.label}</Link>}</>}
      {page && !exact && <><Icon name="chevron" /><span aria-current="page">Details</span></>}
    </nav>
    <button type="button" className={styles.search} onClick={onSearch} aria-keyshortcuts="Control+K">
      <Icon name="search" /><span>Search leads, universities, pages</span><kbd>Ctrl K</kbd>
    </button>
    <div className={styles.actions}>
      {canCreate && <RowMenu label="Create new" align="end" className={styles.createButton} trigger={<><Icon name="plus" /><span>New</span></>} items={[{ heading: 'Create' }, ...createItems]} />}
      <FollowUpsPanel admin={admin} request={request} followUps={followUps} />
      <AccountMenu admin={admin} prefs={prefs} update={update} logout={logout} />
    </div>
  </header>;
}

/** Eyebrow, serif title, description and the section's tabs. Shown on a section's own screens, not on detail pages. */
function PageHeader({ admin, page }) {
  const tabs = page.section.tabs?.filter((tab) => canOpen(admin, tab)) ?? [];
  return <div className={styles.pageHeader}>
    <div className={styles.pageHeading}>
      <p className="adm-eyebrow">{page.group}</p>
      <h1>{page.section.label}</h1>
      <p>{page.description}</p>
    </div>
    {tabs.length > 1 && <nav className={styles.tabs} aria-label={`${page.section.label} sections`}>
      {tabs.map((tab) => <Link key={tab.href} href={tab.href} className={styles.tab} aria-current={tab.href === page.href ? 'page' : undefined}>
        <Icon name={tab.icon} /><span>{tab.label}</span>
      </Link>)}
    </nav>}
  </div>;
}

/** Phones: the places a counsellor opens all day, plus search and the full menu. */
function BottomNav({ admin, pathname, onSearch, onMenu }) {
  const places = [['/admin/dashboard', 'Home', 'dashboard'], ['/admin/my-day', 'My day', 'calendar'], ['/admin/leads', 'Leads', 'eligibility']]
    .filter(([href]) => canOpen(admin, adminPages.find((page) => page.href === href)));
  return <nav className={styles.bottomNav} aria-label="Quick navigation">
    {places.map(([href, label, icon]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></Link>)}
    <button type="button" onClick={onSearch}><Icon name="search" /><span>Search</span></button>
    <button type="button" onClick={onMenu}><Icon name="admGrid" /><span>More</span></button>
  </nav>;
}

function Workspace({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, status, request, logout } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [prefs, updatePrefs] = useDisplayPrefs();
  const followUps = useFollowUps(admin, request);
  const page = findAdminPage(pathname);
  const exact = Boolean(page) && page.href === pathname;
  // A role that may not open this page is sent to its own home instead of seeing a wall of 403s.
  const blocked = Boolean(admin) && Boolean(page) && !canOpen(admin, page);
  useEffect(() => { if (blocked) router.replace(homeFor(admin)); }, [blocked, admin, router]);
  useEffect(() => {
    const onKey = (event) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
      if ((event.key === 'k' && (event.ctrlKey || event.metaKey)) || (event.key === '/' && !typing)) { event.preventDefault(); setSearching(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'loading') return <div className={styles.splash} role="status"><Brand variant="lockup" tone="light" className={styles.splashLogo} /><span className={styles.splashBar} /><p>Opening the admin console…</p></div>;
  if (status === 'unavailable') return <div className={styles.splash} role="alert"><Brand variant="lockup" tone="light" className={styles.splashLogo} /><p>The Gyaan Vidhya API is not reachable. Start the backend and reload this page.</p><button type="button" className="adm-btn adm-btn--gold" onClick={() => window.location.reload()}>Reload</button></div>;
  if (!admin) return null;
  if (blocked) return <div className={styles.splash} role="status"><p>Opening your workspace…</p></div>;
  const pinned = prefs.nav === 'expanded';
  return <div className={styles.shell} data-crm-text={prefs.text} data-density={prefs.density} data-nav={pinned ? 'pinned' : 'rail'}>
    <a className={styles.skip} href="#main">Skip to content</a>
    <Sidebar admin={admin} pinned={pinned} open={open} followUps={followUps} onNavigate={() => setOpen(false)} onPin={() => updatePrefs({ nav: pinned ? 'collapsed' : 'expanded' })} />
    <button type="button" className={styles.scrim} data-open={open} aria-label="Close navigation" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <div className={styles.workspace}>
      <Topbar admin={admin} request={request} page={page} exact={exact} prefs={prefs} update={updatePrefs} followUps={followUps} logout={logout}
        onMenu={() => setOpen(true)} onSearch={() => setSearching(true)} />
      <main id="main" className={styles.content} tabIndex={-1}>
        {exact && !page.section.hero && <PageHeader admin={admin} page={page} />}
        {children}
      </main>
    </div>
    <BottomNav admin={admin} pathname={pathname} onSearch={() => setSearching(true)} onMenu={() => setOpen(true)} />
    {searching && <CommandPalette admin={admin} request={request} onClose={() => setSearching(false)} />}
  </div>;
}

export default function AdminShell({ children }) {
  return <AdminSessionProvider><ToastProvider><Workspace>{children}</Workspace></ToastProvider></AdminSessionProvider>;
}
