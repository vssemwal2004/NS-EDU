import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CourseCard from './CourseCard';
import ExamTicket from './ExamTicket';
import PickLink from './PickLink';
import { courseStats, formatLakh, plural, relatedCourses } from './data';
import styles from './ExamDetail.module.css';

const PER_COURSE = 3;
const CHECKLIST = [
  ['Read the latest information bulletin', 'It is the only source for eligibility, syllabus, exam pattern, fees and the schedule for this cycle.'],
  ['Confirm eligibility and attempt rules', 'Age, qualifying marks, subjects and attempt limits can change between cycles.'],
  ['Take dates only from the official site', 'Treat dates quoted elsewhere, including news coverage, as reminders to check — not as the source.'],
  ['Download admit cards and results only there', 'Never share login details or pay fees through links from unofficial sources.'],
];
const NOT_HERE = ['Exam dates and deadlines', 'Exam pattern and syllabus', 'Application fees', 'Cut-offs and seat numbers'];

export default function ExamDetail({ exam, catalog }) {
  const courses = relatedCourses(exam, catalog.courses).map((course) => ({ course, stats: courseStats(course.id, catalog.colleges) }));
  const withColleges = courses.filter((item) => item.stats.programmes);
  const others = catalog.exams.filter((item) => item.id !== exam.id);

  return <main id="main" tabIndex={-1} className={styles.page}>
    <section className={styles.hero} aria-label={`${exam.name} guide`}>
      <div className="lux-container">
        <nav aria-label="Breadcrumb" className={styles.crumbs}>
          <ol>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/exams">Exams</Link></li>
            <li><span aria-current="page">{exam.name}</span></li>
          </ol>
        </nav>
        <ExamTicket exam={exam} courses={courses.map((item) => item.course)} variant="hero" as="h1" />
      </div>
    </section>

    <div className={`lux-container ${styles.body}`}>
      <section className={styles.official} aria-labelledby="official-title">
        <div className={styles.officialMain}>
          <p className="lux-eyebrow lux-eyebrow--rule">Official information first</p>
          <h2 id="official-title" className="lux-display-3">Before you rely on any date</h2>
          <ol className={styles.steps}>{CHECKLIST.map(([title, text], index) => <li key={title}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div><strong>{title}</strong><p>{text}</p></div>
          </li>)}</ol>
        </div>
        <aside className={styles.notHere} aria-labelledby="not-here-title">
          <h3 id="not-here-title">Not reproduced here</h3>
          <ul>{NOT_HERE.map((item) => <li key={item}><Icon name="close" />{item}</li>)}</ul>
          <p>These change every cycle — read them in the official bulletin{exam.href ? ' on the website above' : ''}.</p>
        </aside>
      </section>

      <section className={styles.block} aria-labelledby="courses-title">
        <header className={styles.head}>
          <p className="lux-eyebrow">Related courses</p>
          <h2 id="courses-title" className="lux-display-3">Courses {exam.name} is commonly used for</h2>
          <p>General guidance — confirm each programme’s admission route in its official prospectus.</p>
        </header>
        {courses.length ? <ul className={styles.courses}>{courses.map(({ course, stats }) => <li key={course.id}><CourseCard course={course} stats={stats} /></li>)}</ul>
          : <div className={`lux-state ${styles.empty}`}>
            <Icon name="book" /><p className="lux-title">No course is linked to {exam.name} yet</p>
            <Link className="lux-button lux-button--outline" href="/courses">Browse courses</Link>
          </div>}
      </section>

      {withColleges.length > 0 && <section className={styles.block} aria-labelledby="colleges-title">
        <header className={styles.head}>
          <p className="lux-eyebrow">Sample colleges</p>
          <h2 id="colleges-title" className="lux-display-3">Colleges offering these courses</h2>
          <p>Listed because they offer a related course — not because they accept {exam.name}. Figures are illustrative; check each college’s admission page.</p>
        </header>
        <div className={styles.groups}>{withColleges.map(({ course, stats }) => <article key={course.id} className={styles.group} aria-labelledby={`group-${course.id}`}>
          <header>
            <h3 id={`group-${course.id}`}><Link href={`/courses/${course.id}#colleges`}>{course.name}</Link></h3>
            <span>{plural(stats.programmes, 'college')} · fees {stats.tuitionYear}</span>
          </header>
          <ul>{stats.rows.slice(0, PER_COURSE).map((row) => <li key={row.id}>
            <Link href={`/universities/${row.collegeId}`}>{row.name}</Link>
            <small>{[row.city, row.state].filter(Boolean).join(', ')} · {formatLakh(row.annualTuitionInr)} / year</small>
          </li>)}</ul>
          <PickLink course={course.id} className="lux-link" href={`/courses/${course.id}#colleges`}>{stats.programmes > PER_COURSE ? `All ${stats.programmes} ${course.name} colleges` : `Apply or compare ${course.name} colleges`}<Icon name="arrow" /></PickLink>
        </article>)}</div>
      </section>}

      {others.length > 0 && <nav className={styles.others} aria-labelledby="others-title">
        <h2 id="others-title" className="lux-title">Other exam guides</h2>
        <ul>{others.map((item) => <li key={item.id}><Link href={`/exams/${item.id}`}>
          <Icon name="studyTicket" /><span><strong>{item.name}</strong><small>{item.field}</small></span><Icon name="arrow" />
        </Link></li>)}</ul>
      </nav>}

      <aside className={styles.next} aria-label="Related tools">
        <Link href="/news"><Icon name="news" />Exam &amp; results news<Icon name="arrow" /></Link>
        <Link href="/admission-checklist"><Icon name="studyCalendarCheck" />Admission checklist<Icon name="arrow" /></Link>
        {courses[0] && <PickLink course={courses[0].course.id} href={`/eligibility?course=${courses[0].course.id}`}><Icon name="eligibility" />Check {courses[0].course.name} eligibility<Icon name="arrow" /></PickLink>}
      </aside>
    </div>
  </main>;
}
