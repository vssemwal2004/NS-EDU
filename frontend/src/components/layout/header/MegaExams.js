'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { collegesHref, examHref } from './catalog-nav';
import { useCatalogNav } from './useCatalogNav';
import styles from './Mega.module.css';

// Entrance exams grouped by stream. Only the guide page and the official site
// exist, so no syllabus/date sub-links are offered.
export default function MegaExams({ id, onNavigate }) {
  const { exams } = useCatalog();
  const { courses } = useCatalogNav();
  const fields = [...new Set(exams.map((exam) => exam.field))];

  return <div className={`${styles.card} ${styles.examsCard}`}>
    <div className={styles.examsMain}>
      <div className={styles.coursesHead}>
        <p className={styles.kicker}>Entrance exams</p>
        <p className={styles.streamTitle}>Exam guides by stream</p>
        <p className={styles.headMeta}>Always confirm dates and eligibility on the official exam website.</p>
      </div>
      <div className={styles.examGrid}>
        {fields.map((field) => <section key={field} className={styles.examGroup} aria-labelledby={`${id}-${field}`}>
          <p className={styles.label} id={`${id}-${field}`}>{field}</p>
          {exams.filter((exam) => exam.field === field).map((exam) => {
            const related = courses.filter((course) => course.field === exam.field && course.count);
            return <article key={exam.id} className={styles.exam}>
              <div className={styles.examTop}>
                <span className={styles.examIcon}><Icon name={exam.icon} /></span>
                <Link href={examHref(exam.id)} onClick={onNavigate} className={styles.examName}>{exam.name}</Link>
              </div>
              <p className={styles.examSummary}>{exam.summary}</p>
              {related.length > 0 ? <div className={styles.examRelated}>
                <span>{field} courses on Gyaan Vidhya</span>
                <ul>{related.map((course) => <li key={course.id}><Link href={collegesHref(course.id)} onClick={onNavigate}>{course.name}</Link></li>)}</ul>
              </div> : <p className={styles.examHint}>Check the official site for participating universities and programmes.</p>}
              <div className={styles.examLinks}>
                <Link href={examHref(exam.id)} onClick={onNavigate}>Exam guide<Icon name="arrow" /><span className="sr-only"> for {exam.name}</span></Link>
                {exam.href && <a href={exam.href} target="_blank" rel="noopener noreferrer">Official site<Icon name="external" /><span className="sr-only"> for {exam.name} (opens in a new tab)</span></a>}
              </div>
            </article>;
          })}
        </section>)}
      </div>
    </div>
    <aside className={styles.side} aria-label="Exam updates">
      <Link className={styles.feature} href="/news" onClick={onNavigate}>
        <span className={styles.featureEyebrow}>Stay updated</span>
        <strong>Education news</strong>
        <span>Admissions, results and policy updates from trusted publishers.</span>
        <span className={styles.featureAction}>Read the latest<Icon name="arrow" /></span>
      </Link>
      <Link className={styles.sideLink} href="/eligibility" onClick={onNavigate}>
        <Icon name="eligibility" /><span><strong>Check eligibility</strong><small>Marks and subject requirements</small></span>
      </Link>
    </aside>
    <div className={`${styles.panelFoot} ${styles.panelFootWide}`}>
      <Link href="/exams" onClick={onNavigate} className={styles.footLink}>All exam guides<Icon name="arrow" /></Link>
      <p>Gyaan Vidhya links to official exam websites. It does not publish exam dates or cutoffs.</p>
    </div>
  </div>;
}
