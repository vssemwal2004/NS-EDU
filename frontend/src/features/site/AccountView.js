'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { COMPARE_KEY, COMPARE_MAX, displayContact, firstName, initials, quickTools, SESSION_DAYS } from '@/features/auth/login-helpers';
import { parseJson, useStoredString, writeStoredJson } from '@/features/auth/useDeviceStorage';
import MyApplications from '@/features/apply/MyApplications';
import { STATUS_LABELS } from '@/features/apply/apply-options';
import { compareHref } from '@/features/compare/compare-data';
import { api } from '@/lib/api/client';
import { formatTuition } from '@/lib/college-catalog';
import { newsDate, readSavedNews, savedNewsKey } from '@/lib/education-news';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import styles from '@/app/(site)/account/account.module.css';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const memberSince = (student) => student?.createdAt && Number.isFinite(Date.parse(student.createdAt)) ? dateFormat.format(new Date(student.createdAt)) : '';

// What each tracker status means (labels mirror the admissions pipeline).
const journey = [
  { status: 'new', text: 'Your details reach the Gyaan Vidhya admissions team.' },
  { status: 'contacted', text: 'A counsellor gets in touch by phone or email.' },
  { status: 'in-progress', text: 'Programme choice and documents, worked through together.' },
  { status: 'applied-to-university', text: 'Your application enters the university’s own process.' },
  { status: 'admitted', text: 'The university confirms your place.' },
];

// Compare picks are device-local: { [courseId]: [programmeId, …] }. Only ids that still exist are shown.
function useComparisonLists() {
  const raw = useStoredString(COMPARE_KEY);
  const { colleges, findCourse } = useCatalog();
  return useMemo(() => {
    if (raw === undefined) return undefined;
    const stored = parseJson(raw, {});
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return [];
    return Object.entries(stored).flatMap(([courseId, ids]) => {
      const course = findCourse(courseId);
      const rows = Array.isArray(ids) ? ids.map((id) => colleges.find((row) => row.id === id && row.courseId === courseId)).filter(Boolean).slice(0, COMPARE_MAX) : [];
      return course && rows.length ? [{ course, rows }] : [];
    });
  }, [raw, colleges, findCourse]);
}
function useSavedNews() {
  const raw = useStoredString(savedNewsKey);
  return useMemo(() => raw === undefined ? undefined : readSavedNews({ getItem: () => raw }), [raw]);
}

function Panel({ id, eyebrow, title, icon, action, children, className = '' }) {
  return <section id={id} className={`${styles.panel} ${className}`} aria-labelledby={`${id}-title`}>
    <header className={styles.panelHead}>
      <span className={styles.panelIcon} aria-hidden="true"><Icon name={icon} /></span>
      <div className={styles.panelTitles}>
        {eyebrow && <p className="lux-eyebrow">{eyebrow}</p>}
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {action}
    </header>
    {children}
  </section>;
}

function Empty({ title, text, children }) {
  return <div className={styles.empty}>
    <p className={styles.emptyTitle}>{title}</p>
    <p>{text}</p>
    {children && <div className={styles.emptyActions}>{children}</div>}
  </div>;
}

function NameEditor({ student, onDone }) {
  const { setStudent } = useStudentAuth();
  const [name, setName] = useState(student.name || '');
  const [state, setState] = useState({ busy: false, error: '' });
  async function save(event) {
    event.preventDefault();
    const value = name.trim();
    if (!value) { setState({ busy: false, error: 'Enter your name.' }); return; }
    setState({ busy: true, error: '' });
    try {
      const data = await api('/auth/me', { method: 'PATCH', body: { name: value } });
      setStudent(data.student);
      onDone('Name saved.');
    } catch (failure) { setState({ busy: false, error: failure.fields?.name || failure.message }); }
  }
  return <form className={styles.nameForm} onSubmit={save} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onDone(''); } }} noValidate>
    <label className={styles.nameLabel} htmlFor="account-name">Your name</label>
    <div className={styles.nameRow}>
      <input id="account-name" className="lux-field" value={name} maxLength={80} autoComplete="name" placeholder="Full name" autoFocus
        onChange={(event) => { setName(event.target.value); setState({ busy: false, error: '' }); }} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? 'account-name-error' : undefined} />
      <button className="lux-button lux-button--light" type="submit" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save'}</button>
      <button className="lux-button lux-button--ghost" type="button" onClick={() => onDone('')}>Cancel</button>
    </div>
    {state.error && <p id="account-name-error" className={styles.nameError} role="alert">{state.error}</p>}
  </form>;
}

