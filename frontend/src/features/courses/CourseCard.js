import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { LEVEL_LABEL, courseLevel, formatLakh, formatRange, plural, streamTone } from './data';
import styles from './CourseCard.module.css';
import tones from './tones.module.css';

// Course tile: stream-tinted band, then level, name, summary and the illustrative fee range. The whole card is one link.
export default function CourseCard({ course, stats, as: Heading = 'h3' }) {
  const level = courseLevel(course);
  const { programmes, tuition, tuitionYear } = stats;
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
      {programmes ? <div className={styles.foot}>
        <dl className={styles.facts}>
          <div><dt>Annual tuition</dt><dd>{formatRange(tuition.min, tuition.max, formatLakh)}</dd></div>
          <div><dt>Listed</dt><dd>{plural(programmes, 'college')}</dd></div>
        </dl>
        <p className={styles.caption}>Illustrative sample data · <span>fees {tuitionYear}</span></p>
      </div> : <p className={`${styles.foot} ${styles.empty}`}>No sample colleges listed yet</p>}
    </div>
    <span className={styles.go} aria-hidden="true"><Icon name="arrow" /></span>
  </article>;
}
