import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { hostname, plural } from './data';
import styles from './Guides.module.css';

const newTab = <span className="sr-only"> (opens in a new tab)</span>;

// Funding portals from the managed catalogue. No amounts, deadlines or "apply" actions.
export function ResourceCards({ items }) {
  if (!items.length) return <p className={styles.blockNote}>No funding portals are listed right now.</p>;
  return <>
    <ul className={styles.resources}>{items.map((item) => <li key={item.id}>
      <a className={styles.resource} href={item.href} target="_blank" rel="noopener noreferrer">
        <span className={styles.resourceIcon}><Icon name="cap" /></span>
        <span className={styles.resourceBody}><strong>{item.label}</strong><span>{item.description}</span><small><Icon name="guidesGlobe" />{hostname(item.href)}</small></span>
        <Icon name="external" />{newTab}
      </a>
    </li>)}</ul>
    <p className={styles.blockNote}>Confirm eligibility, amounts and deadlines on the provider’s own site.</p>
  </>;
}

// Courses grouped by field, each with its catalogue programme count.
export function FieldExplorer({ courses, colleges }) {
  const fields = [...new Set(courses.map((course) => course.field))].sort();
  return <div className={styles.fields}>{fields.map((field) => {
    const list = courses.filter((course) => course.field === field);
    return <div key={field} className={styles.field}>
      <h3>{field} <small>{plural(list.length, 'course')}</small></h3>
      <ul>{list.map((course) => {
        const programmes = colleges.filter((row) => row.courseId === course.id).length;
        return <li key={course.id}>
          <span className={styles.fieldIcon}><Icon name={course.icon} /></span>
          <span className={styles.fieldBody}><Link href={`/courses/${course.id}`}>{course.name}</Link><small>{course.fullName}</small></span>
          {programmes > 0 && <Link className={styles.fieldCount} href={`/colleges?course=${course.id}`}>{plural(programmes, 'sample college')}<span className="sr-only"> offering {course.name}</span></Link>}
        </li>;
      })}</ul>
    </div>;
  })}</div>;
}

// Official exam websites plus NSEDU's exam guide for each.
export function ExamLinks({ exams }) {
  return <ul className={styles.exams}>{exams.map((exam) => <li key={exam.id}>
    <span className={styles.fieldIcon}><Icon name={exam.icon} /></span>
    <span className={styles.examBody}><small>{exam.field}</small><strong>{exam.name}</strong></span>
    <span className={styles.examLinks}>
      <Link href={`/exams/${exam.id}`}>Guide<span className="sr-only"> to {exam.name}</span><Icon name="arrow" /></Link>
      {exam.href && <a href={exam.href} target="_blank" rel="noopener noreferrer">{hostname(exam.href)}<Icon name="external" /><span className="sr-only"> — {exam.name} official website (opens in a new tab)</span></a>}
    </span>
  </li>)}</ul>;
}