function Band({ student, lists, news, preferred }) {
  const { signOut } = useStudentAuth();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const first = firstName(student);
  const since = memberSince(student);
  function done(text) { setEditing(false); setMessage(text); if (text) window.setTimeout(() => setMessage(''), 4000); }
  const glance = [
    { href: '#comparisons', label: 'Compare picks', value: lists ? lists.reduce((total, list) => total + list.rows.length, 0) : null },
    { href: '#saved-news', label: 'Saved stories', value: news ? news.length : null },
    { href: '#preferences', label: 'Preferred course', value: preferred?.name || 'Not set', text: true },
  ];
  return <header className={`lux-surface-dark ${styles.band}`}>
    <div className={`lux-container ${styles.bandInner}`}>
      <nav aria-label="Breadcrumb" className={styles.crumbs}><ol><li><Link href="/">Home</Link></li><li aria-current="page">My account</li></ol></nav>
      <div className={styles.identity}>
        <span className={styles.monogram} aria-hidden="true">{initials(student) || <Icon name="user" />}</span>
        <div className={styles.identityText}>
          <p className="lux-eyebrow lux-eyebrow--rule">Your student space</p>
          <h1 id="account-title" className={styles.greeting}>{first ? <>Welcome back, <em>{first}</em></> : <>Welcome to your <em>student space</em></>}</h1>
          <ul className={styles.identityMeta}>
            {student.email && <li><Icon name="mail" /><span className={styles.contact}>{student.email}</span><span className={styles.verified}><Icon name="pageVerified" />Verified</span></li>}
            {since && <li><Icon name="calendar" />Member since {since}</li>}
          </ul>
        </div>
        <div className={styles.bandActions}>
          {!editing && <button type="button" className="lux-button lux-button--outline lux-button--sm" onClick={() => setEditing(true)}><Icon name="edit" />{student.name ? 'Edit name' : 'Add your name'}</button>}
          <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={signOut}><Icon name="logout" />Log out</button>
        </div>
      </div>
      {editing && <NameEditor student={student} onDone={done} />}
      <p className={styles.bandStatus} role="status">{message && <><Icon name="check" />{message}</>}</p>
      <ul className={styles.glance} aria-label="Your space at a glance">
        {glance.map((item) => <li key={item.label}><a href={item.href}><span>{item.label}</span><strong data-text={item.text || undefined}>{item.value ?? '–'}</strong></a></li>)}
      </ul>
    </div>
  </header>;
}

function Journey() {
  return <section className={styles.journey} aria-labelledby="journey-title">
    <h3 id="journey-title" className={styles.journeyTitle}>How an application moves</h3>
    <ol className={styles.steps}>
      {journey.map((step, index) => <li key={step.status}>
        <span className={styles.stepDot} aria-hidden="true">{index + 1}</span>
        <p><strong>{STATUS_LABELS[step.status]}</strong>{step.text}</p>
      </li>)}
    </ol>
  </section>;
}

