'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { courseTools } from '@/data/navigation';
import { usePreferences } from '@/providers/PreferencesProvider';
import { collegesHref, compactRupees, examHref, plural, withCourse } from './catalog-nav';
import { useCatalogNav } from './useCatalogNav';
import styles from './Mega.module.css';

// Stream rail (vertical tablist) + facets for the active stream.
export default function MegaColleges({ id, onNavigate }) {
  const { streams, courses } = useCatalogNav();
  const { course } = usePreferences();
  const [active, setActive] = useState(() => courses.find((item) => item.id === course)?.field || streams[0]?.field);
  const tabs = useRef([]);
  const dwell = useRef(0);
  useEffect(() => () => window.clearTimeout(dwell.current), []);

  const index = Math.max(0, streams.findIndex((item) => item.field === active));
  const stream = streams[index];
  if (!stream) return null;
  const courseName = (courseId) => courses.find((item) => item.id === courseId)?.name || courseId;
  const move = (next) => { const target = (next + streams.length) % streams.length; setActive(streams[target].field); tabs.current[target]?.focus(); };
  const onKeyDown = (event) => {
    const targets = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: streams.length - 1 };
    if (event.key in targets) { event.preventDefault(); move(targets[event.key]); }
  };
  // Hover switches only after a short dwell so diagonal travel to the columns does not flip streams.
  const hover = (field) => (event) => { if (event.pointerType !== 'mouse') return; window.clearTimeout(dwell.current); dwell.current = window.setTimeout(() => setActive(field), 110); };
  const unhover = () => window.clearTimeout(dwell.current);

  return <div className={`${styles.card} ${styles.collegesCard}`}>
    <div className={styles.rail}>
      <p className={styles.railTitle} id={`${id}-streams`}>Browse by stream</p>
      <div role="tablist" aria-orientation="vertical" aria-labelledby={`${id}-streams`} onKeyDown={onKeyDown}>
        {streams.map((item, position) => {
          const selected = item.field === stream.field;
          return <button key={item.id} ref={(node) => { tabs.current[position] = node; }} type="button" role="tab" id={`${id}-tab-${item.id}`} aria-selected={selected} aria-controls={`${id}-stream`} tabIndex={selected ? 0 : -1}
            className={styles.railTab} onClick={() => setActive(item.field)} onPointerEnter={hover(item.field)} onPointerLeave={unhover}>
            <span className={styles.railIcon}><Icon name={item.icon} /></span>
            <span className={styles.railText}><strong>{item.field}</strong><small>{plural(item.count, 'programme')}</small></span>
            <Icon name="chevron" className={styles.railChevron} />
          </button>;
        })}
      </div>
    </div>

    <div role="tabpanel" id={`${id}-stream`} aria-labelledby={`${id}-tab-${stream.id}`} className={styles.stream}>
      <div className={styles.streamHead}>
        <div>
          <p className={styles.kicker}>Stream</p>
          <p className={styles.streamTitle}>{stream.field} colleges</p>
        </div>
        <dl className={styles.stats}>
          <div><dt>Programmes</dt><dd>{stream.count}</dd></div>
          <div><dt>Cities</dt><dd>{stream.cities.length}</dd></div>
          {stream.fees && <div><dt>Tuition / year</dt><dd>{stream.fees[0] === stream.fees[1] ? compactRupees(stream.fees[0]) : `${compactRupees(stream.fees[0])}–${compactRupees(stream.fees[1])}`}</dd></div>}
          {stream.salary && <div><dt>Median salary</dt><dd>{stream.salary[0] === stream.salary[1] ? `₹${stream.salary[0]} LPA` : `₹${stream.salary[0]}–${stream.salary[1]} LPA`}</dd></div>}
        </dl>
        <span className={styles.illustrative}><Icon name="spark" />Illustrative data</span>
      </div>

      <div className={styles.columns}>
        <div className={styles.column}>
          <p className={styles.label} id={`${id}-courses`}>Courses</p>
          <ul aria-labelledby={`${id}-courses`} className={styles.rows}>
            {stream.courses.map((item) => <li key={item.id}><Link href={collegesHref(item.id)} onClick={onNavigate} className={styles.row}>
              <Icon name={item.icon} /><span><strong>{item.name} colleges</strong>{item.fullName && <small>{item.fullName}</small>}</span><em>{item.count}<span className="sr-only"> {item.count === 1 ? 'programme' : 'programmes'}</span></em>
            </Link></li>)}
          </ul>
          <p className={styles.label} id={`${id}-cities`}>{stream.field} by city</p>
          <ul aria-labelledby={`${id}-cities`} className={styles.rows}>
            {stream.cities.map((city) => <li key={city.name}><Link href={collegesHref(city.courseId, city.name)} onClick={onNavigate} className={styles.row}>
              <Icon name="location" /><span><strong>{city.name}</strong><small>{city.courseIds.map(courseName).join(', ')}{city.state ? ` · ${city.state}` : ''}</small></span><em>{city.count}<span className="sr-only"> {city.count === 1 ? 'programme' : 'programmes'}</span></em>
            </Link></li>)}
          </ul>
        </div>

        <div className={styles.column}>
          <p className={styles.label} id={`${id}-programmes`}>Programmes to explore</p>
          <ul aria-labelledby={`${id}-programmes`} className={styles.programmes}>
            {stream.programmes.slice(0, 4).map((row) => <li key={row.id}><Link href={collegesHref(row.courseId, row.city)} onClick={onNavigate} className={styles.programme}>
              <span className={styles.thumb} aria-hidden="true"><CollegeArtwork row={row} /></span>
              <span><strong>{row.name}</strong><small>{courseName(row.courseId)} · {row.city}</small></span>
              <span className={styles.rating} title="Demo rating, not a review score"><Icon name="star" />{row.demoRating.toFixed(1)}<span className="sr-only"> demo rating</span></span>
            </Link></li>)}
          </ul>
          {/* The colleges page filters by one course, so the link names that course rather than the stream total. */}
          {stream.programmes.length > 4 && <Link className={styles.more} href={collegesHref(stream.topCourse)} onClick={onNavigate}>All {courseName(stream.topCourse)} colleges<Icon name="arrow" /></Link>}
          <p className={styles.fineprint}>Fictional sample institutions. Ratings are demo values, not reviews.</p>
        </div>

        <div className={styles.column}>
          <p className={styles.label} id={`${id}-exams`}>Entrance exams</p>
          {stream.exams.length ? <ul aria-labelledby={`${id}-exams`} className={styles.rows}>
            {stream.exams.map((exam) => <li key={exam.id}><Link href={examHref(exam.id)} onClick={onNavigate} className={styles.row}>
              <Icon name={exam.icon} /><span><strong>{exam.name}</strong><small>Exam guide and official links</small></span><Icon name="arrow" className={styles.rowArrow} />
            </Link></li>)}
          </ul> : <p className={styles.note}>Admission routes for {stream.field.toLowerCase()} vary by institution. Check each programme&rsquo;s official requirements. <Link href="/exams" onClick={onNavigate}>All exam guides</Link></p>}
          <p className={styles.label} id={`${id}-tools`}>Plan with tools</p>
          <ul aria-labelledby={`${id}-tools`} className={styles.rows}>
            {courseTools.map((tool) => <li key={tool.href}><Link href={withCourse(tool.href, stream.topCourse)} onClick={onNavigate} className={styles.row}>
              <Icon name={tool.icon} /><span><strong>{tool.label}</strong><small>{tool.description} · {courseName(stream.topCourse)}</small></span>
            </Link></li>)}
          </ul>
        </div>
      </div>

      <div className={styles.panelFoot}>
        <Link href={`/courses?field=${encodeURIComponent(stream.field)}`} onClick={onNavigate} className={styles.footLink}>All {stream.field} courses<Icon name="arrow" /></Link>
        <Link href="/locations" onClick={onNavigate} className={styles.footLink}>Browse all locations<Icon name="arrow" /></Link>
        <p>Counts from NSEDU&rsquo;s illustrative catalogue</p>
      </div>
    </div>
  </div>;
}
