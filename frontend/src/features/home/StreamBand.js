'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { fieldIcons } from '@/data/landing';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandHeading } from './HomeParts';
import { plural } from './placeCounts';
import styles from './Home.module.css';

const VISIBLE = 8;

// Fields come from the course catalogue; programme counts from the sample colleges.
export default function StreamBand() {
  const { courses, colleges } = useCatalog();
  const { setCourse } = usePreferences();
  const streams = useMemo(() => {
    const perCourse = colleges.reduce((counts, row) => counts.set(row.courseId, (counts.get(row.courseId) || 0) + 1), new Map());
    const byField = new Map();
    for (const course of courses) {
      const stream = byField.get(course.field) || { field: course.field, courses: [], programmes: 0 };
      stream.courses.push(course);
      stream.programmes += perCourse.get(course.id) || 0;
      byField.set(course.field, stream);
    }
    return [...byField.values()]
      .map((stream) => ({ ...stream, courses: stream.courses.toSorted((a, b) => (perCourse.get(b.id) || 0) - (perCourse.get(a.id) || 0)) }))
      .toSorted((a, b) => b.programmes - a.programmes || a.field.localeCompare(b.field));
  }, [courses, colleges]);
  if (!streams.length) return null;

  return <section className={styles.band} aria-labelledby="streams-title">
    <div className="container">
      <BandHeading id="streams-title" eyebrow="Study goal" icon="compass" title="Explore by stream"
        description="Pick a field, then a course — the course you choose follows you into colleges, eligibility and budget."
        href="/courses" linkLabel={`All ${streams.length} fields`} />
      <ul className={styles.streamGrid}>
        {streams.slice(0, VISIBLE).map((stream) => <li key={stream.field} className={styles.streamCard}>
          <span className={styles.cardIcon}><Icon name={fieldIcons[stream.field] || stream.courses[0].icon} /></span>
          <div className={styles.streamBody}>
            <h3><Link className={styles.stretched} href={`/courses?field=${encodeURIComponent(stream.field)}`}>{stream.field}</Link></h3>
            <p className={styles.streamMeta}>{plural(stream.courses.length, 'course')} · {stream.programmes ? plural(stream.programmes, 'sample programme') : 'Course guide only'}</p>
          </div>
          <ul className={styles.streamChips} aria-label={`${stream.field} courses`}>
            {stream.courses.slice(0, 3).map((course) => <li key={course.id}><Link href={`/colleges?course=${course.id}`} onClick={() => setCourse(course.id)}>{course.name}</Link></li>)}
          </ul>
          <Icon name="arrow" className={styles.streamArrow} />
        </li>)}
      </ul>
    </div>
  </section>;
}
