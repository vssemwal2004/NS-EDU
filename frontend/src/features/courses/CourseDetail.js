import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { LEVEL_LABEL, courseLevel, courseStats, examLevel, formatLakh, formatLpa, formatRange, hostname, lpaRange, plural, relatedExams } from './data';
import CollegesTable from './CollegesTable';
import DetailHero from './DetailHero';
import FeeBars from './FeeBars';
import PickLink from './PickLink';
import SectionNav from './SectionNav';
import styles from './Detail.module.css';

export default function CourseDetail({ course, catalog }) {
  const level = courseLevel(course.id);
  const stats = courseStats(course.id, catalog.colleges);
  const { rows, programmes, institutions, tuition, salary, tuitionYear, placementYear } = stats;
  const exams = relatedExams(course, catalog.exams);
  const siblings = catalog.courses.filter((item) => item.field === course.field && item.id !== course.id);
  const years = [tuitionYear && `fees ${tuitionYear}`, placementYear && `placements ${placementYear}`].filter(Boolean).join(', ');
  const nav = [
    { id: 'overview', label: 'Overview' },
    { id: 'colleges', label: 'Colleges offering', count: programmes },
    { id: 'fees', label: 'Fees & placements' },
    { id: 'exams', label: 'Related exams', count: exams.length },
    { id: 'next', label: 'Next steps' },
  ];

  const facts = [
    { icon: 'coursesLevel', label: 'Level', value: level ? LEVEL_LABEL[level] : 'Not classified', note: level ? 'General classification' : 'Check with the institution' },
    { icon: course.icon, label: 'Field', value: course.field },
    { icon: 'building', label: 'Colleges listed', value: programmes ? plural(programmes, 'programme') : 'None yet', note: programmes ? `at ${plural(institutions, 'institution')}` : 'No sample colleges yet' },
    { icon: 'coursesRupee', label: 'Annual tuition', value: tuition ? formatRange(tuition.min, tuition.max, formatLakh) : '—', note: tuition ? `median ${formatLakh(tuition.median)} · ${tuitionYear}` : 'No fee data yet' },
    { icon: 'trend', label: 'Median salary', value: salary ? lpaRange(salary) : 'Not reported', note: programmes ? `${salary?.reported || 0} of ${programmes} report · ${placementYear}` : 'No placement data yet' },
  ];

  return <main id="main" tabIndex={-1} className={styles.page}>
    <DetailHero
      crumbs={[{ href: '/', label: 'Home' }, { href: '/courses', label: 'Courses' }, { label: course.name }]}
      icon={course.icon}
      eyebrow={<>{course.field}{level && <span className={styles.heroBadge}>{LEVEL_LABEL[level]}</span>}</>}
      title={course.name}
      subtitle={course.fullName}
      summary={course.summary}
      facts={facts}
      factsTag="Illustrative data"
      actions={<>
        {programmes > 0 && <a className="button button--primary" href="#colleges">Colleges offering {course.name}<Icon name="arrow" /></a>}
        <PickLink course={course.id} className="button button--outline" href={`/eligibility?course=${course.id}`}><Icon name="eligibility" />Check eligibility</PickLink>
      </>}
    />
    <SectionNav items={nav} />

    <div className={`container ${styles.body}`}>
      <section id="overview" className={styles.block} aria-labelledby="overview-title">
        <header className={styles.blockHead}><p className={styles.kicker}>01 · Overview</p><h2 id="overview-title">About {course.name} on NSEDU</h2></header>
        <div className={styles.overviewGrid}>
          <div className={styles.prose}>
            <p className={styles.lead}>{course.summary}</p>
            <h3>What NSEDU lists for {course.name}</h3>
            <ul className={styles.checks}>
              {programmes ? <>
                <li><Icon name="coursesCheckCircle" />{plural(programmes, 'sample programme')} at {plural(institutions, 'institution')} across {plural(stats.cities, 'city', 'cities')}.</li>
                <li><Icon name="coursesCheckCircle" />Annual tuition from {formatLakh(tuition.min)} to {formatLakh(tuition.max)} (median {formatLakh(tuition.median)}, fees {tuitionYear}).</li>
                <li><Icon name="coursesCheckCircle" />{salary ? `Median salary reported by ${salary.reported} of ${programmes}, ranging ${lpaRange(salary)} (placements ${placementYear}).` : 'No sample college reports placement salaries for this course.'}</li>
              </> : <li><Icon name="coursesInfo" />No sample colleges are listed for this course yet.</li>}
              <li><Icon name="coursesCheckCircle" />{exams.length ? `${plural(exams.length, 'exam guide')} linked: ${exams.map((exam) => exam.name).join(', ')}.` : 'No exam guide is linked yet — admission routes vary by institution.'}</li>
            </ul>
            <p className={styles.note}><Icon name="coursesInfo" />All institutions are fictional sample records used to demonstrate the tools. Figures are illustrative, not a ranking.</p>
          </div>
          <aside className={styles.sideStack} aria-label="Related">
            <div className={styles.sideCard}>
              <h3>Entry requirements</h3>
              <p>Eligibility, subjects and minimum marks differ by institution and by admission cycle. Check yours against the official prospectus.</p>
              <PickLink course={course.id} className="text-link" href={`/eligibility?course=${course.id}`}>Check {course.name} eligibility<Icon name="arrow" /></PickLink>
            </div>
            <div className={styles.sideCard}>
              <h3>More in {course.field}</h3>
              {siblings.length ? <ul className={styles.pillList}>{siblings.map((item) => <li key={item.id}><Link href={`/courses/${item.id}`}><Icon name={item.icon} />{item.name}{courseLevel(item.id) && <small>{courseLevel(item.id)}</small>}</Link></li>)}</ul>
                : <p>{course.name} is the only {course.field} course in the catalogue right now.</p>}
              <Link className="text-link" href={`/courses?field=${encodeURIComponent(course.field)}`}>All {course.field} courses<Icon name="arrow" /></Link>
            </div>
          </aside>
        </div>
      </section>

      <section id="colleges" className={styles.block} aria-labelledby="colleges-title">
        <header className={styles.blockHead}>
          <p className={styles.kicker}>02 · Colleges offering</p>
          <div className={styles.headRow}><h2 id="colleges-title">Sample colleges offering {course.name}</h2><span className={styles.tag}>Illustrative data</span></div>
          <p>Open a college for its full profile, or add up to three to compare side by side. No ranks — the catalogue has no ranking data.</p>
        </header>
        {programmes ? <>
          <CollegesTable course={{ id: course.id, name: course.name }} rows={rows} />
          <div className={styles.blockActions}>
            {programmes >= 2 && <PickLink course={course.id} className="button button--primary" href={`/compare?course=${course.id}`}><Icon name="compare" />Compare side by side</PickLink>}
            <PickLink course={course.id} className="button button--ghost" href={`/colleges?course=${course.id}`}>All {course.name} colleges<Icon name="arrow" /></PickLink>
          </div>
        </> : <div className={styles.emptyCard}>
          <Icon name="building" /><h3>No sample colleges listed for this course yet</h3>
          <p>Browse every listed college, or check your eligibility while the catalogue grows.</p>
          <div><Link className="button button--outline" href="/colleges">Browse colleges</Link><PickLink course={course.id} className="text-link" href={`/eligibility?course=${course.id}`}>Check eligibility<Icon name="arrow" /></PickLink></div>
        </div>}
      </section>

      <section id="fees" className={styles.block} aria-labelledby="fees-title">
        <header className={styles.blockHead}>
          <p className={styles.kicker}>03 · Fees &amp; placements</p>
          <div className={styles.headRow}><h2 id="fees-title">How the sample figures spread</h2>{years && <span className={styles.tag}>Illustrative · {years}</span>}</div>
          <p>Every bar is one sample programme. Tuition is the annual fee only — use the budget planner for hostel, travel and living costs.</p>
        </header>
        {programmes > 1 ? <div className={styles.chartGrid}>
          <FeeBars id="tuition-chart" title="Annual tuition by college" rows={rows} value={(row) => row.annualTuitionInr} format={formatLakh} scale={(v) => (v ? formatLakh(v) : '₹0')}
            medianValue={tuition.median} medianLabel={`median ${formatLakh(tuition.median)}`}
            summary={`Tuition ranges from ${formatLakh(tuition.min)} to ${formatLakh(tuition.max)} a year across ${programmes} sample colleges; median ${formatLakh(tuition.median)} (fees ${tuitionYear}).`} />
          <FeeBars id="salary-chart" tone="taupe" title="Median salary by college" rows={rows} value={(row) => row.medianSalaryLpa} format={formatLpa} scale={(v) => (v ? formatLpa(v) : '₹0')}
            medianValue={salary?.median} medianLabel={salary ? `median ${formatLpa(salary.median)}` : ''}
            summary={salary ? `${salary.reported} of ${programmes} sample colleges report a median salary, from ${lpaRange(salary)} (placements ${placementYear}).` : `None of the ${programmes} sample colleges report placement salaries for ${course.name}.`} />
        </div> : programmes === 1 ? <div className={styles.singleStats}>
          <div><span>Annual tuition</span><strong>{formatLakh(tuition.min)}</strong><small>{rows[0].shortName} · fees {tuitionYear}</small></div>
          <div><span>Median salary</span><strong>{formatLpa(rows[0].medianSalaryLpa)}</strong><small>{rows[0].shortName} · placements {placementYear}</small></div>
          <div><span>Highest salary</span><strong>{formatLpa(rows[0].highestSalaryLpa)}</strong><small>Only one sample college lists {course.name}, so there is no spread to chart.</small></div>
        </div> : <p className={styles.note}><Icon name="coursesInfo" />No fee or placement figures yet — there are no sample colleges for this course.</p>}
        <div className={styles.inlineCta}>
          <span><Icon name="wallet" />Tuition is only part of the cost.</span>
          <PickLink course={course.id} className="text-link" href={`/budget?course=${course.id}`}>Estimate the full cost<Icon name="arrow" /></PickLink>
        </div>
      </section>

      <section id="exams" className={styles.block} aria-labelledby="exams-title">
        <header className={styles.blockHead}>
          <p className={styles.kicker}>04 · Related exams</p>
          <h2 id="exams-title">Entrance exams linked to {course.name}</h2>
          <p>Admission routes vary by institution; some use their own tests or merit. Confirm the accepted exam on each college’s official admission page.</p>
        </header>
        {exams.length ? <div className={styles.examList}>{exams.map((exam) => <ExamCard key={exam.id} exam={exam} />)}</div>
          : <div className={styles.emptyCard}>
            <Icon name="document" /><h3>No exam guide linked to {course.name} yet</h3>
            <p>Each institution sets its own admission route — check its official admission page.</p>
            <div><Link className="button button--outline" href="/admission-checklist">Admission checklist</Link><Link className="text-link" href="/news">Exam &amp; results news<Icon name="arrow" /></Link></div>
          </div>}
      </section>

      <section id="next" className={styles.block} aria-labelledby="next-title">
        <header className={styles.blockHead}><p className={styles.kicker}>05 · Next steps</p><h2 id="next-title">Plan your {course.name} shortlist</h2></header>
        <ul className={styles.tools}>
          <ToolCard course={course.id} href={`/eligibility?course=${course.id}`} icon="eligibility" title="Check eligibility" text="Answer a few questions to see what to confirm before applying." />
          <ToolCard course={course.id} href={`/budget?course=${course.id}`} icon="wallet" title="Plan your budget" text="Add hostel, travel and living costs to the annual tuition." />
          {programmes >= 2 ? <ToolCard course={course.id} href={`/compare?course=${course.id}`} icon="compare" title="Compare colleges" text={`Put up to three ${course.name} colleges side by side.`} />
            : <ToolCard course={course.id} href={`/colleges?course=${course.id}`} icon="building" title="Find colleges" text="Filter colleges by city, fee and course." />}
          <ToolCard href="/scholarships" icon="cap" title="Explore scholarships" text="Official scholarship portals and how to prepare your documents." />
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="faq-title">
        <header className={styles.blockHead}><p className={styles.kicker}>Questions</p><h2 id="faq-title">Before you rely on this page</h2></header>
        <div className={styles.faq}>
          <details><summary>Are these real colleges?<Icon name="chevron" /></summary><p>No. The institutions on NSEDU are fictional sample records with illustrative fees, salaries and demo ratings, used to show how the tools work. Always use each institution’s official information.</p></details>
          <details><summary>Where do I confirm eligibility for {course.name}?<Icon name="chevron" /></summary><p>In the official prospectus or admission notice of each institution. The <PickLink course={course.id} href={`/eligibility?course=${course.id}`}>eligibility checker</PickLink> lists what to confirm.</p></details>
          <details><summary>How do I compare total costs?<Icon name="chevron" /></summary><p>Tuition is only one part. Use <PickLink course={course.id} href={`/compare?course=${course.id}`}>Compare</PickLink> for fees side by side and the <PickLink course={course.id} href={`/budget?course=${course.id}`}>budget planner</PickLink> for living costs.</p></details>
          <details><summary>Which entrance exam do I need?<Icon name="chevron" /></summary><p>It depends on the institution and admission cycle. {exams.length ? <>Start with the linked guide{exams.length > 1 ? 's' : ''} ({exams.map((exam, index) => <span key={exam.id}>{index > 0 && ', '}<Link href={`/exams/${exam.id}`}>{exam.name}</Link></span>)}) and</> : 'Check'} each college’s official admission page.</p></details>
        </div>
      </section>
    </div>
  </main>;
}

