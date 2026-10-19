import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { LEVEL_LABEL, examLevel, hostname } from './data';
import styles from './ExamTicket.module.css';

// Boarding-pass card: exam details on the pass, the official website on the tear-off stub (the primary action).
// variant 'hero' is the exam page header: h1 title and a dark stub with the gold CTA.
export default function ExamTicket({ exam, courses = [], variant = 'card', as: Heading = 'h2' }) {
  const level = examLevel(exam);
  const host = hostname(exam.href);
  const hero = variant === 'hero';
  const titleId = `${exam.id}-ticket-title`;
  return <div className={styles.frame} data-variant={variant}>
    <article className={styles.ticket} id={hero ? undefined : exam.id} aria-labelledby={titleId}>
      <div className={styles.pass}>
        <p className={styles.kicker}><Icon name="studyTicket" />Entrance exam guide</p>
        <Heading id={titleId} className={styles.name}>{exam.name}</Heading>
        <dl className={styles.fields}>
          <div><dt>Stream</dt><dd>{exam.field}</dd></div>
          <div><dt>Admission</dt><dd>{level ? LEVEL_LABEL[level] : 'See bulletin'}</dd></div>
          <div><dt>Dates &amp; fees</dt><dd>Official bulletin</dd></div>
        </dl>
        <p className={styles.summary}>{exam.summary}</p>
        {exam.note && <p className={styles.note}><Icon name="coursesInfo" />{exam.note}</p>}
        {courses.length > 0 && <div className={styles.route}>
          <p id={`${titleId}-courses`}>Commonly used for</p>
          <ul aria-labelledby={`${titleId}-courses`}>{courses.map((course) => <li key={course.id}><Link href={`/courses/${course.id}`}>{course.name}</Link></li>)}</ul>
        </div>}
      </div>
      <div className={styles.stub}>
        <p className={styles.stubLabel}><Icon name="shield" />Official website</p>
        <p className={styles.host}>{host || 'Not listed in the catalogue'}</p>
        {exam.href && <a className={`lux-button ${hero ? 'lux-button--gold lux-button--lg' : 'lux-button--primary'} lux-button--block`} href={exam.href} target="_blank" rel="noopener noreferrer">
          Visit official website<Icon name="external" /><span className="sr-only"> for {exam.name} (opens in a new tab)</span>
        </a>}
        {hero ? <p className={styles.stubNote}>Check the address in your browser before you sign in or pay anything.</p>
          : <Link className={`lux-link ${styles.guide}`} href={`/exams/${exam.id}`}>Read the guide<span className="sr-only">: {exam.name}</span><Icon name="arrow" /></Link>}
      </div>
    </article>
  </div>;
}
