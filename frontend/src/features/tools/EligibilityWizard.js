'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { useCourseSelection } from '@/features/site/useCourseSelection';
import { eligibilitySteps, initialEligibilityAnswers, profileFor, qualificationFor, reviewEligibility, validateEligibilityStep } from '@/lib/eligibility';
import GatedLink from './GatedLink';
import styles from './Eligibility.module.css';

const STEP = {
  stage: ['Your studies', 'Where are you in your studies?', 'Choose the option that describes you today.'],
  qualification: ['Qualification', 'What is your highest qualification?', 'A little context helps us ask the right questions.'],
  course: ['Course', 'What would you like to study?', 'Choose a course. You can change it later.'],
  year: ['Admission year', 'When do you plan to begin?', 'Requirements belong to a specific admission year.'],
  subjects: ['Subjects', 'Which subjects have you studied?', 'Select your actual subjects, even if they differ from the sample requirement.'],
  marks: ['Marks', 'How would you like to add your marks?', 'Use the mark basis from your marksheet. No guesswork needed.'],
  exam: ['Entrance exam', 'Have you taken an entrance exam?', 'This is separate from your academic requirements.'],
  'exam-details': ['Scorecard', 'What does your scorecard say?', 'Keep the exam and the result type together.'],
  review: ['Your result', '', ''],
};
const OTHER_STAGE = { id: 'other', label: 'Diploma or another qualification', description: 'Diploma, lateral entry or another route. You choose it on the next step.' };
const STAGE_ICON = { 'school-studying': 'book', 'school-completed': 'toolCertificate', college: 'cap', other: 'layers' };
const STATUS = { match: ['Meets sample rule', 'check'], 'not-met': ['Not met', 'close'], pending: ['Details needed', 'toolHourglass'], unverified: ['Check with institution', 'eligibility'] };
const VERDICT_ICON = { match: 'check', 'not-met': 'toolFlag', pending: 'toolHourglass', unverified: 'eligibility' };
const EXAM_STATUS = [
  ['not-taken', 'Not taken yet', 'Review academic requirements first.', 'book'],
  ['awaited', 'Result awaited', 'I have taken an exam and am waiting for the result.', 'toolHourglass'],
  ['result', 'I have my result', 'Add the exam and the value from my scorecard.', 'document'],
];
const GRADING = [['percentage', 'Percentage'], ['cgpa', 'CGPA'], ['pending', 'Result awaited']];
const SCORE_TYPES = [['percentile', 'Percentile'], ['score', 'Score / marks'], ['rank', 'All India / general rank'], ['category-rank', 'Category rank']];
const DEGREES = ['degree', 'engineering-degree', 'postgraduate'];

function ProgressRing({ value, children }) {
  const length = 2 * Math.PI * 22;
  return <span className={styles.ring} aria-hidden="true">
    <svg viewBox="0 0 52 52"><circle className={styles.ringTrack} cx="26" cy="26" r="22" /><circle className={styles.ringValue} cx="26" cy="26" r="22" strokeDasharray={length} strokeDashoffset={length * (1 - value)} /></svg>
    <span>{children}</span>
  </span>;
}

function Option({ name, value, checked, onChange, icon, title, description, tag, type = 'radio', compact = false }) {
  return <label className={`${styles.option} ${compact ? styles.optionCompact : ''}`} data-checked={checked}>
    <input className="sr-only" type={type} name={name} value={value} checked={checked} onChange={() => onChange(value)} />
    {icon && <span className={styles.optionIcon}><Icon name={icon} /></span>}
    <span className={styles.optionText}><strong>{title}</strong>{description && <small>{description}</small>}{tag && <span className={styles.optionTag}>{tag}</span>}</span>
    <span className={styles.tick} aria-hidden="true"><Icon name="check" /></span>
  </label>;
}

export default function EligibilityWizard({ config, initialCourse = '' }) {
  if (!config) return <div className="lux-state" role="status"><Icon name="eligibility" /><p className="lux-lead">The eligibility checker is temporarily unavailable. Please refresh in a moment.</p></div>;
  return <Wizard config={config} initialCourse={initialCourse} />;
}