function ExamCard({ exam }) {
  const level = examLevel(exam.id);
  const host = hostname(exam.href);
  return <article className={styles.examCard}>
    <span className={styles.examIcon}><Icon name={exam.icon} /></span>
    <div className={styles.examBody}>
      <p className={styles.examMeta}>{exam.field}{level && ` · ${LEVEL_LABEL[level]} admission`}</p>
      <h3>{exam.name}</h3>
      <p>{exam.summary}</p>
      <div className={styles.examLinks}>
        <Link className="button button--primary" href={`/exams/${exam.id}`}>Exam guide<span className="sr-only">: {exam.name}</span><Icon name="arrow" /></Link>
        {exam.href && <a className="text-link" href={exam.href} target="_blank" rel="noopener noreferrer">{host || 'Official website'}<Icon name="external" /><span className="sr-only"> — {exam.name} official website (opens in a new tab)</span></a>}
      </div>
    </div>
  </article>;
}

function ToolCard({ course, href, icon, title, text }) {
  const content = <><span className={styles.toolIcon}><Icon name={icon} /></span><strong>{title}</strong><span>{text}</span><Icon name="arrow" /></>;
  return <li>{course ? <PickLink course={course} className={styles.tool} href={href}>{content}</PickLink> : <Link className={styles.tool} href={href}>{content}</Link>}</li>;
}
