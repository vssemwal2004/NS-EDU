'use client';
// Admin console chrome: a fixed sidebar (collapsible to an icon rail, remembered per browser), a top bar
// with breadcrumb, Ctrl+K search, quick-create, the follow-up bell and the account menu, and a page
// header that shows the section title, its description and the section's tabs.
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { canOpen, findAdminPage, homeFor, navigationFor } from '@/data/admin-navigation';
import { AdminSessionProvider, useAdminSession } from './AdminSession';
import CommandPalette from './CommandPalette';
import RowMenu from './crm/RowMenu';
import { ToastProvider } from './crm/toast';
import { RoleBadge } from './crm/ui';
import { useDisplayPrefs } from './crm/useDisplayPrefs';
import styles from './AdminShell.module.css';

const initials = (admin) => (admin?.name || admin?.email || 'A').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
const holds = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));
const TEXT_SIZES = [['default', 'Default'], ['large', 'Large'], ['xlarge', 'Largest']];
const FOLLOW_UP_REFRESH = 120_000;

/** Overdue and due-today follow-ups for the bell and the My day badge (re-checked every 2 minutes and on focus). */
function useFollowUps(admin, request) {
  const [counts, setCounts] = useState(null);
  const allowed = holds(admin, 'leads.notes');
  const load = useCallback(() => {
    if (!allowed || document.visibilityState === 'hidden') return;
    request('/crm/tasks?state=overdue&limit=25').then((data) => setCounts(data.counts)).catch(() => {});
  }, [allowed, request]);
  useEffect(() => {
    if (!allowed) return undefined;
    load();
    const timer = window.setInterval(load, FOLLOW_UP_REFRESH);
    window.addEventListener('focus', load);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [allowed, load]);
  return counts;
}

function Sidebar({ admin, collapsed, open, onToggle, onNavigate, followUps }) {
  const pathname = usePathname();
  const groups = navigationFor(admin);
  const activeSection = findAdminPage(pathname)?.section?.label;
  return <aside className={styles.sidebar} data-open={open} data-collapsed={collapsed} aria-label="Admin navigation">
    <div className={styles.brand}>
      <span className={styles.brandMark}><Brand variant="mark" tone="light" /></span>
      <span className={styles.brandText}><strong>Gyaan Vidhya</strong><small>Admin console</small></span>
    </div>
    <nav className={styles.nav}>
      {groups.map((group) => <div key={group.label} className={styles.group}>
        <p className={styles.groupLabel}>{group.label}</p>
        <ul>{group.items.map((item) => {
          const active = item.label === activeSection;
          const badge = item.badge === 'followUps' && followUps ? followUps.overdue : 0;
          return <li key={item.label}>
            <Link href={item.href} className={styles.item} aria-current={active ? 'page' : undefined} onClick={onNavigate} data-tip={item.label}>
              <span className={styles.itemIcon}><Icon name={item.icon} /></span>
              <span className={styles.itemLabel}>{item.label}</span>
              {badge > 0 && <span className={styles.itemBadge} aria-label={`${badge} overdue follow-ups`}>{badge > 99 ? '99+' : badge}</span>}
            </Link>
          </li>;
        })}</ul>
      </div>)}
    </nav>
    <button type="button" className={styles.collapse} onClick={onToggle} aria-pressed={collapsed} data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
      <span className={styles.itemIcon}><Icon name="chevron" /></span><span className={styles.itemLabel}>Collapse sidebar</span>
    </button>
  </aside>;
}

/** Account menu: who you are, display settings, and the account links. */
function AccountMenu({ admin, prefs, update, logout }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (event) => { if (!box.current?.contains(event.target)) setOpen(false); };
    const key = (event) => { if (event.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key); };
  }, [open]);
  const showSite = admin.isOwner || holds(admin, 'content.edit');
  return <div className={styles.account} ref={box}>
    <button type="button" className={styles.accountButton} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)} title="Account and display">
      <span className={styles.avatar}>{initials(admin)}</span>
      <span className={styles.accountName}><strong>{admin.name || admin.email}</strong><small>{admin.roleName}</small></span>
      <Icon name="chevron" />
    </button>
    {open && <div className={styles.accountPanel} role="dialog" aria-label="Account and display">
      <div className={styles.accountHead}>
        <span className={`${styles.avatar} ${styles.avatarLarge}`}>{initials(admin)}</span>
        <span><strong>{admin.name || 'Admin'}</strong><small>{admin.email}</small><RoleBadge name={admin.roleName} color={admin.roleColor} size="sm" /></span>
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
        {holds(admin, 'team.view') && <Link href="/admin/access?tab=you" onClick={() => setOpen(false)}><Icon name="shield" />What I can do</Link>}
        <Link href="/admin/change-password" onClick={() => setOpen(false)}><Icon name="lock" />Change password</Link>
        {showSite && <a href="/" target="_blank" rel="noopener noreferrer"><Icon name="external" />View the public site</a>}
        <button type="button" onClick={logout}><Icon name="logout" />Log out</button>
      </div>
    </div>}
  </div>;
}

