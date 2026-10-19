import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import CollegeOffers from './CollegeOffers';
import ExamTicket from './ExamTicket';
import PickLink from './PickLink';
import { LEVEL_LABEL, courseLevel, courseStats, formatLakh, formatRange, isDarkTone, lpaRange, plural, relatedCourses, relatedExams, streamTone } from './data';
import styles from './CourseDetail.module.css';
import tones from './tones.module.css';

const TOOLS = [
  { key: 'eligibility', icon: 'eligibility', title: 'Check eligibility', text: 'See what to confirm before you apply.' },
  { key: 'budget', icon: 'wallet', title: 'Plan your budget', text: 'Add hostel, travel and living costs to tuition.' },
  { key: 'compare', icon: 'compare', title: 'Compare colleges', text: 'Put up to three colleges side by side.' },
  { key: 'scholarships', icon: 'cap', title: 'Find scholarships', text: 'Official portals and the documents to prepare.' },
];

function RangeBar({ spread, format }) {
  if (!spread || spread.min === spread.max) return null;
  const at = ((spread.median - spread.min) / (spread.max - spread.min)) * 100;
  return <div className={styles.range} aria-hidden="true">
    <span className={styles.track}><i style={{ left: `${at}%` }} /></span>
    <span className={styles.ends}><span>{format(spread.min)}</span><span>{format(spread.max)}</span></span>
  </div>;
}

