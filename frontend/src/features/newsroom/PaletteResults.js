import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import UniversityMark from '@/features/apply/UniversityMark';
import { highlight as mark } from '@/features/guides/highlight';
import styles from './Search.module.css';

export const SEARCH_TABS = [
  { id: 'all', label: 'All' },
  { id: 'universities', label: 'Universities' },
  { id: 'courses', label: 'Courses' },
  { id: 'exams', label: 'Exams' },
];
const PREVIEW = 5;
// One letter matches almost everything, so it is not worth marking.
const highlight = (text, query) => (query.length > 1 ? mark(text, query) : text);
const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
const capital = (value = '') => value.charAt(0).toUpperCase() + value.slice(1);
export const tabHref = (query, tab) => `/search?${new URLSearchParams(tab === 'all' ? { q: query } : { q: query, tab })}`;

// Directory matches first (name, city, state), then catalogue colleges matched by course that the directory text search missed.
export function mergeUniversities(directory, colleges) {
  const items = [...(directory?.items || [])];
  const seen = new Set(items.map((item) => item.id));
  for (const college of colleges) if (!seen.has(college.id)) { seen.add(college.id); items.push(college); }
  const extra = items.length - (directory?.items?.length || 0);
  return { items, total: (directory?.total || 0) + extra };
}

export function TabBar({ query, tab, counts }) {
  return <nav className={styles.tabs} aria-label="Result types">
    <ul>{SEARCH_TABS.map((item) => <li key={item.id}>
      <Link href={tabHref(query, item.id)} scroll={false} aria-current={tab === item.id ? 'page' : undefined} data-empty={!counts[item.id] || undefined}>{item.label}<span>{counts[item.id]}</span></Link>
    </li>)}</ul>
  </nav>;
}

function Group({ id, title, count, more, children }) {
  return <section className={styles.group} aria-labelledby={`group-${id}`}>
    <header className={styles.groupHead}>
      <h2 id={`group-${id}`}>{title}<span>{count}</span></h2>
      {more}
    </header>
    <ul className={styles.rows}>{children}</ul>
  </section>;
}

function Row({ href, icon, title, meta, tags, action }) {
  const content = <>
    <span className={styles.rowIcon}>{icon}</span>
    <span className={styles.rowText}><strong>{title}</strong>{meta && <span className={styles.rowMeta}>{meta}</span>}</span>
    {tags}
    <Icon name="newsReturn" className={styles.rowEnter} />
  </>;
  return <li className={styles.row} data-action={action ? '' : undefined}>
    <Link className={styles.rowMain} href={href} data-palette-item>{content}</Link>
    {action && <div className={styles.rowAction}>{action}</div>}
  </li>;
}

export function UniversityRows({ items, query }) {
  return items.map((item) => {
    const place = [item.city, item.state].filter(Boolean).join(', ');
    const meta = [place, item.type && capital(item.type), item.naacGrade && `NAAC ${item.naacGrade}`].filter(Boolean).join(' · ');
    return <Row key={item.id} href={`/universities/${item.id}`} icon={<UniversityMark university={item} size="sm" />}
      title={highlight(item.name, query)} meta={highlight(meta, query)}
      tags={item.isIllustrative ? <span className={`lux-chip lux-chip--static ${styles.rowTag}`}>Illustrative</span> : null}
      action={<ApplyButton university={{ id: item.id, name: item.name, city: item.city, state: item.state, logoUrl: item.logoUrl }} variant="outline" className="lux-button--sm">Apply<span className="sr-only"> to {item.name}</span></ApplyButton>} />;
  });
}

export function CourseRows({ items, query }) {
  return items.map((course) => <Row key={course.id} href={`/courses/${course.id}`} icon={<Icon name={course.icon || 'book'} />}
    title={<>{highlight(course.name, query)}{course.fullName && <small> {highlight(course.fullName, query)}</small>}</>}
    meta={[course.field, course.level].filter(Boolean).join(' · ')} />);
}

export function ExamRows({ items, query }) {
  return items.map((exam) => <Row key={exam.id} href={`/exams/${exam.id}`} icon={<Icon name={exam.icon || 'document'} />}
    title={<>{highlight(exam.name, query)}{exam.fullName && <small> {highlight(exam.fullName, query)}</small>}</>}
    meta={[exam.field, exam.level].filter(Boolean).join(' · ') || 'Entrance exam guide'} />);
}

export function Results({ query, tab, universities, courses, exams }) {
  const groups = [
    { id: 'universities', title: 'Universities', items: universities.items, count: universities.total, render: UniversityRows,
      more: <Link className="lux-link" href={`/universities?${new URLSearchParams({ q: query })}`}>Open in directory<Icon name="arrow" /></Link> },
    { id: 'courses', title: 'Courses', items: courses, count: courses.length, render: CourseRows },
    { id: 'exams', title: 'Exams', items: exams, count: exams.length, render: ExamRows },
  ].filter((group) => (tab === 'all' || tab === group.id) && group.items.length);
  if (!groups.length) return <div className={styles.note}><Icon name="search" /><p>No {SEARCH_TABS.find((item) => item.id === tab)?.label.toLowerCase()} match “{query}”. <Link className="lux-link" href={tabHref(query, 'all')} scroll={false}>See all results<Icon name="arrow" /></Link></p></div>;
  return groups.map(({ id, title, items, count, render: Render, more }) => {
    const shown = tab === 'all' ? items.slice(0, PREVIEW) : items;
    const overflow = tab === 'all' && count > shown.length
      ? <Link className="lux-link" href={tabHref(query, id)} scroll={false}>All {count} {title.toLowerCase()}<Icon name="arrow" /></Link> : more;
    return <Group key={id} id={id} title={title} count={count} more={overflow}><Render items={shown} query={query} /></Group>;
  });
}

export function Suggestions({ catalog, heading = 'Try one of these' }) {
  const courses = catalog.courses.filter((course) => course.popular).slice(0, 6);
  const cities = catalog.cities.filter((city) => city.featured).slice(0, 6);
  const jump = [
    { href: '/universities', icon: 'building', title: 'Browse every university', meta: 'Filter by state, course, fees and approvals' },
    { href: '/courses', icon: 'book', title: 'Course guides', meta: plural(catalog.courses.length, 'course') },
    { href: '/exams', icon: 'document', title: 'Entrance exam guides', meta: plural(catalog.exams.length, 'exam') },
    { href: '/compare', icon: 'compare', title: 'Compare universities', meta: 'Fees and programmes side by side' },
  ];
  return <>
    <p className={styles.suggestHead}>{heading}</p>
    {courses.length > 0 && <Group id="popular" title="Popular courses" count={courses.length}>
      {courses.map((course) => <Row key={course.id} href={tabHref(course.name, 'all')} icon={<Icon name={course.icon || 'book'} />} title={course.name} meta={course.fullName} />)}
    </Group>}
    {cities.length > 0 && <Group id="cities" title="Study cities" count={cities.length}>
      {cities.map((city) => <Row key={city.name} href={tabHref(city.name, 'all')} icon={<Icon name="location" />} title={city.name} meta="Search universities in this city" />)}
    </Group>}
    <Group id="jump" title="Jump to" count={jump.length}>
      {jump.map((item) => <Row key={item.href} href={item.href} icon={<Icon name={item.icon} />} title={item.title} meta={item.meta} />)}
    </Group>
  </>;
}
