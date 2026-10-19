import Form from 'next/form';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CourseCard from './CourseCard';
import { LEVEL_LABEL, courseLevel, courseStats, matchesTerms, plural, streamsOf } from './data';
import styles from './Courses.module.css';
import tones from './tones.module.css';

function coursesHref({ field = '', level = '', q = '' }, hash = '') {
  const params = new URLSearchParams();
  if (field) params.set('field', field);
  if (level) params.set('level', level);
  if (q) params.set('q', q);
  const query = params.toString();
  return `/courses${query ? `?${query}` : ''}${hash}`;
}

// Mosaic spans: the largest stream is a 2x2 tile, the next two are wide; the closing "all courses" tile
// fills whatever is left of the last row (4 columns on desktop, 2 on phones).
function mosaicLayout(streams) {
  const sizes = streams.map((_, index) => (index === 0 && streams.length >= 3 ? 'xl' : index < 3 && streams.length >= 6 ? 'wide' : 'one'));
  const desktop = sizes.reduce((sum, size) => sum + (size === 'xl' ? 4 : size === 'wide' ? 2 : 1), 0);
  const phone = sizes.reduce((sum, size) => sum + (size === 'xl' ? 2 : 1), 0);
  return { sizes, endDesktop: 4 - (desktop % 4), endPhone: 2 - (phone % 2) };
}

