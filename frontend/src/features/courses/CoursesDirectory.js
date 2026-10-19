'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { LEVEL_LABEL, courseLevel, courseStats, formatLakh, formatRange, lpaRange, plural } from './data';
import { FieldChips, LevelBadge, SearchBox, syncUrl } from './Filters';
import styles from './Listing.module.css';

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'az', label: 'A–Z' },
  { value: 'colleges', label: 'Most colleges listed' },
  { value: 'tuition', label: 'Lowest starting tuition' },
];
const LEVELS = [{ value: '', label: 'All levels', short: 'All' }, { value: 'UG', label: LEVEL_LABEL.UG, short: 'UG' }, { value: 'PG', label: LEVEL_LABEL.PG, short: 'PG' }];

function matches(course, terms) {
  const text = [course.name, course.fullName, course.field, course.summary, LEVEL_LABEL[courseLevel(course)]].join(' ').toLowerCase();
  return terms.every((term) => text.includes(term));
}

export default function CoursesDirectory({ initialField = '', initialLevel = '', initialQuery = '', initialSort = 'featured' }) {
  const { courses, colleges } = useCatalog();
  const { setCourse } = usePreferences();
  const [field, setField] = useState(initialField);
  const [level, setLevel] = useState(LEVEL_LABEL[initialLevel] ? initialLevel : '');
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState(SORTS.some((item) => item.value === initialSort) ? initialSort : 'featured');

  const stats = useMemo(() => Object.fromEntries(courses.map((course) => [course.id, courseStats(course.id, colleges)])), [courses, colleges]);
  const fields = useMemo(() => [...new Set(courses.map((course) => course.field))].sort(), [courses]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searched = courses.filter((course) => matches(course, terms));
  const inLevel = searched.filter((course) => !level || courseLevel(course) === level);
  const inField = searched.filter((course) => !field || course.field === field);
  const visible = inLevel.filter((course) => !field || course.field === field);

  const comparators = {
    featured: (a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)),
    az: (a, b) => a.name.localeCompare(b.name),
    colleges: (a, b) => stats[b.id].programmes - stats[a.id].programmes,
    tuition: (a, b) => (stats[a.id].tuition?.min ?? Infinity) - (stats[b.id].tuition?.min ?? Infinity),
  };
  const sorted = visible.toSorted(comparators[sort]);
  const active = Boolean(field || level || query.trim() || sort !== 'featured');

  function update(patch) {
    if ('field' in patch) setField(patch.field);
    if ('level' in patch) setLevel(patch.level);
    if ('q' in patch) setQuery(patch.q);
    if ('sort' in patch) setSort(patch.sort);
    syncUrl(Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, key === 'sort' && value === 'featured' ? '' : String(value).trim()])));
  }
  const clear = () => update({ field: '', level: '', q: '', sort: 'featured' });

  const fieldCounts = fields.map((name) => ({ value: name, label: name, count: inLevel.filter((course) => course.field === name).length }));
  const summary = [plural(sorted.length, 'course'), level && LEVEL_LABEL[level], field, query.trim() && `“${query.trim()}”`].filter(Boolean).join(' · ');

  return <section className={`container ${styles.section}`} aria-label="Course directory">
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        <SearchBox label="Search courses" value={query} placeholder="Search a course or field, e.g. design" onChange={(value) => update({ q: value })} />
        <div className={styles.segmented} role="group" aria-label="Degree level">
          {LEVELS.map((item) => {
            const count = inField.filter((course) => !item.value || courseLevel(course) === item.value).length;
            return <button key={item.value || 'all'} type="button" aria-pressed={level === item.value} onClick={() => update({ level: item.value })}>
              <span className={styles.segmentLong}>{item.label}</span><span className={styles.segmentShort} aria-hidden="true">{item.short}</span><span className={styles.count}>{count}</span>
            </button>;
          })}
        </div>
      </div>
      <FieldChips label="Filter by field" value={field} total={inLevel.length} items={fieldCounts} onChange={(value) => update({ field: value })} />
    </div>

    <div className={styles.resultBar}>
      <p role="status" className={styles.resultText}><strong>{summary}</strong></p>
      {active && <button type="button" className={styles.clear} onClick={clear}><Icon name="close" />Clear all</button>}
      <label className={styles.sort}><span>Sort by</span><select value={sort} onChange={(event) => update({ sort: event.target.value })}>{SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Icon name="chevron" /></label>
    </div>

    {sorted.length ? <ul className={styles.grid} aria-label="Courses">{sorted.map((course) => <li key={course.id} className={styles.card}>
      <CourseCard course={course} stats={stats[course.id]} onPick={() => setCourse(course.id)} />
    </li>)}</ul> : <div className={styles.empty}>
      <Icon name="search" /><h2>No courses match these filters</h2>
      <p>{field && level ? `There are no ${LEVEL_LABEL[level].toLowerCase()} ${field} courses in the catalogue yet.` : 'Try a broader search, another field or all levels.'}</p>
      <button type="button" className="button button--outline" onClick={clear}>Clear filters</button>
    </div>}
    <p className={styles.footnote}><Icon name="coursesInfo" />Levels are a general classification. Fees and salaries are illustrative sample figures from the catalogue (fees 2026–27, placements 2024–25) — confirm details with each institution.</p>
  </section>;
}

function CourseCard({ course, stats, onPick }) {
  const level = courseLevel(course);
  const { programmes, tuition, salary } = stats;
  return <>
    <div className={styles.cardHead}>
      <span className={styles.cardIcon}><Icon name={course.icon} /></span>
      <div className={styles.cardTitle}>
        <p className={styles.cardMeta}><span>{course.field}</span>{level && <LevelBadge level={level} />}{course.popular && <span className={styles.featured}><Icon name="star" />Featured</span>}</p>
        <h2>{course.name}</h2>
        {course.fullName && <p className={styles.cardSub}>{course.fullName}</p>}
      </div>
    </div>
    <p className={styles.cardText}>{course.summary}</p>
    {programmes ? <div className={styles.cardData}>
      <dl className={styles.stats}>
        <div><dt>Sample colleges</dt><dd>{programmes}</dd></div>
        <div><dt>Annual tuition</dt><dd>{formatRange(tuition.min, tuition.max, formatLakh)}</dd></div>
        <div><dt>Median salary</dt><dd>{salary ? lpaRange(salary) : 'Not reported'}{salary && salary.reported < programmes && <small>{salary.reported} of {programmes} report</small>}</dd></div>
      </dl>
      <p className={styles.caption}>Illustrative data · fees {stats.tuitionYear}</p>
    </div> : <div className={styles.cardData}><p className={styles.noData}><Icon name="building" />No sample colleges listed yet</p></div>}
    <div className={styles.cardActions}>
      <Link className="button button--primary" href={`/courses/${course.id}`} onClick={onPick}>View course<Icon name="arrow" /></Link>
      {programmes ? <Link className="button button--outline" href={`/colleges?course=${course.id}`} onClick={onPick}>Colleges<span className="sr-only"> offering {course.name}</span></Link> : <span className={styles.muted}>No colleges yet</span>}
    </div>
  </>;
}