function Comparisons({ lists }) {
  function clearList(courseId) {
    const stored = parseJson(window.localStorage.getItem(COMPARE_KEY), {});
    const next = { ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}) };
    delete next[courseId];
    writeStoredJson(COMPARE_KEY, next);
  }
  return <Panel id="comparisons" eyebrow="On this device" title="Compare picks" icon="scales" action={<Link className="lux-link" href="/compare">Open Compare<Icon name="arrow" /></Link>}>
    {lists === undefined ? <span className={`lux-skeleton ${styles.skeletonBlock}`} aria-hidden="true" />
      : lists.length ? <ul className={styles.compareList}>
        {lists.map(({ course, rows }) => <li key={course.id} className={styles.compareCard}>
          <div className={styles.compareHead}>
            <h3>{course.name}</h3>
            <span className="lux-chip lux-chip--static">Illustrative data</span>
          </div>
          <ol className={styles.picks}>
            {rows.map((row, index) => <li key={row.id}>
              <span className={styles.pickNo} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className={styles.pickText}><strong>{row.shortName}</strong><small>{row.city} · {formatTuition(row.annualTuitionInr)}/yr</small></span>
            </li>)}
          </ol>
          <div className={styles.compareFoot}>
            <p>{rows.length} of {COMPARE_MAX} picked{rows.length < 2 ? ' · add one more to compare' : ''}</p>
            <div className={styles.compareActions}>
              <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => clearList(course.id)}><Icon name="trash" />Clear<span className="sr-only"> {course.name} picks</span></button>
              <Link className="lux-button lux-button--primary lux-button--sm" href={compareHref(course.id, rows.map((row) => row.id))}>{rows.length < 2 ? 'Add colleges' : 'Compare'}<span className="sr-only"> {course.name}</span><Icon name="arrow" /></Link>
            </div>
          </div>
        </li>)}
      </ul>
      : <Empty title="No compare picks yet" text={`Pick up to ${COMPARE_MAX} colleges for a course and see fees and outcomes side by side.`}>
        <Link className="lux-button lux-button--primary lux-button--sm" href="/compare">Start comparing<Icon name="arrow" /></Link>
      </Empty>}
  </Panel>;
}

function SavedNews({ news }) {
  return <Panel id="saved-news" eyebrow="Reading list" title="Saved news" icon="bookmark" action={<Link className="lux-link" href="/news">All news<Icon name="arrow" /></Link>}>
    {news === undefined ? <span className={`lux-skeleton ${styles.skeletonBlock}`} aria-hidden="true" />
      : news.length ? <>
        <ul className={styles.newsList}>
          {news.slice(0, 4).map((story) => <li key={story.id}><a className={styles.newsLink} href={story.url} target="_blank" rel="noopener noreferrer">
            <span className={styles.newsMeta}>{story.source}{newsDate(story.publishedAt) && <> · {newsDate(story.publishedAt)}</>}</span>
            <strong>{story.title}</strong>
            <span className="sr-only"> (opens in a new tab)</span>
          </a></li>)}
        </ul>
        {news.length > 4 && <p className={styles.note}>Showing 4 of {news.length} saved stories. The rest are in Education news.</p>}
      </>
      : <Empty title="Nothing saved yet" text="Save stories from Education news to read later. They stay on this device.">
        <Link className="lux-button lux-button--ghost lux-button--sm" href="/news">Browse education news<Icon name="arrow" /></Link>
      </Empty>}
  </Panel>;
}

function Profile({ student }) {
  const { signOut } = useStudentAuth();
  const since = memberSince(student);
  return <Panel id="profile" eyebrow="Account" title="Profile essentials" icon="user">
    <dl className={styles.facts}>
      {student.email && <div><dt>Email</dt><dd><span className={styles.factValue}>{student.email}</span><span className={styles.verifiedLight}><Icon name="pageVerified" />Verified</span></dd></div>}
      {student.phone && <div><dt>Mobile</dt><dd>{displayContact({ phone: student.phone })}</dd></div>}
      <div><dt>Name</dt><dd>{student.name || 'Not added yet'}</dd></div>
      {since && <div><dt>Member since</dt><dd>{since}</dd></div>}
      <div><dt>Sign-in</dt><dd>One-time code, no password</dd></div>
    </dl>
    <p className={styles.note}><Icon name="lock" />You stay signed in on this device for up to {SESSION_DAYS} days. Log out on shared computers.</p>
    <button type="button" className="lux-button lux-button--ghost lux-button--block" onClick={signOut}><Icon name="logout" />Log out</button>
  </Panel>;
}

