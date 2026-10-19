import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { formatTuition } from '@/lib/college-catalog';
import { LEVEL_LABEL, courseLevel, courseStats, examLevel, formatLakh, formatRange, hostname, lpaRange, plural, relatedCourses } from './data';
import DetailHero from './DetailHero';
import PickLink from './PickLink';
import SectionNav from './SectionNav';
import styles from './Detail.module.css';

const PER_COURSE = 3;
const CHECKLIST = [
  ['Read the latest information bulletin', 'It is the only source for eligibility, syllabus, exam pattern, fees and the schedule for this cycle.'],
  ['Confirm eligibility and attempt rules', 'Age, qualifying marks, subjects and attempt limits can change between cycles.'],
  ['Note dates only from the official site', 'Treat dates quoted elsewhere, including in news coverage, as reminders to check — not as the source.'],
  ['Download admit cards and results only from the official site', 'Never share login details or pay fees through links you received from unofficial sources.'],
];

export default function ExamDetail({ exam, catalog }) {
  const level = examLevel(exam);
  const host = hostname(exam.href);
  const courses = relatedCourses(exam, catalog.courses).map((course) => ({ course, stats: courseStats(course.id, catalog.colleges) }));
  const programmes = courses.reduce((sum, item) => sum + item.stats.programmes, 0);
  const others = catalog.exams.filter((item) => item.id !== exam.id);
  const firstWithColleges = courses.find((item) => item.stats.programmes)?.course;
  const nav = [
    { id: 'overview', label: 'Overview' },
    { id: 'official', label: 'Official source' },
    { id: 'courses', label: 'Related courses', count: courses.length },
    { id: 'colleges', label: 'Colleges', count: programmes },
    { id: 'news', label: 'News' },
  ];
  const facts = [
    { icon: exam.icon, label: 'Field', value: exam.field },
    { icon: 'coursesLevel', label: 'Admission level', value: level ? LEVEL_LABEL[level] : 'See bulletin', note: level ? 'General guide' : undefined },
    { icon: 'book', label: 'Related courses', value: courses.length || 'None yet', note: courses.length ? courses.map((item) => item.course.name).join(', ') : undefined },
    { icon: 'building', label: 'Sample colleges', value: programmes || 'None yet', note: programmes ? 'offering those courses · illustrative' : undefined },
    { icon: 'external', label: 'Official source', value: host || 'Not listed', note: host ? 'Opens the official website' : undefined },
  ];

  return <main id="main" tabIndex={-1} className={styles.page}>
    <DetailHero
      crumbs={[{ href: '/', label: 'Home' }, { href: '/exams', label: 'Exams' }, { label: exam.name }]}
      icon={exam.icon}
      eyebrow={<>{exam.field}{level && <span className={styles.heroBadge}>{LEVEL_LABEL[level]} admission</span>}</>}
      title={exam.name}
      summary={exam.summary}
      facts={facts}
      factsTitle="Exam guide at a glance"
      factsTag="No dates or fees reproduced"
      actions={<>
        {exam.href && <a className="button button--primary" href={exam.href} target="_blank" rel="noopener noreferrer">Visit official website<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
        {courses.length > 0 && <a className="button button--outline" href="#courses">Related courses</a>}
      </>}
    >
      {exam.note && <p className={styles.heroNote}><Icon name="coursesInfo" />{exam.note}</p>}
    </DetailHero>
    <SectionNav items={nav} />

    <div className={`container ${styles.body}`}>
      <section id="overview" className={styles.block} aria-labelledby="overview-title">
        <header className={styles.blockHead}><p className={styles.kicker}>01 · Overview</p><h2 id="overview-title">About this guide</h2></header>
        <div className={styles.overviewGrid}>
          <div className={styles.prose}>
            <p className={styles.lead}>{exam.summary}</p>
            <p>Gyaan Vidhya’s exam guides are starting points. They link you to the official source, show the courses the exam is commonly used for, and the sample colleges in our catalogue that offer those courses.</p>
            <p className={styles.note}><Icon name="coursesInfo" />Course links are a general guide, not a list of participating institutions. Whether a college or programme uses {exam.name} is decided by that institution for each cycle.</p>
          </div>
          <aside className={styles.sideStack} aria-label="What this guide does not include">
            <div className={styles.sideCard}>
              <h3>Not reproduced here</h3>
              <ul className={styles.crossList}>
                {['Exam dates and deadlines', 'Exam pattern and syllabus', 'Application fees', 'Cut-offs and seat numbers'].map((item) => <li key={item}><Icon name="close" />{item}</li>)}
              </ul>
              <p>These change every cycle — read them in the official bulletin.</p>
            </div>
          </aside>
        </div>
      </section>

      <section id="official" className={styles.block} aria-labelledby="official-title">
        <header className={styles.blockHead}><p className={styles.kicker}>02 · Official source</p><h2 id="official-title">Before you rely on any date</h2></header>
        <div className={styles.officialGrid}>
          <ol className={styles.checklist}>{CHECKLIST.map(([title, text], index) => <li key={title}>
            <span className={styles.step} aria-hidden="true">{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div>
          </li>)}</ol>
          <div className={styles.officialCard}>
            <Icon name="shield" />
            <p className={styles.officialEyebrow}>Official website</p>
            <p className={styles.officialHost}>{host || 'Not listed in the catalogue'}</p>
            <p>Check the address in your browser before signing in or paying anything.</p>
            {exam.href && <a className="button" href={exam.href} target="_blank" rel="noopener noreferrer">Open {host}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>
      </section>

      <section id="courses" className={styles.block} aria-labelledby="courses-title">
        <header className={styles.blockHead}>
          <p className={styles.kicker}>03 · Related courses</p>
          <h2 id="courses-title">Courses {exam.name} is commonly used for</h2>
          <p>General guidance — confirm each programme’s admission route in its official prospectus.</p>
        </header>
        {courses.length ? <ul className={styles.courseCards}>{courses.map(({ course, stats }) => <li key={course.id}>
          <Link className={styles.courseCard} href={`/courses/${course.id}`}>
            <span className={styles.examIcon}><Icon name={course.icon} /></span>
            <span className={styles.courseCardBody}>
              <span className={styles.examMeta}>{course.field}{courseLevel(course) && ` · ${LEVEL_LABEL[courseLevel(course)]}`}</span>
              <strong>{course.name}</strong>
              {course.fullName && <span className={styles.courseFull}>{course.fullName}</span>}
              <span className={styles.courseFacts}>{stats.programmes ? <>
                <span>{plural(stats.programmes, 'sample college')}</span>
                <span>{formatRange(stats.tuition.min, stats.tuition.max, formatLakh)} /yr</span>
                <span>{stats.salary ? lpaRange(stats.salary) : 'Salary not reported'}</span>
              </> : <span>No sample colleges yet</span>}</span>
            </span>
            <Icon name="arrow" />
          </Link>
        </li>)}</ul> : <div className={styles.emptyCard}>
          <Icon name="book" /><h3>No course linked to {exam.name} yet</h3><p>Browse all courses to find the programme you are interested in.</p>
          <div><Link className="button button--outline" href="/courses">Browse courses</Link></div>
        </div>}
      </section>

      <section id="colleges" className={styles.block} aria-labelledby="colleges-title">
        <header className={styles.blockHead}>
          <p className={styles.kicker}>04 · Colleges</p>
          <div className={styles.headRow}><h2 id="colleges-title">Sample colleges offering these courses</h2><span className={styles.tag}>Illustrative data</span></div>
          <p>Listed because they offer a related course — not because they accept {exam.name}. Check each college’s admission page.</p>
        </header>
        {programmes ? <div className={styles.groups}>{courses.filter((item) => item.stats.programmes).map(({ course, stats }) => <div key={course.id} className={styles.group}>
          <div className={styles.groupHead}>
            <h3><Link href={`/courses/${course.id}`}>{course.name}</Link><small>{plural(stats.programmes, 'college')}</small></h3>
            <div>
              {stats.programmes >= 2 && <PickLink course={course.id} className="text-link" href={`/compare?course=${course.id}`}><Icon name="compare" />Compare<span className="sr-only"> {course.name} colleges</span></PickLink>}
              <PickLink course={course.id} className="text-link" href={`/colleges?course=${course.id}`}>All<span className="sr-only"> {course.name} colleges</span><Icon name="arrow" /></PickLink>
            </div>
          </div>
          <ul className={styles.miniList}>{stats.rows.slice(0, PER_COURSE).map((row) => <li key={row.id}>
            <CollegeArtwork row={row} className={styles.thumb} />
            <span><Link href={`/universities/${row.collegeId}`}>{row.name}</Link><small>{[row.city, row.state].filter(Boolean).join(', ')} · {formatTuition(row.annualTuitionInr)}/yr{row.demoRating != null && ` · ${row.demoRating.toFixed(1)} demo rating`}</small></span>
          </li>)}</ul>
          {stats.programmes > PER_COURSE && <PickLink course={course.id} className="text-link" href={`/colleges?course=${course.id}`}>See all {stats.programmes} {course.name} colleges<Icon name="arrow" /></PickLink>}
        </div>)}</div> : <div className={styles.emptyCard}>
          <Icon name="building" /><h3>No sample colleges for these courses yet</h3><p>Browse every listed college instead.</p>
          <div><Link className="button button--outline" href="/colleges">Browse colleges</Link></div>
        </div>}
        {firstWithColleges && <p className={styles.footnoteLine}>Tuition shown is fees {courses.find((item) => item.stats.programmes)?.stats.tuitionYear}. <PickLink course={firstWithColleges.id} href={`/colleges?course=${firstWithColleges.id}`}>Open the college finder</PickLink> to filter by city and fee.</p>}
      </section>

      <section id="news" className={styles.block} aria-labelledby="news-title">
        <header className={styles.blockHead}><p className={styles.kicker}>05 · News &amp; next steps</p><h2 id="news-title">Stay on top of the cycle</h2></header>
        <ul className={styles.tools}>
          <li><Link className={styles.tool} href="/news"><span className={styles.toolIcon}><Icon name="news" /></span><strong>Exam &amp; results news</strong><span>Education updates, with links back to the official notices.</span><Icon name="arrow" /></Link></li>
          <li><Link className={styles.tool} href="/admission-checklist"><span className={styles.toolIcon}><Icon name="eligibility" /></span><strong>Admission checklist</strong><span>Documents and steps to prepare before you apply.</span><Icon name="arrow" /></Link></li>
          {courses[0] && <li><PickLink course={courses[0].course.id} className={styles.tool} href={`/eligibility?course=${courses[0].course.id}`}><span className={styles.toolIcon}><Icon name="coursesCheckCircle" /></span><strong>Check eligibility</strong><span>See what to confirm for {courses[0].course.name} before applying.</span><Icon name="arrow" /></PickLink></li>}
        </ul>
        {others.length > 0 && <nav className={styles.otherExams} aria-label="Other exam guides">
          <h3>Other exam guides</h3>
          <ul>{others.map((item) => <li key={item.id}><Link href={`/exams/${item.id}`}><Icon name={item.icon} />{item.name}<small>{item.field}</small></Link></li>)}</ul>
        </nav>}
      </section>
    </div>
  </main>;
}
