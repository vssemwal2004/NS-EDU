'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { drawerGroups, isActivePath, primaryNavigation } from '@/data/navigation';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import { collegesHref, examHref, plural, withCourse } from './catalog-nav';
import { PreferenceFields } from './PreferenceChip';
import { useCatalogNav, useCompareSummary } from './useCatalogNav';
import styles from './Drawer.module.css';

const examGroup = primaryNavigation.find((group) => group.panel === 'exams');

// Stream-first drawer contents: search, preference, streams, exams, tools, account.
export default function MobileNav({ pathname, onSearch, onNavigate }) {
  const { exams } = useCatalog();
  const { streams, courses } = useCatalogNav();
  const { course } = usePreferences();
  const { student, openLogin, signOut } = useStudentAuth();
  const compare = useCompareSummary();
  const preferredField = courses.find((item) => item.id === course)?.field;

  return <div id="mobile-navigation" className={styles.drawerNav}>
    <form role="search" className={styles.search} onSubmit={(event) => { event.preventDefault(); onSearch(new FormData(event.currentTarget).get('q')?.toString().trim() || ''); }}>
      <Icon name="search" /><label className="sr-only" htmlFor="mobile-search">Search Gyaan Vidhya</label>
      <input id="mobile-search" name="q" type="search" placeholder="Colleges, courses, exams or cities" maxLength={120} autoComplete="off" enterKeyHint="search" />
      <button type="submit" className={styles.searchGo} aria-label="Search"><Icon name="arrow" /></button>
    </form>

    <section className={styles.preference} aria-labelledby="drawer-preference-title">
      <p id="drawer-preference-title" className={styles.sectionLabel}><Icon name="preferenceSliders" />Your course &amp; city</p>
      <PreferenceFields idPrefix="drawer-preference" variant="drawer" onNavigate={onNavigate} />
    </section>

    <nav aria-label="Mobile navigation" className={styles.groups}>
      <p className={styles.sectionLabel}><Icon name="building" />Colleges by stream</p>
      {streams.map((stream) => <details key={stream.id} className={styles.group} open={stream.field === preferredField}>
        <summary><span className={styles.groupIcon}><Icon name={stream.icon} /></span><span className={styles.groupTitle}>{stream.field}</span><span className={styles.count} aria-label={plural(stream.count, 'programme')}>{stream.count}</span><Icon name="chevron" /></summary>
        <ul>
          {stream.courses.slice(0, 6).map((item) => <li key={item.id}><Link href={collegesHref(item.id)} onClick={onNavigate}>{item.name} colleges<em>{plural(item.count, 'programme')}</em></Link></li>)}
          {stream.cities[0] && <li><Link href={collegesHref(stream.cities[0].courseId, stream.cities[0].name)} onClick={onNavigate}><Icon name="location" />Colleges in {stream.cities[0].name}<em>{stream.cities[0].count}</em></Link></li>}
          <li><Link className={styles.viewAll} href={`/courses?field=${encodeURIComponent(stream.field)}`} onClick={onNavigate}>All {stream.field} courses<Icon name="arrow" /></Link></li>
        </ul>
      </details>)}

      <p className={styles.sectionLabel}><Icon name="compass" />Explore</p>
      <details className={styles.group} open={isActivePath(pathname, examGroup)}>
        <summary><span className={styles.groupIcon}><Icon name="document" /></span><span className={styles.groupTitle}>Entrance exams</span><span className={styles.count} aria-label={plural(exams.length, 'exam')}>{exams.length}</span><Icon name="chevron" /></summary>
        <ul>
          {exams.map((exam) => <li key={exam.id}><Link href={examHref(exam.id)} onClick={onNavigate}><Icon name={exam.icon} />{exam.name}<em>{exam.field}</em></Link></li>)}
          <li><Link className={styles.viewAll} href="/exams" onClick={onNavigate}>All exam guides<Icon name="arrow" /></Link></li>
        </ul>
      </details>
      {drawerGroups.map((group) => <details key={group.title} className={styles.group} open={group.links.some((link) => isActivePath(pathname, { match: [link.href] }))}>
        <summary><span className={styles.groupIcon}><Icon name={group.icon} /></span><span className={styles.groupTitle}>{group.title}</span><span className={styles.count} aria-label={plural(group.links.length, 'link')}>{group.links.length}</span><Icon name="chevron" /></summary>
        <ul>{group.links.map((link) => <li key={link.href}><Link href={link.course ? withCourse(link.href, course) : link.href} onClick={onNavigate} aria-current={isActivePath(pathname, { match: [link.href] }) ? 'page' : undefined}>
          <Icon name={link.icon} />{link.label}{link.href === '/compare' && compare.count > 0 && <em>{compare.count} selected</em>}
        </Link></li>)}</ul>
      </details>)}
      <Link className={styles.plainLink} href="/courses" onClick={onNavigate} aria-current={pathname === '/courses' ? 'page' : undefined}><Icon name="layers" />All courses<Icon name="arrow" /></Link>
      <Link className={styles.plainLink} href="/locations" onClick={onNavigate} aria-current={pathname === '/locations' ? 'page' : undefined}><Icon name="map" />Study destinations<Icon name="arrow" /></Link>
    </nav>

    <div className={styles.account}>
      {student
        ? <><p><span className={styles.avatar} aria-hidden="true">{(student.name || student.email || 'S')[0].toUpperCase()}</span><span><strong>{student.name || 'Gyaan Vidhya student'}</strong><small>{student.email || student.phone}</small></span></p>
          <div className={styles.accountActions}><Link className="button button--outline" href="/account" onClick={onNavigate}>My account</Link><button className="button button--ghost" type="button" onClick={() => { onNavigate(); signOut(); }}>Log out</button></div></>
        : <><p className={styles.accountText}>Log in with a one-time code to manage your student profile.</p>
          <button className="button button--primary" type="button" onClick={() => { onNavigate(); openLogin(); }}><Icon name="user" />Log in to Gyaan Vidhya</button></>}
    </div>
    <p className={styles.note}>A thoughtful choice starts here.</p>
  </div>;
}
