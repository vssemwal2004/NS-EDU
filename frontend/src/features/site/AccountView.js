'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { accountBenefits, catalogStats, COMPARE_KEY, COMPARE_MAX, displayContact, firstName, initials, quickTools, SESSION_DAYS } from '@/features/auth/login-helpers';
import { parseJson, useStoredString, writeStoredJson } from '@/features/auth/useDeviceStorage';
import { api } from '@/lib/api/client';
import { formatTuition } from '@/lib/college-catalog';
import { newsDate, readSavedNews, savedNewsKey } from '@/lib/education-news';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import styles from '@/features/auth/Account.module.css';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const memberSince = (student) => student?.createdAt && Number.isFinite(Date.parse(student.createdAt)) ? dateFormat.format(new Date(student.createdAt)) : '';

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

function Hero({ children, wide }) {
  return <section className={styles.hero} data-wide={wide || undefined} aria-labelledby="account-title">
    <svg className={styles.heroLines} viewBox="0 0 600 200" fill="none" aria-hidden="true" preserveAspectRatio="none"><path d="M0 170C120 150 210 60 330 70s200 90 270 60M0 190C140 170 230 90 340 96s190 80 260 52M420 0c10 40 60 70 120 76" /></svg>
    <div className={`container ${styles.heroInner}`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><Icon name="chevron" /><span aria-current="page">My account</span></nav>
      {children}
    </div>
  </section>;
}

function Card({ id, title, icon, action, children, className = '' }) {
  return <section id={id} className={`${styles.card} ${className}`} aria-labelledby={`${id}-title`}>
    <div className={styles.cardHead}>
      <h2 id={`${id}-title`}>{icon && <span className={styles.cardIcon}><Icon name={icon} /></span>}{title}</h2>
      {action}
    </div>
    {children}
  </section>;
}

function Empty({ icon, title, text, children }) {
  return <div className={styles.empty}>
    <span className={styles.emptyIcon}><Icon name={icon} /></span>
    <div><h3>{title}</h3><p>{text}</p>{children && <div className={styles.emptyActions}>{children}</div>}</div>
  </div>;
}

function Preferences() {
  const { course, city, setCourse, setCity } = usePreferences();
  const { courses, cityNames, findCourse } = useCatalog();
  const [message, setMessage] = useState('');
  const courseName = findCourse(course)?.name;
  const query = new URLSearchParams({ ...(course && courseName ? { course } : {}), ...(city ? { location: city } : {}) }).toString();
  const label = courseName && city ? `See ${courseName} colleges in ${city}` : courseName ? `See ${courseName} colleges` : city ? `See colleges in ${city}` : 'Explore colleges';
  function saved(update, value) { update(value); setMessage('Saved on this device.'); window.setTimeout(() => setMessage(''), 4000); }
  return <Card id="preferences" title="Your preferences" icon="location" action={<span className={styles.deviceTag}><Icon name="loginDevice" />This device</span>}>
    <p className={styles.cardText}>Course and city pages open with these picks. They stay in this browser, signed in or not.</p>
    <div className={styles.prefGrid}>
      <label className={styles.selectField}><span>Preferred course</span>
        <select value={courseName ? course : ''} onChange={(event) => saved(setCourse, event.target.value)}>
          <option value="">No preference</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className={styles.selectField}><span>Preferred city</span>
        <select value={city} onChange={(event) => saved(setCity, event.target.value)}>
          <option value="">No preference</option>{cityNames.map((name) => <option key={name}>{name}</option>)}
          {city && !cityNames.includes(city) && <option>{city}</option>}
        </select>
      </label>
    </div>
    <p className={styles.status} role="status">{message && <><Icon name="check" />{message}</>}</p>
    <Link className={`button button--outline ${styles.fullButton}`} href={query ? `/colleges?${query}` : '/colleges'}>{label}<Icon name="arrow" /></Link>
  </Card>;
}

function QuickTools({ wide }) {
  return <Card id="tools" title="Quick tools" icon="spark" className={wide ? styles.wideCard : ''}>
    <ul className={styles.tools} data-wide={wide || undefined}>
      {quickTools.map((tool) => <li key={tool.href}><Link href={tool.href} className={styles.tool}>
        <span className={styles.toolIcon}><Icon name={tool.icon} /></span>
        <span><strong>{tool.title}</strong><small>{tool.text}</small></span>
        <Icon name="arrow" className={styles.toolArrow} />
      </Link></li>)}
    </ul>
  </Card>;
}

function BenefitList({ className }) {
  return <ul className={className}>
    {accountBenefits.map((item) => <li key={item.title}><span><Icon name={item.icon} /></span><p><strong>{item.title}</strong>{item.text}</p></li>)}
  </ul>;
}

function SignedOut({ unavailable }) {
  const { openLogin, refresh } = useStudentAuth();
  const stats = catalogStats(useCatalog());
  return <>
    <Hero>
      <div className={styles.introCopy}>
        <p className={styles.eyebrow}><Icon name="user" />My account</p>
        <h1 id="account-title">Your student <em>space</em></h1>
        <p className={styles.description}>Log in with a one-time code to keep your comparisons, saved news and preferences together on one page.</p>
      </div>
    </Hero>
    <div className={`container ${styles.page}`}>
      {unavailable && <div className={styles.alert} role="alert">
        <Icon name="refresh" />
        <div><h2>We couldn’t reach your account just now</h2><p>Check your connection and try again. Your preferences on this device still work below.</p></div>
        <button type="button" className="button button--primary" onClick={refresh}><Icon name="refresh" />Retry</button>
      </div>}
      <div className={styles.columns}>
        <section className={styles.invite} aria-labelledby="invite-title">
          <div className={styles.inviteBrand}>
            <p className={styles.inviteEyebrow}><Icon name="spark" />What you get</p>
            <BenefitList className={styles.inviteBenefits} />
            <div className={styles.inviteStats}>
              <dl>{stats.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
              <p>Illustrative catalogue</p>
            </div>
          </div>
          <div className={styles.inviteAction}>
            <span className={styles.inviteMark} aria-hidden="true"><Icon name="loginChat" /></span>
            <h2 id="invite-title">Log in or create your student space</h2>
            <p>One code to your mobile or email. No password and no separate sign-up: your space is created the first time you verify a code.</p>
            <button type="button" className={`button button--primary ${styles.inviteButton}`} onClick={openLogin} disabled={unavailable}><Icon name="lock" />Log in with OTP</button>
            <p className={styles.inviteNote}><Icon name="phone" />Mobile (+91) or <Icon name="mail" />Email</p>
          </div>
        </section>
        <Preferences />
      </div>
      <QuickTools wide />
    </div>
  </>;
}

function Loading() {
  return <div aria-busy="true">
    <p className="sr-only" role="status">Loading your account…</p>
    <div className={styles.hero} aria-hidden="true"><div className={`container ${styles.heroInner}`}><span className={`${styles.skeleton} ${styles.skeletonCrumb}`} /><div className={styles.profile}><span className={`${styles.skeleton} ${styles.skeletonAvatar}`} /><div className={styles.skeletonLines}><span className={styles.skeleton} /><span className={styles.skeleton} /></div></div></div></div>
    <div className={`container ${styles.page}`} aria-hidden="true">
      <div className={styles.tiles}>{[0, 1, 2, 3].map((item) => <span key={item} className={`${styles.skeleton} ${styles.skeletonTile}`} />)}</div>
      <div className={styles.columns}><span className={`${styles.skeleton} ${styles.skeletonCard}`} /><span className={`${styles.skeleton} ${styles.skeletonCard}`} /></div>
    </div>
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
      <input id="account-name" className="field" value={name} maxLength={80} autoComplete="name" placeholder="Full name" autoFocus
        onChange={(event) => { setName(event.target.value); setState({ busy: false, error: '' }); }} aria-invalid={Boolean(state.error)} aria-describedby={state.error ? 'account-name-error' : undefined} />
      <button className="button button--primary" type="submit" disabled={state.busy}>{state.busy ? 'Saving…' : 'Save'}</button>
      <button className="button button--ghost" type="button" onClick={() => onDone('')}>Cancel</button>
    </div>
    {state.error && <p id="account-name-error" className={styles.errorText} role="alert">{state.error}</p>}
  </form>;
}

function SignedIn({ student }) {
  const { signOut } = useStudentAuth();
  const { course } = usePreferences();
  const { findCourse } = useCatalog();
  const lists = useComparisonLists();
  const news = useSavedNews();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const first = firstName(student);
  const since = memberSince(student);
  const contact = displayContact(student);
  const channel = student.phone ? 'Mobile' : 'Email';
  const preferred = findCourse(course);

  function flash(text) { setMessage(text); if (text) window.setTimeout(() => setMessage(''), 4000); }
  function clearList(courseId, name) {
    const stored = parseJson(window.localStorage.getItem(COMPARE_KEY), {});
    const next = { ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}) };
    delete next[courseId];
    writeStoredJson(COMPARE_KEY, next);
    flash(`${name} comparison list cleared.`);
  }
  const tiles = [
    { href: '#comparisons', icon: 'scales', value: lists?.length ?? '–', label: 'Comparison lists' },
    { href: '#comparisons', icon: 'building', value: lists ? lists.reduce((total, list) => total + list.rows.length, 0) : '–', label: 'Colleges lined up' },
    { href: '#saved-news', icon: 'bookmark', value: news?.length ?? '–', label: 'Saved stories' },
    { href: '#preferences', icon: 'cap', value: preferred?.name || 'Not set', label: 'Preferred course', text: true },
  ];

  return <>
    <Hero wide>
      <div className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">{initials(student) || <Icon name="phone" />}</span>
        <div className={styles.profileText}>
          <p className={styles.eyebrow}><Icon name="dashboard" />Student space</p>
          <h1 id="account-title">{first ? <>Welcome back, <em>{first}</em></> : <>Welcome to <em>NSEDU</em></>}</h1>
          <ul className={styles.metaList}>
            <li><Icon name={student.phone ? 'phone' : 'mail'} />{contact}</li>
            <li className={styles.metaChip}><Icon name="loginBadge" />Signed in with {channel}</li>
            {since && <li><Icon name="calendar" />Member since {since}</li>}
          </ul>
          {editing && <NameEditor student={student} onDone={(text) => { setEditing(false); flash(text); }} />}
          <p className={styles.heroStatus} role="status">{message && <><Icon name="check" />{message}</>}</p>
        </div>
        <div className={styles.heroActions}>
          {!editing && <button type="button" className="button button--outline" onClick={() => setEditing(true)}><Icon name="edit" />{student.name ? 'Edit name' : 'Add your name'}</button>}
          <button type="button" className="button button--ghost" onClick={signOut}><Icon name="logout" />Log out</button>
        </div>
      </div>
    </Hero>

    <div className={`container ${styles.page}`}>
      <ul className={`${styles.tiles} ${styles.tilesRaised}`} aria-label="Your space at a glance">
        {tiles.map((tile) => <li key={tile.label}><a className={styles.tile} href={tile.href}>
          <span className={styles.tileIcon}><Icon name={tile.icon} /></span>
          <span className={styles.tileText}><strong data-text={tile.text || undefined}>{tile.value}</strong><span>{tile.label}</span></span>
        </a></li>)}
      </ul>

      <div className={styles.columns}>
        <div className={styles.stack}>
          <Card id="comparisons" title="Your comparisons" icon="scales" action={<Link className="text-link" href="/compare">Open Compare<Icon name="arrow" /></Link>}>
            <p className={styles.cardText}>Lists you started on Compare colleges, kept on this device. Up to {COMPARE_MAX} colleges per course.</p>
            {lists === undefined ? <span className={`${styles.skeleton} ${styles.skeletonCard}`} aria-hidden="true" />
              : lists.length ? <ul className={styles.compareList}>
                {lists.map(({ course: item, rows }) => <li key={item.id} className={styles.compareCard}>
                  <div className={styles.compareHead}>
                    <span className={styles.courseIcon}><Icon name={item.icon} /></span>
                    <div><h3>{item.name}</h3><p>{rows.length} of {COMPARE_MAX} colleges picked</p></div>
                    <span className={styles.tag}>Illustrative data</span>
                  </div>
                  <ol className={styles.picks}>
                    {rows.map((row) => <li key={row.id}>
                      <span className={styles.pickArt} aria-hidden="true"><CollegeArtwork row={row} /></span>
                      <span className={styles.pickText}><strong>{row.shortName}</strong><small>{row.city}</small><small>{formatTuition(row.annualTuitionInr)}/yr</small></span>
                    </li>)}
                    {Array.from({ length: COMPARE_MAX - rows.length }, (_, index) => <li key={`slot-${index}`} className={styles.slot} aria-hidden="true"><Icon name="plus" /><small>Open slot</small></li>)}
                  </ol>
                  <div className={styles.compareFoot}>
                    <p>{rows.length < 2 ? <><Icon name="spark" />Add 1–2 more to compare</> : <><Icon name="check" />Ready to compare side by side</>}</p>
                    <div>
                      <button type="button" className={styles.textButton} onClick={() => clearList(item.id, item.name)}><Icon name="trash" />Clear list<span className="sr-only"> for {item.name}</span></button>
                      <Link className="button button--primary" href={`/compare?course=${encodeURIComponent(item.id)}`}>{rows.length < 2 ? 'Add colleges' : 'Open comparison'}<span className="sr-only"> for {item.name}</span><Icon name="arrow" /></Link>
                    </div>
                  </div>
                </li>)}
              </ul>
              : <Empty icon="scales" title="No comparisons yet" text={`Pick up to ${COMPARE_MAX} colleges for a course on Compare colleges and they will appear here.`}>
                <Link className="button button--primary" href="/compare">Start comparing<Icon name="arrow" /></Link>
                <Link className="button button--ghost" href="/colleges">Browse colleges</Link>
              </Empty>}
          </Card>

          <Card id="saved-news" title="Saved news" icon="bookmark" action={<Link className="text-link" href="/news">See all news<Icon name="arrow" /></Link>}>
            {news === undefined ? <span className={`${styles.skeleton} ${styles.skeletonCard}`} aria-hidden="true" />
              : news.length ? <>
                <ul className={styles.newsList}>
                  {news.slice(0, 3).map((story) => <li key={story.id}><a className={styles.newsLink} href={story.url} target="_blank" rel="noopener noreferrer">
                    <span className={styles.newsMeta}>{story.source}{newsDate(story.publishedAt) && <> · {newsDate(story.publishedAt)}</>}</span>
                    <strong>{story.title}</strong>
                    <Icon name="external" className={styles.newsIcon} /><span className="sr-only"> (opens in a new tab)</span>
                  </a></li>)}
                </ul>
                {news.length > 3 && <p className={styles.cardText}>Showing 3 of {news.length} saved stories. The rest are in Education news.</p>}
              </>
              : <Empty icon="news" title="Nothing saved yet" text="Save stories from Education news to read later. They stay on this device.">
                <Link className="button button--ghost" href="/news">Browse education news<Icon name="arrow" /></Link>
              </Empty>}
          </Card>
        </div>

        <div className={styles.stack}>
          <Preferences />
          <Card id="security" title="Account & security" icon="shield">
            <dl className={styles.facts}>
              <div><dt>{channel === 'Mobile' ? 'Mobile number' : 'Email'}</dt><dd><span className={styles.factValue}>{contact}</span><span className={styles.verifiedTag}><Icon name="loginBadge" />Verified</span></dd></div>
              <div><dt>Name</dt><dd>{student.name || 'Not added yet'}</dd></div>
              {since && <div><dt>Member since</dt><dd>{since}</dd></div>}
              <div><dt>Sign-in method</dt><dd>One-time code, no password</dd></div>
            </dl>
            <p className={styles.note}><Icon name="loginClock" />You stay signed in on this device for up to {SESSION_DAYS} days. Log out when you use a shared computer.</p>
            <button type="button" className={`button button--ghost ${styles.fullButton}`} onClick={signOut}><Icon name="logout" />Log out</button>
          </Card>
          <QuickTools />
        </div>
      </div>
    </div>
  </>;
}

export default function AccountView() {
  const { student, status } = useStudentAuth();
  if (status === 'loading') return <Loading />;
  if (!student) return <SignedOut unavailable={status === 'unavailable'} />;
  return <SignedIn student={student} />;
}