function Preferences() {
  const { course, city, setCourse, setCity } = usePreferences();
  const { courses, cityNames, findCourse } = useCatalog();
  const [message, setMessage] = useState('');
  const courseName = findCourse(course)?.name;
  const query = new URLSearchParams({ ...(course && courseName ? { course } : {}), ...(city ? { location: city } : {}) }).toString();
  function saved(update, value) { update(value); setMessage('Saved on this device.'); window.setTimeout(() => setMessage(''), 4000); }
  return <Panel id="preferences" eyebrow="This device" title="Your preferences" icon="location">
    <p className={styles.note}>Course and city pages open with these picks.</p>
    <div className={styles.prefGrid}>
      <div><label className="lux-label" htmlFor="pref-course">Preferred course</label>
        <select id="pref-course" className="lux-field" value={courseName ? course : ''} onChange={(event) => saved(setCourse, event.target.value)}>
          <option value="">No preference</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      <div><label className="lux-label" htmlFor="pref-city">Preferred city</label>
        <select id="pref-city" className="lux-field" value={city} onChange={(event) => saved(setCity, event.target.value)}>
          <option value="">No preference</option>{cityNames.map((name) => <option key={name}>{name}</option>)}
          {city && !cityNames.includes(city) && <option>{city}</option>}
        </select>
      </div>
    </div>
    <p className={styles.saved} role="status">{message && <><Icon name="check" />{message}</>}</p>
    <Link className="lux-link" href={query ? `/colleges?${query}` : '/colleges'}>{courseName || city ? 'See matching colleges' : 'Explore colleges'}<Icon name="arrow" /></Link>
  </Panel>;
}

function QuickLinks() {
  return <Panel id="tools" eyebrow="Plan ahead" title="Quick links" icon="spark">
    <ul className={styles.tools}>
      {quickTools.map((tool) => <li key={tool.href}><Link href={tool.href} className={styles.tool}>
        <Icon name={tool.icon} />
        <span><strong>{tool.title}</strong><small>{tool.text}</small></span>
        <Icon name="arrow" className={styles.toolArrow} />
      </Link></li>)}
    </ul>
  </Panel>;
}

function Dashboard({ student }) {
  const { course } = usePreferences();
  const { findCourse } = useCatalog();
  const lists = useComparisonLists();
  const news = useSavedNews();
  return <>
    <Band student={student} lists={lists} news={news} preferred={findCourse(course)} />
    <div className={`lux-container ${styles.grid}`}>
      <div className={styles.mainCol}>
        <div className={styles.tracker}>
          <MyApplications />
          <Journey />
        </div>
        <Comparisons lists={lists} />
        <SavedNews news={news} />
      </div>
      <div className={styles.sideCol}>
        <Profile student={student} />
        <Preferences />
        <QuickLinks />
      </div>
    </div>
  </>;
}

function SignedOut({ unavailable }) {
  const { openLogin, refresh } = useStudentAuth();
  return <div className={styles.signedOut}>
    <div className="lux-state">
      <Icon name={unavailable ? 'refresh' : 'lock'} />
      <h1 id="account-title" className="lux-display-3">{unavailable ? 'We couldn’t reach your account' : 'You’re signed out'}</h1>
      <p className="lux-lead">{unavailable ? 'Check your connection and try again in a moment.' : 'Log in with a one-time code sent to your email to see your applications, compare picks and saved stories.'}</p>
      <div className={styles.stateActions}>
        {unavailable ? <button type="button" className="lux-button lux-button--primary" onClick={refresh}><Icon name="refresh" />Try again</button>
          : <button type="button" className="lux-button lux-button--primary" onClick={() => openLogin({ reason: 'Log in to open your student space.' })}><Icon name="mail" />Log in with email code</button>}
        <Link className="lux-button lux-button--ghost" href="/">Back to home</Link>
      </div>
    </div>
  </div>;
}

function Loading() {
  return <div aria-busy="true">
    <p className="sr-only" role="status">Loading your account…</p>
    <div className={`lux-surface-dark ${styles.band}`} aria-hidden="true"><div className={`lux-container ${styles.bandInner} ${styles.bandLoading}`} /></div>
    <div className={`lux-container ${styles.grid}`} aria-hidden="true">
      <div className={styles.mainCol}><span className={`lux-skeleton ${styles.skeletonPanel}`} /><span className={`lux-skeleton ${styles.skeletonPanel}`} /></div>
      <div className={styles.sideCol}><span className={`lux-skeleton ${styles.skeletonPanel}`} /></div>
    </div>
  </div>;
}

// The server passes the session it already checked, so the dashboard paints without waiting for the client.
export default function AccountView({ initialStudent = null }) {
  const { student, status } = useStudentAuth();
  const current = student || (status === 'loading' || status === 'unavailable' ? initialStudent : null);
  if (current) return <Dashboard student={current} />;
  if (status === 'loading') return <Loading />;
  return <SignedOut unavailable={status === 'unavailable'} />;
}