export default function CourseDetail({ course, catalog }) {
  const level = courseLevel(course);
  const tone = streamTone(course.field);
  const dark = isDarkTone(tone);
  const stats = courseStats(course.id, catalog.colleges);
  const { rows, programmes, institutions, cities, tuition, salary, tuitionYear, placementYear } = stats;
  const exams = relatedExams(course, catalog.exams);
  const siblings = catalog.courses.filter((item) => item.field === course.field && item.id !== course.id);
  const fieldHref = `/courses?field=${encodeURIComponent(course.field)}#all-courses`;
  const toolHref = { eligibility: `/eligibility?course=${course.id}`, budget: `/budget?course=${course.id}`, compare: `/compare?course=${course.id}`, scholarships: '/scholarships' };

  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={`${tones.tone} ${styles.masthead}`} data-tone={tone} data-dark={dark || undefined}>
      <div className={`lux-container ${styles.mastGrid}`}>
        <div className={styles.mastCopy}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <ol>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/courses">Courses</Link></li>
              <li><Link href={fieldHref}>{course.field}</Link></li>
              <li><span aria-current="page">{course.name}</span></li>
            </ol>
          </nav>
          <p className={styles.kicker}><span className={styles.glyph} aria-hidden="true"><Icon name={course.icon} /></span>{course.field}{level && <> · {LEVEL_LABEL[level]}</>}</p>
          <h1 className={styles.name}>{course.name}</h1>
          {course.fullName && <p className={styles.full}>{course.fullName}</p>}
          <p className={styles.lead}>{course.summary}</p>
          <div className={styles.actions}>
            {programmes > 0 && <a className={`lux-button ${dark ? 'lux-button--light' : 'lux-button--primary'} lux-button--lg`} href="#colleges">Colleges offering {course.name}<Icon name="arrow" /></a>}
            <PickLink course={course.id} className={`lux-button lux-button--lg ${dark ? styles.onDark : 'lux-button--outline'}`} href={toolHref.eligibility}><Icon name="eligibility" />Check eligibility</PickLink>
          </div>
        </div>

        <aside className={styles.glance} aria-labelledby="glance-title">
          <div className={styles.glanceHead}>
            <h2 id="glance-title">At a glance</h2>
            {programmes > 0 && <span className={styles.tag}>Illustrative data</span>}
          </div>
          <dl className={styles.facts}>
            <div><dt>Level</dt><dd>{level ? LEVEL_LABEL[level] : 'Not classified'}</dd></div>
            <div><dt>Listed colleges</dt><dd>{programmes ? plural(programmes, 'programme') : 'None yet'}{programmes > 0 && <small>at {plural(institutions, 'institution')} in {plural(cities, 'city', 'cities')}</small>}</dd></div>
            <div className={styles.wide}>
              <dt>Annual tuition{tuitionYear && <> · fees {tuitionYear}</>}</dt>
              <dd>{tuition ? formatRange(tuition.min, tuition.max, formatLakh) : 'No fee data yet'}{tuition && programmes > 1 && <small>median {formatLakh(tuition.median)}</small>}</dd>
              <RangeBar spread={tuition} format={formatLakh} />
            </div>
            <div className={styles.wide}>
              <dt>Median salary{salary && placementYear && <> · placements {placementYear}</>}</dt>
              <dd>{salary ? lpaRange(salary) : 'Not reported'}{salary && <small>{salary.reported} of {programmes} sample {programmes === 1 ? 'college reports' : 'colleges report'}</small>}</dd>
            </div>
          </dl>
          <p className={styles.glanceNote}>{programmes ? 'From sample institutions in the catalogue — illustrative figures, not a ranking.' : 'No sample colleges list this course yet.'}</p>
        </aside>
      </div>
    </header>

    <div className={`lux-container ${styles.body}`}>
      <section id="study" className={styles.study} aria-labelledby="study-title">
        <div className={styles.studyMain}>
          <p className="lux-eyebrow lux-eyebrow--rule">What you study</p>
          <h2 id="study-title" className="lux-display-3">Inside {course.name}</h2>
          <blockquote className={styles.quote}><p>{course.summary}</p></blockquote>
          <p className={styles.note}><Icon name="coursesInfo" />Subjects, specialisations and duration differ by institution, so this guide does not list a syllabus. Read the curriculum in each college’s official prospectus.</p>
        </div>
        <aside className={styles.side} aria-label={`More in ${course.field}`}>
          <h3 className={styles.sideTitle}>More in {course.field}</h3>
          {siblings.length ? <ul className={styles.siblings}>{siblings.map((item) => <li key={item.id}>
            <Link href={`/courses/${item.id}`}><Icon name={item.icon} /><span>{item.name}</span>{courseLevel(item) && <small>{courseLevel(item)}</small>}</Link>
          </li>)}</ul> : <p className={styles.sideText}>{course.name} is the only {course.field} course in the catalogue right now.</p>}
          <Link className="lux-link" href={fieldHref}>All {course.field} courses<Icon name="arrow" /></Link>
        </aside>
      </section>

      <section id="colleges" className={styles.block} aria-labelledby="colleges-title">
        <header className={styles.blockHead}>
          <div>
            <p className="lux-eyebrow">Colleges offering</p>
            <h2 id="colleges-title" className="lux-display-3">Where to study {course.name}</h2>
          </div>
          <p>Sample institutions with illustrative fees, salaries and demo ratings. Apply in under a minute, or pick up to three to compare.</p>
        </header>
        {programmes ? <>
          <CollegeOffers course={{ id: course.id, name: course.name }} rows={rows} />
          <div className={styles.blockLinks}>
            <PickLink course={course.id} className="lux-link" href={`/colleges?course=${course.id}`}>All {course.name} colleges and fees<Icon name="arrow" /></PickLink>
            <PickLink course={course.id} className="lux-link" href={`/budget?course=${course.id}`}>Estimate the full cost<Icon name="arrow" /></PickLink>
          </div>
        </> : <div className={`lux-state ${styles.empty}`}>
          <Icon name="building" />
          <p className="lux-title">No sample colleges list {course.name} yet</p>
          <p>Search the university directory, or check your eligibility while the catalogue grows.</p>
          <Link className="lux-button lux-button--outline" href="/universities">Search universities</Link>
        </div>}
      </section>

      <section id="exams" className={styles.block} aria-labelledby="exams-title">
        <header className={styles.blockHead}>
          <div>
            <p className="lux-eyebrow">Related exams</p>
            <h2 id="exams-title" className="lux-display-3">Entrance exams for {course.name}</h2>
          </div>
          <p>Admission routes vary — some institutions use their own tests or merit. Confirm the accepted exam on each college’s admission page.</p>
        </header>
        {exams.length ? <ul className={styles.tickets}>{exams.map((exam) => <li key={exam.id}>
          <ExamTicket exam={exam} courses={relatedCourses(exam, catalog.courses)} as="h3" />
        </li>)}</ul> : <div className={`lux-state ${styles.empty}`}>
          <Icon name="studyTicket" />
          <p className="lux-title">No exam guide is linked to {course.name}</p>
          <p>Each institution sets its own admission route — check its official admission page.</p>
          <Link className="lux-button lux-button--outline" href="/exams">Browse exam guides</Link>
        </div>}
      </section>
    </div>

    <section className={`lux-surface-dark ${styles.plan}`} aria-labelledby="plan-title">
      <div className="lux-container">
        <p className="lux-eyebrow lux-eyebrow--rule">Next steps</p>
        <h2 id="plan-title" className="lux-display-3">Plan your {course.name} shortlist</h2>
        <ul className={styles.tools}>{TOOLS.map((tool) => <li key={tool.key}>
          <PickLink course={course.id} className={styles.tool} href={toolHref[tool.key]}>
            <Icon name={tool.icon} /><strong>{tool.title}</strong><span>{tool.text}</span>
          </PickLink>
        </li>)}</ul>
      </div>
    </section>

    <section className={`lux-container ${styles.faq}`} aria-labelledby="faq-title">
      <h2 id="faq-title" className="lux-title">Before you rely on this page</h2>
      <div className={styles.faqList}>
        <details><summary>Are these real colleges?<Icon name="chevron" /></summary><p>The colleges on this page are sample institutions with illustrative fees, salaries and demo ratings, used to show how the tools work. Always rely on each institution’s official information.</p></details>
        <details><summary>Where do I confirm eligibility for {course.name}?<Icon name="chevron" /></summary><p>In the official prospectus or admission notice of each institution. The <PickLink course={course.id} href={toolHref.eligibility}>eligibility checker</PickLink> lists what to confirm.</p></details>
        <details><summary>Which entrance exam do I need?<Icon name="chevron" /></summary><p>It depends on the institution and the admission cycle. {exams.length > 0 && <>Start with {exams.map((exam, index) => <span key={exam.id}>{index > 0 && ', '}<Link href={`/exams/${exam.id}`}>{exam.name}</Link></span>)}, then confirm on </>}{exams.length ? 'each' : 'Check each'} college’s official admission page.</p></details>
      </div>
    </section>
  </main>;
}
