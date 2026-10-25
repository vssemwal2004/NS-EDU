import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { formatCount } from '@/features/universities/labels';
import CourseInstitutions from './CourseInstitutions';
import ExamTicket from './ExamTicket';
import PickLink from './PickLink';
import { LEVEL_LABEL, courseLevel, formatLakh, formatRange, isDarkTone, plural, relatedCourses, relatedExams, streamTone } from './data';
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

export default function CourseDetail({ course, catalog, offerings = null, filters = {} }) {
  const level = courseLevel(course);
  const tone = streamTone(course.field);
  const dark = isDarkTone(tone);
  const stats = offerings?.stats ?? null;
  const institutions = stats?.institutions ?? 0;
  const annual = stats?.annualFee ?? null;
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
            {institutions > 0 && <a className={`lux-button ${dark ? 'lux-button--light' : 'lux-button--primary'} lux-button--lg`} href="#colleges">Where to study {course.name}<Icon name="arrow" /></a>}
            <PickLink course={course.id} className={`lux-button lux-button--lg ${dark ? styles.onDark : 'lux-button--outline'}`} href={toolHref.eligibility}><Icon name="eligibility" />Check eligibility</PickLink>
          </div>
        </div>

        <aside className={styles.glance} aria-labelledby="glance-title">
          <div className={styles.glanceHead}>
            <h2 id="glance-title">At a glance</h2>
            {annual && <span className={styles.tag}>Published fees</span>}
          </div>
          <dl className={styles.facts}>
            <div><dt>Level</dt><dd>{level ? LEVEL_LABEL[level] : 'Not classified'}</dd></div>
            <div><dt>Offered at</dt><dd>{institutions ? `${formatCount(institutions)} ${institutions === 1 ? 'institution' : 'institutions'}` : stats ? 'None listed yet' : '—'}{stats?.states.length > 0 && <small>in {plural(stats.states.length, 'state')} and UTs</small>}</dd></div>
            <div className={styles.wide}>
              <dt>Annual fee · median</dt>
              <dd>{annual ? formatLakh(annual.median) : 'Not published yet'}
                {annual && annual.count > 3 && <small>half of them between {formatRange(annual.p25, annual.p75, formatLakh)} a year</small>}
              </dd>
              <RangeBar spread={annual} format={formatLakh} />
            </div>
            {(stats?.annualFeePublic || stats?.annualFeePrivate) && <>
              <div><dt>Public · median</dt><dd>{stats.annualFeePublic ? formatLakh(stats.annualFeePublic.median) : '—'}{stats.annualFeePublic && <small>{plural(stats.annualFeePublic.count, 'institution')}</small>}</dd></div>
              <div><dt>Private · median</dt><dd>{stats.annualFeePrivate ? formatLakh(stats.annualFeePrivate.median) : '—'}{stats.annualFeePrivate && <small>{plural(stats.annualFeePrivate.count, 'institution')}</small>}</dd></div>
            </>}
          </dl>
          <p className={styles.glanceNote}>{annual
            ? `From the annual fees ${plural(annual.count, 'institution')} publish on their own websites. Fees change every session — confirm with the institution.`
            : institutions ? 'No institution offering this course publishes an annual fee we could read yet.' : 'No institution in the directory lists this course yet.'}</p>
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
          <p>Every institution whose own website lists {course.name}, with each programme it runs and the fee it publishes for it — per year, per semester or for the whole programme, exactly as printed.</p>
        </header>
        <CourseInstitutions course={course} offerings={offerings} filters={filters} />
        {institutions > 0 && <div className={styles.blockLinks}>
          <PickLink course={course.id} className="lux-link" href={`/universities?course=${course.id}`}>Filter {course.name} institutions in the directory<Icon name="arrow" /></PickLink>
          <PickLink course={course.id} className="lux-link" href={`/budget?course=${course.id}`}>Estimate the full cost<Icon name="arrow" /></PickLink>
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
        <details><summary>Where do these fees come from?<Icon name="chevron" /></summary><p>From each institution’s own website or fee document, linked next to every figure. Each fee is shown for the period the institution printed it for and is never converted. Fees change every session, so confirm the current figure with the institution before you pay.</p></details>
        <details><summary>Where do I confirm eligibility for {course.name}?<Icon name="chevron" /></summary><p>In the official prospectus or admission notice of each institution. The <PickLink course={course.id} href={toolHref.eligibility}>eligibility checker</PickLink> lists what to confirm.</p></details>
        <details><summary>Which entrance exam do I need?<Icon name="chevron" /></summary><p>It depends on the institution and the admission cycle. {exams.length > 0 && <>Start with {exams.map((exam, index) => <span key={exam.id}>{index > 0 && ', '}<Link href={`/exams/${exam.id}`}>{exam.name}</Link></span>)}, then confirm on </>}{exams.length ? 'each' : 'Check each'} college’s official admission page.</p></details>
      </div>
    </section>
  </main>;
}
