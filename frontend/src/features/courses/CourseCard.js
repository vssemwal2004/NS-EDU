import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatCount } from '@/features/universities/labels';
import { LEVEL_LABEL, courseLevel, streamTone } from './data';
import styles from './CourseCard.module.css';
import tones from './tones.module.css';

// Course tile: stream-tinted band, then level, name, summary and how many institutions in the
// directory list the course on their own websites. The whole card is one link.
export default function CourseCard({ course, institutions = 0, as: Heading = 'h3' }) {
  const level = courseLevel(course);
  return <article className={`${tones.tone} ${styles.card}`} data-tone={streamTone(course.field)}>
    <div className={styles.band} aria-hidden="true">
      <span className={styles.glyph}><Icon name={course.icon} /></span>
      {level && <span className={styles.code}>{level}</span>}
    </div>
    <div className={styles.body}>
      <p className={styles.meta}>
        <span>{course.field}</span>
        {level && <span className={styles.level}>{LEVEL_LABEL[level]}</span>}
        {course.popular && <span className={styles.featured}><Icon name="star" />Featured</span>}
      </p>
      <Heading className={styles.name}><Link className={styles.stretch} href={`/courses/${course.id}`}>{course.name}</Link></Heading>
      {course.fullName && <p className={styles.full}>{course.fullName}</p>}
      <p className={styles.summary}>{course.summary}</p>
      {institutions > 0 ? <div className={styles.foot}>
        <dl className={styles.facts}>
          <div><dt>Offered at</dt><dd>{formatCount(institutions)} {institutions === 1 ? 'institution' : 'institutions'}</dd></div>
        </dl>
        <p className={styles.caption}>Fees and programmes on the course page</p>
      </div> : <p className={`${styles.foot} ${styles.empty}`}>No institution lists it yet</p>}
    </div>
    <span className={styles.go} aria-hidden="true"><Icon name="arrow" /></span>
  </article>;
}