export default function CoursesIndex({ catalog, field, level, query }) {
  const { courses, colleges } = catalog;
  const streams = streamsOf(courses);
  const layout = mosaicLayout(streams);
  const activeField = streams.some((stream) => stream.name === field) ? field : '';
  const activeLevel = LEVEL_LABEL[level] ? level : '';
  const levels = Object.keys(LEVEL_LABEL).filter((code) => courses.some((course) => courseLevel(course) === code));
  const popular = courses.filter((course) => course.popular).slice(0, 6);

  const searched = courses.filter((course) => matchesTerms([course.name, course.fullName, course.field, course.summary, LEVEL_LABEL[courseLevel(course)]].join(' '), query));
  const inField = searched.filter((course) => !activeField || course.field === activeField);
  const visible = inField.filter((course) => !activeLevel || courseLevel(course) === activeLevel)
    .toSorted((a, b) => Number(Boolean(b.popular)) - Number(Boolean(a.popular)));
  const state = { field: activeField, level: activeLevel, q: query };
  const filtered = Boolean(activeField || activeLevel || query);

  return <main id="main" tabIndex={-1} className={styles.page}>
    <section className={styles.hero} aria-labelledby="courses-title">
      <div className={`lux-container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className="lux-eyebrow lux-eyebrow--rule">Course guide</p>
          <h1 id="courses-title" className={styles.title}>Explore courses <em>by stream</em></h1>
          <p className="lux-lead">Choose a stream, open a course, then see sample fees, the colleges that list it and the entrance exams linked to it.</p>
          {courses.length > 0 && <dl className={styles.counts}>
            <div><dt>Courses</dt><dd>{courses.length}</dd></div>
            <div><dt>Streams</dt><dd>{streams.length}</dd></div>
            {levels.length > 0 && <div><dt>Levels</dt><dd>{levels.join(' · ')}</dd></div>}
          </dl>}
          {popular.length > 0 && <nav className={styles.popular} aria-label="Popular courses">
            <p>Popular</p>
            <ul>{popular.map((course) => <li key={course.id}><Link className="lux-chip" href={`/courses/${course.id}`}>{course.name}</Link></li>)}</ul>
          </nav>}
        </div>

        {streams.length > 0 ? <nav className={styles.mosaic} aria-label="Browse by stream">
          <ul>
            {streams.map((stream, index) => {
              const active = stream.name === activeField;
              return <li key={stream.name} className={styles.cell} data-size={layout.sizes[index]}>
                <Link className={`${tones.tone} ${styles.tile}`} data-tone={stream.tone} aria-current={active ? 'true' : undefined}
                  href={coursesHref({ field: stream.name, level: activeLevel }, '#all-courses')}>
                  <span className={styles.tileIcon} aria-hidden="true"><Icon name={stream.icon} /></span>
                  <span className={styles.tileName}>{stream.name}</span>
                  <span className={styles.tileCount}>{plural(stream.courses.length, 'course')}</span>
                  <span className={styles.tileList}>{stream.courses.map((course) => course.name).join(' · ')}</span>
                </Link>
              </li>;
            })}
            <li className={`${styles.cell} ${styles.endCell}`} style={{ '--span-d': layout.endDesktop, '--span-m': layout.endPhone }}>
              <a className={styles.endTile} href="#all-courses">
                <span>See all {plural(courses.length, 'course')}</span><Icon name="arrow" />
              </a>
            </li>
          </ul>
        </nav> : <div className={`lux-state ${styles.mosaicEmpty}`} role="status">
          <Icon name="book" /><p className="lux-title">Courses are unavailable right now</p><p>Please refresh in a moment.</p>
        </div>}
      </div>
    </section>

    <section id="all-courses" className={styles.directory} aria-labelledby="all-courses-title">
      <div className="lux-container">
        <header className={styles.dirHead}>
          <div>
            <p className="lux-eyebrow">{activeField ? 'Stream' : 'Directory'}</p>
            <h2 id="all-courses-title" className="lux-display-3">{activeField ? `${activeField} courses` : 'All courses'}</h2>
          </div>
          <Form action="/courses" scroll={false} className={styles.search} role="search" aria-label="Search courses">
            {activeField && <input type="hidden" name="field" value={activeField} />}
            {activeLevel && <input type="hidden" name="level" value={activeLevel} />}
            <Icon name="search" />
            <label htmlFor="course-search" className="sr-only">Search courses</label>
            <input id="course-search" type="search" name="q" defaultValue={query} key={query} maxLength={80} placeholder="Search a course, e.g. design" autoComplete="off" enterKeyHint="search" />
            <button type="submit" className="lux-button lux-button--primary lux-button--sm">Search</button>
          </Form>
        </header>

        <div className={styles.filters}>
          <div className={styles.segmented} role="group" aria-label="Degree level">
            {['', ...levels].map((code) => {
              const count = inField.filter((course) => !code || courseLevel(course) === code).length;
              return <Link key={code || 'all'} scroll={false} href={coursesHref({ ...state, level: code })} aria-current={activeLevel === code ? 'true' : undefined}>
                <span className={styles.long}>{code ? LEVEL_LABEL[code] : 'All levels'}</span><span className={styles.short} aria-hidden="true">{code || 'All'}</span>
                <span className={styles.count}>{count}</span>
              </Link>;
            })}
          </div>
          {activeField && <Link scroll={false} className={styles.activeChip} href={coursesHref({ ...state, field: '' })}>{activeField}<Icon name="close" /><span className="sr-only">Remove stream filter</span></Link>}
          {query && <Link scroll={false} className={styles.activeChip} href={coursesHref({ ...state, q: '' })}>“{query}”<Icon name="close" /><span className="sr-only">Clear search</span></Link>}
        </div>

        <p className={styles.result} role="status">{plural(visible.length, 'course')}{activeLevel && ` · ${LEVEL_LABEL[activeLevel]}`}{activeField && ` · ${activeField}`}{query && ` · matching “${query}”`}</p>

        {visible.length ? <ul className={styles.grid}>
          {visible.map((course) => <li key={course.id}><CourseCard course={course} stats={courseStats(course.id, colleges)} /></li>)}
        </ul> : <div className={`lux-state ${styles.empty}`}>
          <Icon name="search" />
          <p className="lux-title">No courses match</p>
          <p>{courses.length ? 'Try a broader search, another stream or all levels.' : 'The course catalogue is temporarily unavailable.'}</p>
          {filtered && <Link className="lux-button lux-button--outline" scroll={false} href="/courses">Clear filters</Link>}
        </div>}

        <p className={styles.footnote}><Icon name="coursesInfo" />Levels are a general classification. Fees come from illustrative sample programmes in the catalogue, not a ranking — confirm every detail with the institution.</p>
      </div>
    </section>
  </main>;
}