function Topbar({ admin, page, exact, prefs, update, onMenu, onSearch, followUps, logout }) {
  const createItems = [
    { key: 'lead', label: 'Lead', icon: 'eligibility', href: '/admin/leads?add=1', hidden: !holds(admin, 'leads.create') },
    { key: 'drive', label: 'School drive', icon: 'building', href: '/admin/drives?add=1', hidden: !holds(admin, 'drives.manage') },
    { key: 'student', label: 'Reference student', icon: 'userPlus', href: '/admin/reference-students/new', hidden: !holds(admin, 'students.create') },
    { key: 'university', label: 'University', icon: 'building', href: '/admin/institutions?new=1', hidden: !holds(admin, 'catalogue.edit') },
    { key: 'staff', label: 'Staff member', icon: 'people', href: '/admin/access?tab=team&add=1', hidden: !holds(admin, 'team.manage') },
  ];
  const due = followUps ? followUps.overdue + followUps.today : 0;
  return <header className={styles.topbar}>
    <button type="button" className={styles.menuButton} aria-label="Open navigation" onClick={onMenu}><Icon name="menu" /></button>
    <nav className={styles.crumb} aria-label="Breadcrumb">
      <span>{page?.group || 'Admin'}</span>
      {page && (exact && page.label === page.section.label
        ? <><Icon name="chevron" /><span aria-current="page">{page.label}</span></>
        : <><Icon name="chevron" /><Link href={page.section.href}>{page.section.label}</Link></>)}
      {page && page.label !== page.section.label && <><Icon name="chevron" />{exact ? <span aria-current="page">{page.label}</span> : <Link href={page.href}>{page.label}</Link>}</>}
      {page && !exact && <><Icon name="chevron" /><span aria-current="page">Details</span></>}
    </nav>
    <button type="button" className={styles.search} onClick={onSearch} aria-keyshortcuts="Control+K">
      <Icon name="search" /><span>Search leads, pages, universities…</span><kbd>Ctrl K</kbd>
    </button>
    <div className={styles.actions}>
      <RowMenu label="Create new" align="end" className={styles.createButton} trigger={<><Icon name="plus" /><span>New</span></>} items={[{ heading: 'Create' }, ...createItems]} />
      {holds(admin, 'leads.notes') && <Link href="/admin/my-day" className={styles.bell} title={followUps ? `${followUps.overdue} overdue, ${followUps.today} due today` : 'Follow-ups'} aria-label={followUps ? `Follow-ups: ${followUps.overdue} overdue, ${followUps.today} due today` : 'Follow-ups'}>
        <Icon name="bell" />{due > 0 && <span className={styles.bellCount} data-overdue={followUps.overdue > 0}>{due > 99 ? '99+' : due}</span>}
      </Link>}
      <AccountMenu admin={admin} prefs={prefs} update={update} logout={logout} />
    </div>
  </header>;
}

/** Section title, description and tabs. Shown on the section's own screens, not on detail pages. */
function PageHeader({ admin, page }) {
  const tabs = page.section.tabs?.filter((tab) => canOpen(admin, tab)) ?? [];
  return <div className={styles.pageHeader} data-tabs={tabs.length > 1 || undefined}>
    <div className={styles.pageHeading}>
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

  if (status === 'loading') return <div className={styles.splash} role="status"><span className={styles.splashMark}><Icon name="cap" /></span><p>Opening the admin console…</p></div>;
  if (status === 'unavailable') return <div className={styles.splash} role="alert"><span className={styles.splashMark}><Icon name="shield" /></span><p>The Gyaan Vidhya API is not reachable. Start the backend and reload this page.</p><button type="button" className="button button--primary" onClick={() => window.location.reload()}>Reload</button></div>;
  if (!admin) return null;
  if (blocked) return <div className={styles.splash} role="status"><p>Opening the page your role is for…</p></div>;
  const collapsed = prefs.nav === 'collapsed';
  return <div className={styles.shell} data-crm-text={prefs.text} data-density={prefs.density} data-nav={prefs.nav}>
    <a className={styles.skip} href="#main">Skip to content</a>
    <Sidebar admin={admin} collapsed={collapsed} open={open} followUps={followUps} onNavigate={() => setOpen(false)} onToggle={() => updatePrefs({ nav: collapsed ? 'expanded' : 'collapsed' })} />
    <button type="button" className={styles.scrim} data-open={open} aria-label="Close navigation" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <div className={styles.workspace}>
      <Topbar admin={admin} page={page} exact={exact} prefs={prefs} update={updatePrefs} followUps={followUps} logout={logout}
        onMenu={() => setOpen(true)} onSearch={() => setSearching(true)} />
      <main id="main" className={styles.content} tabIndex={-1}>
        {exact && <PageHeader admin={admin} page={page} />}
        {children}
      </main>
    </div>
    {searching && <CommandPalette admin={admin} request={request} onClose={() => setSearching(false)} />}
  </div>;
}

export default function AdminShell({ children }) {
  return <AdminSessionProvider><ToastProvider><Workspace>{children}</Workspace></ToastProvider></AdminSessionProvider>;
}
