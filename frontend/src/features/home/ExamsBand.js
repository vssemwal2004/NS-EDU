'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandHeading } from './HomeParts';
import styles from './Home.module.css';

// Exam guides from the catalogue. No dates, cutoffs or counts: those belong to the official bulletin.
export default function ExamsBand() {
  const { exams, courses } = useCatalog();
  const { setCourse } = usePreferences();
  if (!exams.length) return null;
  return <section className={`${styles.band} ${styles.bandAlt}`} aria-labelledby="exams-title">
    <div className="container">
      <BandHeading id="exams-title" eyebrow="Entrance exams" icon="document" title="Entrance exams to know"
        description="Start from the official source, then see which courses each exam leads to."
        href="/exams" linkLabel="All exam guides" />
      <ul className={styles.examGrid}>
        {exams.slice(0, 4).map((exam) => {
          const related = courses.filter((course) => course.field === exam.field).slice(0, 3);
          return <li key={exam.id} className={styles.examCard}>
            <div className={styles.examHead}>
              <span className={styles.cardIcon}><Icon name={exam.icon} /></span>
              <div><p className={styles.examField}>{exam.field}</p><h3>{exam.name}</h3></div>
            </div>
            <p className={styles.examSummary}>{exam.summary}</p>
            {related.length > 0 && <ul className={styles.examCourses} aria-label={`Courses related to ${exam.name}`}>
              {related.map((course) => <li key={course.id}><Link href={`/colleges?course=${course.id}`} onClick={() => setCourse(course.id)}>{course.name}</Link></li>)}
            </ul>}
            <div className={styles.examActions}>
              <Link href={`/exams#${exam.id}`}>Exam guide<Icon name="arrow" /></Link>
              {exam.href && <a href={exam.href} target="_blank" rel="noopener noreferrer">Official site<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
            </div>
          </li>;
        })}
      </ul>
      <p className={styles.bandNote}><Icon name="calendar" />Dates and eligibility change every cycle — always confirm on the official site.</p>
    </div>
  </section>;
}
