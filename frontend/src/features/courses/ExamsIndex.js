import Form from 'next/form';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ExamTicket from './ExamTicket';
import { examLevel, matchesTerms, plural, relatedCourses } from './data';
import styles from './Exams.module.css';

const PROMISES = [
  'Every guide starts at the official website',
  'No dates, fees, patterns or cut-offs copied here',
  'See the courses each exam is commonly used for',
];

function examsHref({ field = '', q = '' }) {
  const params = new URLSearchParams();
  if (field) params.set('field', field);
  if (q) params.set('q', q);
  const query = params.toString();
  return `/exams${query ? `?${query}` : ''}`;
}

export default function ExamsIndex({ catalog, field, query }) {
  const { exams, courses } = catalog;
  const related = Object.fromEntries(exams.map((exam) => [exam.id, relatedCourses(exam, courses)]));
  const fields = [...new Set(exams.map((exam) => exam.field))].sort();
  const activeField = fields.includes(field) ? field : '';
  const searched = exams.filter((exam) => matchesTerms([exam.name, exam.field, exam.summary, ...related[exam.id].map((course) => course.name)].join(' '), query));
  const visible = searched.filter((exam) => !activeField || exam.field === activeField);

  return <main id="main" tabIndex={-1} className={styles.page}>
    <section className={`lux-surface-dark ${styles.hero}`} aria-labelledby="exams-title">
      <div className={`lux-container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className="lux-eyebrow lux-eyebrow--rule">Entrance exams</p>
          <h1 id="exams-title" className={styles.title}>Entrance exam guides</h1>
          <p className="lux-lead">Go straight to the official source for eligibility, syllabus and dates — then see which courses each exam leads to.</p>
          <ul className={styles.promises}>{PROMISES.map((item) => <li key={item}><Icon name="check" />{item}</li>)}</ul>
        </div>
        {exams.length > 0 && <nav className={styles.board} aria-labelledby="board-title">
          <p id="board-title" className={styles.boardTitle}><Icon name="studyRoute" />Guides on the board</p>
          <ol>{exams.map((exam) => {
            const level = examLevel(exam);
            return <li key={exam.id}>
              <Link href={`/exams/${exam.id}`}>
                <span className={styles.boardName}>{exam.name}</span>
                <span className={styles.boardField}>{exam.field}</span>
                <span className={styles.boardLevel}>{level || '—'}</span>
                <Icon name="arrow" />
              </Link>
            </li>;
          })}</ol>
        </nav>}
      </div>
    </section>

    <section className={styles.listing} aria-labelledby="tickets-title">
      <div className="lux-container">
        <header className={styles.head}>
          <h2 id="tickets-title" className="lux-display-3">{activeField ? `${activeField} exams` : 'All exam guides'}</h2>
          <Form action="/exams" scroll={false} className={styles.search} role="search" aria-label="Search exam guides">
            {activeField && <input type="hidden" name="field" value={activeField} />}
            <Icon name="search" />
            <label htmlFor="exam-search" className="sr-only">Search exams</label>
            <input id="exam-search" type="search" name="q" defaultValue={query} key={query} maxLength={80} placeholder="Exam or course, e.g. MBA" autoComplete="off" enterKeyHint="search" />
            <button type="submit" className="lux-button lux-button--primary lux-button--sm">Search</button>
          </Form>
        </header>

        {fields.length > 1 && <div className={styles.chips} role="group" aria-label="Filter by stream">
          {['', ...fields].map((name) => <Link key={name || 'all'} scroll={false} className="lux-chip" href={examsHref({ field: name, q: query })} aria-current={activeField === name ? 'page' : undefined}>
            {name || 'All streams'}<span className={styles.count}>{searched.filter((exam) => !name || exam.field === name).length}</span>
          </Link>)}
        </div>}

        <p className={styles.result} role="status">
          {plural(visible.length, 'exam guide')}{activeField && ` · ${activeField}`}{query && ` · matching “${query}”`}
          {query && <Link scroll={false} className={styles.clear} href={examsHref({ field: activeField })}>Clear search</Link>}
        </p>

        {visible.length ? <ul className={styles.tickets}>
          {visible.map((exam) => <li key={exam.id}><ExamTicket exam={exam} courses={related[exam.id]} as="h3" /></li>)}
        </ul> : <div className={`lux-state ${styles.empty}`}>
          <Icon name="search" />
          <p className="lux-title">No exam guides match</p>
          <p>{exams.length ? 'Try the exam name, a course such as B.Tech, or a stream such as Engineering.' : 'Exam guides are temporarily unavailable. Please refresh in a moment.'}</p>
          {(query || activeField) && <Link className="lux-button lux-button--outline" scroll={false} href="/exams">Clear filters</Link>}
        </div>}

        <aside className={styles.next} aria-labelledby="exams-next-title">
          <h2 id="exams-next-title" className="lux-title">While you prepare</h2>
          <ul>
            <li><Link href="/news"><Icon name="news" /><span><strong>Exam &amp; results news</strong><small>Updates that link back to the official notices.</small></span><Icon name="arrow" /></Link></li>
            <li><Link href="/eligibility"><Icon name="eligibility" /><span><strong>Check eligibility</strong><small>What to confirm for your course before applying.</small></span><Icon name="arrow" /></Link></li>
            <li><Link href="/admission-checklist"><Icon name="studyCalendarCheck" /><span><strong>Admission checklist</strong><small>Documents and steps to prepare in advance.</small></span><Icon name="arrow" /></Link></li>
          </ul>
        </aside>

        <p className={styles.footnote}><Icon name="coursesInfo" />Course links are a general guide to where each exam is commonly used. Participating institutions and programmes change every cycle — always confirm in the official bulletin.</p>
      </div>
    </section>
  </main>;
}
