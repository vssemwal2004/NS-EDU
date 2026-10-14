import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { hostname, plural } from '@/features/guides/data';
import { highlight, normalize } from '@/features/guides/highlight';
import { lakhRange } from '@/lib/college-catalog';
import styles from '@/features/guides/Search.module.css';

export const SEARCH_TABS = [
  { id: 'all', label: 'All' },
  { id: 'courses', label: 'Courses' },
  { id: 'colleges', label: 'Colleges' },
  { id: 'exams', label: 'Exams' },
];
const LIMIT = 6;
const includes = (value, query) => String(value || '').toLowerCase().includes(query.toLowerCase());
const tabHref = (query, tab) => `/search?${new URLSearchParams(tab === 'all' ? { q: query } : { q: query, tab })}`;

// Portal-style results: search bar, typed tabs with counts, grouped rich cards and recovery states.
export default function SearchResults({ query, tab = 'all', results, failed, catalog }) {
  const counts = { courses: results.courses.length, colleges: results.colleges.length, exams: results.exams.length };
  const total = counts.courses + counts.colleges + counts.exams;
  const rowsFor = (key, id) => catalog.colleges.filter((row) => row[key] === id);
  const courseName = (id) => catalog.courses.find((course) => course.id === id)?.name || id.toUpperCase();
  const examFor = (exam) => ({ ...catalog.exams.find((item) => item.id === exam.id), ...exam });
  const best = query && tab === 'all' ? results.courses.find((course) => normalize(course.name) === normalize(query) || course.id === normalize(query)) : null;

  const cards = {
    courses: (list) => list.map((course) => <CourseCard key={course.id} course={course} query={query} programmes={rowsFor('courseId', course.id).length} />),
    colleges: (list) => list.map((college) => <CollegeCard key={college.id} college={college} query={query} rows={rowsFor('collegeId', college.id)} courseName={courseName} />),
    exams: (list) => list.map((exam) => <ExamCard key={exam.id} exam={examFor(exam)} query={query} />),
  };

  let body;
  if (failed) body = <>
    <div className={styles.alert} role="alert"><Icon name="coursesInfo" /><div><strong>Search is temporarily unavailable.</strong><p>Nothing is wrong with your search — please try again in a moment, or browse the catalogue below.</p></div><Link className="button button--outline" href={tabHref(query, tab)}>Try again</Link></div>
    <Browse catalog={catalog} />
  </>;
  else if (!query) body = <>
    <section className={styles.empty} aria-labelledby="start-title">
      <span className={styles.emptyIcon}><Icon name="search" /></span>
      <h2 id="start-title">Start with a course, college, exam or city</h2>
      <p>Search matches course names, institution names, cities and entrance exams in the NSEDU catalogue.</p>
      <Popular catalog={catalog} />
    </section>
    <Browse catalog={catalog} />
  </>;
  else if (total === 0) body = <>
    <section className={styles.empty} aria-labelledby="empty-title">
      <span className={styles.emptyIcon}><Icon name="search" /></span>
      <h2 id="empty-title">No matches for “{query}”</h2>
      <ul className={styles.tips}>
        <li><Icon name="check" />Check the spelling, or try fewer words.</li>
        <li><Icon name="check" />Use a course short name such as B.Tech or MBA.</li>
        <li><Icon name="check" />Try a city name such as Pune or Chennai.</li>
      </ul>
      <Popular catalog={catalog} />
    </section>
    <Browse catalog={catalog} />
  </>;
  else if (tab === 'all') body = <>
    {best && <BestMatch course={best} programmes={rowsFor('courseId', best.id).length} />}
    {best && rowsFor('courseId', best.id).length > 0 && <section className={styles.group} aria-labelledby="group-offering">
      <header className={styles.groupHead}>
        <h2 id="group-offering">Sample colleges offering {best.name}</h2>
        <Link className="text-link" href={`/colleges?course=${best.id}`}>All {best.name} colleges<Icon name="arrow" /></Link>
      </header>
      <p className={styles.count}>From the course catalogue, not text matches · illustrative sample institutions.</p>
      <div className={styles.cards}>{rowsFor('courseId', best.id).slice(0, 4).map((row) => <CollegeCard key={row.collegeId} query=""
        college={{ id: row.collegeId, name: row.name, city: row.city, state: row.state, courses: rowsFor('collegeId', row.collegeId).map((item) => item.courseId) }}
        rows={rowsFor('collegeId', row.collegeId)} courseName={courseName} />)}</div>
    </section>}
    {['courses', 'colleges', 'exams'].map((type) => {
      const list = type === 'courses' && best ? results.courses.filter((course) => course.id !== best.id) : results[type];
      if (!list.length) return null;
      const label = SEARCH_TABS.find((item) => item.id === type).label;
      return <section key={type} className={styles.group} aria-labelledby={`group-${type}`}>
        <header className={styles.groupHead}>
          <h2 id={`group-${type}`}>{best && type === 'courses' ? 'More courses' : label}<span>{list.length}</span></h2>
          {list.length > LIMIT && <Link className="text-link" href={tabHref(query, type)}>View all {counts[type]} {label.toLowerCase()}<Icon name="arrow" /></Link>}
        </header>
        <div className={styles.cards}>{cards[type](list.slice(0, LIMIT))}</div>
      </section>;
    })}
  </>;
  else body = counts[tab] ? <section className={styles.group} aria-labelledby="group-tab">
    <h2 id="group-tab" className="sr-only">{SEARCH_TABS.find((item) => item.id === tab).label}</h2>
    <div className={styles.cards}>{cards[tab](results[tab])}</div>
  </section> : <div className={styles.tabEmpty}><Icon name="coursesInfo" /><p>No {tab} match “{query}”.</p><Link className="text-link" href={tabHref(query, 'all')}>See all {plural(total, 'result')}<Icon name="arrow" /></Link></div>;

  return <div className={`container ${styles.page}`}>
    <form className={styles.searchBar} action="/search" role="search">
      <label className={styles.field}>
        <Icon name="search" /><span className="sr-only">Search courses, colleges, exams and cities</span>
        <input type="search" name="q" defaultValue={query} placeholder="Search colleges, courses, exams or cities" maxLength={120} enterKeyHint="search" />
      </label>
      {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
      <button className="button button--primary" type="submit"><Icon name="search" />Search</button>
    </form>

    {query && !failed && <nav className={styles.tabs} aria-label="Result types">
      <ul>{SEARCH_TABS.map((item) => {
        const count = item.id === 'all' ? total : counts[item.id];
        return <li key={item.id}><Link href={tabHref(query, item.id)} aria-current={tab === item.id ? 'page' : undefined} data-empty={count === 0 || undefined}>{item.label}<span>{count}</span></Link></li>;
      })}</ul>
    </nav>}

    <div className={styles.layout}>
      <div className={styles.results}>
        {query && !failed && (tab === 'all' ? total : counts[tab]) > 0 && <p className={styles.count} role="status"><strong>{plural(tab === 'all' ? total : counts[tab], 'result')}</strong> for “{query}”{tab !== 'all' && ` in ${tab}`}</p>}
        {body}
      </div>
      <aside className={styles.side} aria-label="Search help">
        <div className={styles.sideCard}>
          <h2>Explore the catalogue</h2>
          <ul className={styles.sideLinks}>
            <li><Link href="/courses"><Icon name="book" />All courses<Icon name="arrow" /></Link></li>
            <li><Link href="/colleges"><Icon name="building" />Colleges<Icon name="arrow" /></Link></li>
            <li><Link href="/exams"><Icon name="document" />Exam guides<Icon name="arrow" /></Link></li>
            <li><Link href="/compare"><Icon name="compare" />Compare colleges<Icon name="arrow" /></Link></li>
          </ul>
        </div>
        <div className={styles.sideCard}>
          <h2><Icon name="guidesBulb" />Search tips</h2>
          <ul className={styles.sideTips}>
            <li>Course short names work best: B.Tech, MBA, BCA.</li>
            <li>A city name shows the sample colleges there.</li>
            <li>College records are illustrative samples, not a ranking.</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>;
}

function BestMatch({ course, programmes }) {
  return <section className={styles.best} aria-labelledby="best-title">
    <span className={styles.bestIcon}><Icon name={course.icon} /></span>
    <div className={styles.bestBody}>
      <p className={styles.bestEyebrow}><Icon name="guidesTarget" />Best match · Course</p>
      <h2 id="best-title"><Link href={`/courses/${course.id}`}>{course.name}</Link> <small>{course.fullName}</small></h2>
      <p>{course.summary}</p>
      <div className={styles.bestActions}>
        <Link className="button" href={`/courses/${course.id}`}>Course overview<Icon name="arrow" /></Link>
        {programmes > 0 && <Link className="button" href={`/colleges?course=${course.id}`}>See {plural(programmes, 'sample college')}</Link>}
        {programmes > 1 && <Link className="button" href={`/compare?course=${course.id}`}><Icon name="compare" />Compare</Link>}
      </div>
    </div>
  </section>;
}

function CourseCard({ course, query, programmes }) {
  const hint = !includes(course.name, query) && !includes(course.fullName, query) && (includes(course.field, query) ? 'field' : 'description');
  return <article className={styles.card}>
    <span className={styles.cardIcon}><Icon name={course.icon} /></span>
    <div className={styles.cardBody}>
      <p className={styles.cardMeta}><span className={styles.type}>Course</span><span>{highlight(course.field, query)}</span></p>
      <h3><Link href={`/courses/${course.id}`}>{highlight(course.name, query)}</Link></h3>
      {course.fullName && <p className={styles.cardSub}>{highlight(course.fullName, query)}</p>}
      <p className={styles.cardText}>{course.summary}</p>
      <div className={styles.cardFoot}>
        <span className={styles.fact}><Icon name="building" />{programmes ? plural(programmes, 'sample college') : 'No sample colleges yet'}</span>
        {hint && <span className={styles.matched}>Matched in {hint}</span>}
        {programmes > 0 && <Link className={styles.cardLink} href={`/colleges?course=${course.id}`}>Colleges<span className="sr-only"> offering {course.name}</span><Icon name="arrow" /></Link>}
      </div>
    </div>
  </article>;
}

function CollegeCard({ college, query, rows, courseName }) {
  const place = [college.city, college.state].filter(Boolean).join(', ');
  const fees = rows.map((row) => row.annualTuitionInr).filter((value) => value != null);
  const hint = !includes(college.name, query) && (includes(place, query) ? 'location' : 'courses offered');
  return <article className={styles.card}>
    {rows[0]?.art ? <CollegeArtwork row={rows[0]} className={styles.thumb} /> : <span className={styles.cardIcon}><Icon name="building" /></span>}
    <div className={styles.cardBody}>
      <p className={styles.cardMeta}><span className={styles.type}>Institution</span><Icon name="location" /><span>{highlight(place, query)}</span></p>
      <h3><Link href={`/colleges/${college.id}`}>{highlight(college.name, query)}</Link></h3>
      <ul className={styles.tags} aria-label="Courses offered">{college.courses.map((id) => <li key={id}>{courseName(id)}</li>)}</ul>
      <div className={styles.cardFoot}>
        {fees.length > 0 && <span className={styles.fact}><Icon name="coursesRupee" />{lakhRange(Math.min(...fees), Math.max(...fees))} / yr</span>}
        <span className={styles.illustrative}>Illustrative data</span>
        {hint && <span className={styles.matched}>Matched in {hint}</span>}
        <Link className={styles.cardLink} href={`/colleges/${college.id}`}>Profile<span className="sr-only">: {college.name}</span><Icon name="arrow" /></Link>
      </div>
    </div>
  </article>;
}

function ExamCard({ exam, query }) {
  return <article className={styles.card}>
    <span className={styles.cardIcon}><Icon name={exam.icon} /></span>
    <div className={styles.cardBody}>
      <p className={styles.cardMeta}><span className={styles.type}>Exam</span><span>{highlight(exam.field, query)}</span></p>
      <h3><Link href={`/exams/${exam.id}`}>{highlight(exam.name, query)}</Link></h3>
      <p className={styles.cardText}>{exam.summary}</p>
      <div className={styles.cardFoot}>
        {exam.href && <a className={styles.cardLink} href={exam.href} target="_blank" rel="noopener noreferrer">{hostname(exam.href)}<Icon name="external" /><span className="sr-only"> — {exam.name} official website (opens in a new tab)</span></a>}
        <Link className={styles.cardLink} href={`/exams/${exam.id}`}>Exam guide<span className="sr-only">: {exam.name}</span><Icon name="arrow" /></Link>
      </div>
    </div>
  </article>;
}

function Popular({ catalog }) {
  const courses = catalog.courses.filter((course) => course.popular);
  const cities = catalog.cities.filter((city) => city.featured).slice(0, 6);
  return <div className={styles.popular}>
    {courses.length > 0 && <div><h3>Popular courses</h3><ul>{courses.map((course) => <li key={course.id}><Link href={`/search?q=${encodeURIComponent(course.name)}`}><Icon name={course.icon} />{course.name}</Link></li>)}</ul></div>}
    {cities.length > 0 && <div><h3>Study cities</h3><ul>{cities.map((city) => <li key={city.name}><Link href={`/search?q=${encodeURIComponent(city.name)}`}><Icon name="location" />{city.name}</Link></li>)}</ul></div>}
  </div>;
}

function Browse({ catalog }) {
  const institutions = new Set(catalog.colleges.map((row) => row.collegeId)).size;
  const items = [
    { href: '/courses', icon: 'book', title: 'All courses', text: plural(catalog.courses.length, 'course') },
    { href: '/colleges', icon: 'building', title: 'Colleges', text: `${plural(institutions, 'sample institution')}` },
    { href: '/exams', icon: 'document', title: 'Exam guides', text: plural(catalog.exams.length, 'entrance exam') },
    { href: '/locations', icon: 'location', title: 'Destinations', text: `${plural(catalog.cities.length, 'city', 'cities')} · ${plural(catalog.states.length, 'state')}` },
  ];
  return <section className={styles.browse} aria-labelledby="browse-title">
    <h2 id="browse-title">Browse instead</h2>
    <ul>{items.map((item) => <li key={item.href}><Link href={item.href}><span className={styles.cardIcon}><Icon name={item.icon} /></span><span><strong>{item.title}</strong><small>{item.text}</small></span><Icon name="arrow" /></Link></li>)}</ul>
  </section>;
}