function Wizard({ config, initialCourse }) {
  const { stages, qualifications, subjects: subjectOptions, admissionYears, ruleYear } = config;
  const { courses, exams } = useCatalog();
  const [, setCourse] = useCourseSelection(initialCourse);
  const [answers, setAnswers] = useState(() => ({ ...initialEligibilityAnswers, courseId: courses.some((item) => item.id === initialCourse) ? initialCourse : '' }));
  const [step, setStep] = useState('stage');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const rootRef = useRef(null);
  const headingRef = useRef(null);
  const moved = useRef(false);

  const steps = eligibilitySteps(answers, config);
  const index = Math.max(0, steps.indexOf(step));
  const total = steps.length - 1;
  const isReview = step === 'review';
  const course = courses.find((item) => item.id === answers.courseId);
  const profile = profileFor(config, answers.courseId);
  const qualification = qualificationFor(answers);
  const marksBasis = profile?.basis || (DEGREES.includes(qualification.id) ? 'Degree aggregate (%)' : 'Academic aggregate (%)');
  const review = isReview ? reviewEligibility(answers, config) : null;

  useEffect(() => {
    if (!moved.current) return;
    headingRef.current?.focus({ preventScroll: true });
    if (rootRef.current && rootRef.current.getBoundingClientRect().top < 0) rootRef.current.scrollIntoView({ block: 'start' });
  }, [step]);

  function update(patch) { setAnswers((previous) => ({ ...previous, ...patch })); setError(''); }
  function go(next) { moved.current = true; setStep(next); setError(''); }
  function chooseStage(id) { update({ stage: id, qualification: '', completion: '' }); }
  function chooseCourse(id) {
    if (id !== answers.courseId) update({ courseId: id, subjects: [], marks: '', grading: 'percentage', examStatus: '', examId: '', examName: '', score: '' });
  }
  function toggleSubject(subject) {
    const list = answers.subjects.filter((item) => item !== 'Unknown');
    update({ subjects: list.includes(subject) ? list.filter((item) => item !== subject) : [...list, subject] });
  }
  function next(event) {
    event.preventDefault();
    const message = validateEligibilityStep(step, answers);
    if (message) { setError(message); return; }
    if (step === 'course') setCourse(answers.courseId);
    go(steps[index + 1]);
  }
  function restart() { setAnswers({ ...initialEligibilityAnswers }); setQuery(''); setShowAll(false); go('stage'); }

  const term = query.trim().toLowerCase();
  const found = courses.filter((item) => `${item.name} ${item.field} ${item.fullName || ''}`.toLowerCase().includes(term));
  const visibleCourses = term || showAll ? found : [...new Map([...(course ? [course] : []), ...courses.slice(0, 6)].map((item) => [item.id, item])).values()];
  const errorId = error ? 'eligibility-error' : undefined;
  const [label, title, hint] = STEP[step];

  return <section ref={rootRef} className={styles.wizard} aria-label="Eligibility check" data-step={step}>
    <aside className={styles.rail} aria-label="Your progress">
      <div className={styles.railHead}>
        <ProgressRing value={isReview ? 1 : index / total}>{isReview ? <Icon name="check" /> : index + 1}</ProgressRing>
        <p className={styles.progressText}><span>{isReview ? 'Check complete' : `Step ${index + 1} of ${total}`}</span><strong>{label}</strong></p>
      </div>
      <ol className={styles.journey}>
        {steps.slice(0, -1).map((item, position) => <li key={item} data-state={isReview || position < index ? 'done' : position === index ? 'current' : 'todo'} aria-current={position === index && !isReview ? 'step' : undefined}>
          <span aria-hidden="true">{isReview || position < index ? <Icon name="check" /> : position + 1}</span>{STEP[item][0]}
        </li>)}
      </ol>
      {course && <p className={styles.railCourse}><Icon name={course.icon || 'cap'} /><span>Checking <strong>{course.name}</strong>{answers.admissionYear ? ` · ${answers.admissionYear}` : ''}</span></p>}
      <p className={styles.railNote}>Sample rules are fictional and labelled. Your answers stay on this device.</p>
    </aside>

    <div className={styles.stage}>
      {!isReview ? <form className={styles.card} onSubmit={next} noValidate aria-labelledby="eligibility-question">
        <header className={styles.question}>
          <p className="lux-eyebrow">Question {index + 1}</p>
          <h2 ref={headingRef} id="eligibility-question" tabIndex={-1} className="lux-display-3">{title}</h2>
          <p className={styles.hint}>{hint}</p>
        </header>

        <div key={step} className={styles.body}>
          {step === 'stage' && <fieldset className={styles.options} aria-describedby={errorId}>
            <legend className="sr-only">Study stage</legend>
            {[...stages, OTHER_STAGE].map((item) => <Option key={item.id} name="study-stage" value={item.id} checked={answers.stage === item.id} onChange={chooseStage} icon={STAGE_ICON[item.id] || 'cap'} title={item.label} description={item.description} />)}
          </fieldset>}

          {step === 'qualification' && <>
            <fieldset className={styles.options} aria-describedby={errorId}>
              <legend className={styles.legend}>Highest qualification</legend>
              {qualifications.map((item) => <Option key={item.id} compact name="qualification" value={item.id} checked={answers.qualification === item.id} onChange={(value) => update({ qualification: value })} title={item.label} />)}
            </fieldset>
            <fieldset className={`${styles.options} ${styles.pair}`} aria-describedby={errorId}>
              <legend className={styles.legend}>Completion status</legend>
              {[['completed', 'Completed'], ['studying', 'Studying / results awaited']].map(([id, text]) => <Option key={id} compact name="completion" value={id} checked={answers.completion === id} onChange={(value) => update({ completion: value })} title={text} />)}
            </fieldset>
            <p className={styles.note}>Diploma, equivalence and lateral-entry routes need programme-specific rules.</p>
          </>}

          {step === 'course' && <>
            <label className={styles.search}><Icon name="search" /><span className="sr-only">Search courses</span><input className="lux-field" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a course or field" maxLength={80} /></label>
            <fieldset className={`${styles.options} ${styles.courseGrid}`} aria-describedby={errorId}>
              <legend className="sr-only">Choose a course</legend>
              {visibleCourses.map((item) => <Option key={item.id} compact name="eligibility-course" value={item.id} checked={answers.courseId === item.id} onChange={chooseCourse} icon={item.icon || 'cap'} title={item.name} description={item.field} tag={profileFor(config, item.id) ? 'Sample rule' : ''} />)}
            </fieldset>
            {!courses.length && <p className={styles.note} role="status">Courses are temporarily unavailable. Please refresh in a moment.</p>}
            {courses.length > 0 && !found.length && <p className={styles.note} role="status">No matching course. Try another name or field.</p>}
            {!term && courses.length > 6 && <button type="button" className="lux-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer courses' : `Show all ${courses.length} courses`}<Icon name="chevron" className={showAll ? styles.up : ''} /></button>}
            <p className={styles.note}><Icon name="eligibility" />This preview uses fictional academic rules. Real programme checks need official criteria.</p>
          </>}

          {step === 'year' && <>
            <fieldset className={`${styles.options} ${styles.yearGrid}`} aria-describedby={errorId}>
              <legend className="sr-only">Admission year</legend>
              {admissionYears.map((year) => <Option key={year} name="admission-year" value={year} checked={answers.admissionYear === year} onChange={(value) => update({ admissionYear: value })} icon="calendar" title={year} description="Admission year" tag={year === ruleYear ? 'Sample rule' : ''} />)}
            </fieldset>
            <p className={styles.note}>Sample requirements exist for {ruleYear}. Other years show what to confirm with the institution.</p>
          </>}

          {step === 'subjects' && <>
            <p className={styles.requirement}>Sample {course?.name} requirement: <strong>{profile.subjects.join(', ')}</strong></p>
            <fieldset className={styles.subjects} aria-describedby={errorId}>
              <legend className="sr-only">Subjects studied</legend>
              {subjectOptions.map((subject) => <label key={subject} className={styles.subject} data-checked={answers.subjects.includes(subject)}>
                <input className="sr-only" type="checkbox" checked={answers.subjects.includes(subject)} onChange={() => toggleSubject(subject)} />
                <Icon name="check" />{subject}
              </label>)}
            </fieldset>
            <label className={styles.subject} data-checked={answers.subjects.includes('Unknown')} data-wide>
              <input className="sr-only" type="checkbox" checked={answers.subjects.includes('Unknown')} onChange={(event) => update({ subjects: event.target.checked ? ['Unknown'] : [] })} />
              <Icon name="check" />I do not have these details yet
            </label>
          </>}

          {step === 'marks' && <>
            <fieldset className={styles.segments}>
              <legend className="sr-only">Mark format</legend>
              {GRADING.map(([id, text]) => <label key={id} data-checked={answers.grading === id}><input className="sr-only" type="radio" name="mark-format" value={id} checked={answers.grading === id} onChange={() => update({ grading: id, marks: '' })} />{text}</label>)}
            </fieldset>
            {answers.grading === 'pending' ? <div className={styles.calm}><Icon name="toolHourglass" /><div><strong>You can plan before your results.</strong><p>Your review will show which details still need to be added.</p></div></div>
              : <div className={styles.marks}>
                <div>
                  <label className="lux-label" htmlFor="eligibility-marks">{answers.grading === 'cgpa' ? 'Your CGPA' : marksBasis}</label>
                  <span className={styles.unitField}><input id="eligibility-marks" className="lux-field" type="text" inputMode="decimal" maxLength={8} value={answers.marks} onChange={(event) => update({ marks: event.target.value })} placeholder={answers.grading === 'cgpa' ? 'e.g. 8.1' : 'e.g. 78'} aria-invalid={Boolean(error)} aria-describedby={`mark-help${errorId ? ` ${errorId}` : ''}`} /><span aria-hidden="true">{answers.grading === 'cgpa' ? `/ ${answers.cgpaScale}` : '%'}</span></span>
                </div>
                {answers.grading === 'cgpa' && <div><label className="lux-label" htmlFor="eligibility-scale">CGPA scale</label><select id="eligibility-scale" className="lux-field" value={answers.cgpaScale} onChange={(event) => update({ cgpaScale: event.target.value })}>{['4', '5', '10'].map((scale) => <option key={scale} value={scale}>{scale}-point scale</option>)}</select></div>}
                <p id="mark-help" className="lux-hint">{answers.grading === 'cgpa' ? 'We do not guess a percentage. An official conversion rule is needed.' : `Enter your ${marksBasis.replace(' (%)', '').toLowerCase()} from your marksheet, not an entrance percentile.`}</p>
              </div>}
          </>}

          {step === 'exam' && <fieldset className={styles.options} aria-describedby={errorId}>
            <legend className="sr-only">Entrance exam status</legend>
            {EXAM_STATUS.map(([id, text, description, icon]) => <Option key={id} name="entrance-status" value={id} checked={answers.examStatus === id} onChange={(value) => update({ examStatus: value })} icon={icon} title={text} description={description} />)}
          </fieldset>}

          {step === 'exam-details' && <div className={styles.fields}>
            <div><label className="lux-label" htmlFor="eligibility-exam">Entrance exam</label><select id="eligibility-exam" className="lux-field" value={answers.examId} onChange={(event) => update({ examId: event.target.value, score: '' })}><option value="">Choose your exam</option>{exams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="other">Another entrance exam</option></select></div>
            {answers.examId === 'other' && <div><label className="lux-label" htmlFor="eligibility-exam-name">Exam name</label><input id="eligibility-exam-name" className="lux-field" value={answers.examName} maxLength={80} onChange={(event) => update({ examName: event.target.value })} placeholder="Name on your scorecard" /></div>}
            <div><label className="lux-label" htmlFor="eligibility-score-type">Result type</label><select id="eligibility-score-type" className="lux-field" value={answers.scoreType} onChange={(event) => update({ scoreType: event.target.value, score: '' })}>{SCORE_TYPES.map(([id, text]) => <option key={id} value={id}>{text}</option>)}</select></div>
            <div><label className="lux-label" htmlFor="eligibility-score">Value on your scorecard</label><input id="eligibility-score" className="lux-field" type="text" inputMode="decimal" value={answers.score} onChange={(event) => update({ score: event.target.value })} maxLength={10} placeholder={answers.scoreType.includes('rank') ? 'e.g. 12500' : 'e.g. 92.4'} aria-describedby={errorId} /></div>
            <p className={`lux-hint ${styles.span}`}>The result is recorded as entered. Admission chances need verified exam-year and counselling cutoff data.</p>
          </div>}
        </div>

        {error && <p className={styles.error} id="eligibility-error" role="alert"><Icon name="eligibility" />{error}</p>}
        <div className={styles.actions}>
          {index > 0 ? <button type="button" className={`lux-button lux-button--ghost ${styles.back}`} onClick={() => go(steps[index - 1])}><Icon name="arrow" />Back</button> : <span className={styles.reassure}>Your answers stay on this device</span>}
          <button type="submit" className="lux-button lux-button--primary lux-button--lg">{steps[index + 1] === 'review' ? 'Review requirements' : 'Continue'}<Icon name="arrow" /></button>
        </div>
      </form>
        : <Result {...{ review, answers, course, profile, ruleYear, stages, qualifications, qualification, marksBasis, exams, headingRef, onEdit: () => go('stage'), onRestart: restart }} />}
    </div>
  </section>;
}

function Result({ review, answers, course, profile, ruleYear, stages, qualifications, qualification, marksBasis, exams, headingRef, onEdit, onRestart }) {
  const exam = answers.examId === 'other' ? answers.examName : exams.find((item) => item.id === answers.examId)?.name;
  const scoreLabel = answers.scoreType === 'rank' ? 'general rank' : answers.scoreType === 'category-rank' ? 'category rank' : answers.scoreType;
  const entrance = answers.examStatus === 'result' ? `${exam} · ${scoreLabel}: ${answers.score}. ` : answers.examStatus === 'awaited' ? 'Your entrance result is awaited. ' : 'You have not taken an entrance exam yet. ';
  const courseName = course?.name || 'this course';
  return <div className={styles.result} data-result={review.state}>
    <header className={styles.verdict}>
      <span className={styles.verdictMark} aria-hidden="true"><Icon name={VERDICT_ICON[review.state]} /></span>
      <div>
        <p className="lux-eyebrow">Illustrative academic check</p>
        <h2 ref={headingRef} id="eligibility-question" tabIndex={-1} className="lux-display-3">{review.title}</h2>
        <p className={styles.hint}>{review.description}</p>
      </div>
    </header>

    <p className={styles.programme}><strong>{courseName} · {answers.admissionYear}</strong><span>{profile ? `Fictional programme criteria · sample rule year ${ruleYear}` : 'Programme rules not verified'}</span></p>

    {review.rows.length > 0 && <ul className={styles.rows} aria-label="Requirement by requirement">
      {review.rows.map((row) => <li key={row.label} data-state={row.state}>
        <div><strong>{row.label}</strong><small>{row.requirement}</small></div>
        <p><span className="sr-only">Your answer: </span>{row.detail}</p>
        <span className={styles.status}><Icon name={STATUS[row.state][1]} />{STATUS[row.state][0]}</span>
      </li>)}
    </ul>}

    <div className={styles.entrance}><Icon name="compass" /><div><strong>Entrance-route requirements are not checked</strong><p>{entrance}Review the official programme notice, exam year and counselling route.</p></div></div>

    <div className={styles.nextSteps}>
      <h3 className="lux-title">What to do next</h3>
      <ol>
        <li>Confirm institution-specific criteria for {answers.admissionYear}.</li>
        <li>Check required exams and the official admission route.</li>
        <li>Compare programme fees and application dates before applying.</li>
      </ol>
    </div>

    <div className={`lux-surface-dark ${styles.cta}`}>
      <div>
        <p className="lux-eyebrow lux-eyebrow--rule">Your next step</p>
        <h3 className="lux-title">Find universities offering {courseName}</h3>
        <p>Browse university profiles and programme fees. The directory opens after a quick email sign-in.</p>
      </div>
      <div className={styles.ctaActions}>
        <GatedLink href={course ? `/universities?course=${encodeURIComponent(course.id)}` : '/universities'} className="lux-button lux-button--gold lux-button--lg">Explore {courseName} universities<Icon name="arrow" /></GatedLink>
        <Link className="lux-link" href={course ? `/budget?course=${encodeURIComponent(course.id)}` : '/budget'}>Plan your first-year budget<Icon name="arrow" /></Link>
        {course && <Link className="lux-link" href={`/courses/${encodeURIComponent(course.id)}`}>Read the {course.name} guide<Icon name="arrow" /></Link>}
      </div>
    </div>

    <details className={styles.answers}>
      <summary>Your answers<Icon name="chevron" /></summary>
      <dl>
        <div><dt>Study stage</dt><dd>{stages.find((item) => item.id === answers.stage)?.label || OTHER_STAGE.label}</dd></div>
        <div><dt>Qualification</dt><dd>{qualifications.find((item) => item.id === qualification.id)?.label || 'Not provided'} · {qualification.completed ? 'completed' : 'studying / awaited'}</dd></div>
        <div><dt>Subjects</dt><dd>{answers.subjects.length ? answers.subjects.map((item) => item === 'Unknown' ? 'Details not provided yet' : item).join(', ') : 'Not requested for this sample check'}</dd></div>
        <div><dt>Marks</dt><dd>{answers.grading === 'pending' ? 'Result / details awaited' : answers.grading === 'cgpa' ? `${answers.marks} / ${answers.cgpaScale} CGPA` : `${answers.marks}% · ${marksBasis}`}</dd></div>
      </dl>
    </details>

    <div className={styles.resultActions}>
      <button type="button" className="lux-button lux-button--outline" onClick={onEdit}>Edit answers</button>
      <button type="button" className="lux-button lux-button--ghost" onClick={onRestart}><Icon name="refresh" />Start a new check</button>
    </div>
    <p className={styles.disclaimer}><Icon name="eligibility" />Sample rules are fictional. This review is not an admission decision. Requirements vary by course, institution and admission year.</p>
  </div>;
}
