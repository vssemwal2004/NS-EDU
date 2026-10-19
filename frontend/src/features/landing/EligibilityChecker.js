'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { optimisable } from '@/lib/hero-image';
import { eligibilitySteps, initialEligibilityAnswers, profileFor, qualificationFor, reviewEligibility, validateEligibilityStep } from '@/lib/eligibility';
import { useContent } from '@/providers/ContentProvider';
import { SectionBackdrop, StudyPathGraphic } from './SectionVisuals';
import styles from './EligibilityChecker.module.css';

const stepCopy = {
  stage: ['Where are you in your studies?', 'Choose the option that describes you today.'],
  qualification: ['What is your qualification?', 'A little context helps us ask the right questions.'],
  course: ['What would you like to study?', 'Choose your course. You can change it later.'],
  year: ['When do you plan to begin?', 'Requirements belong to a specific admission year.'],
  subjects: ['Which subjects have you studied?', 'Select your actual subjects, even if they differ from the sample requirements.'],
  marks: ['How would you like to add your marks?', 'Use the exact mark basis shown below. No guesswork needed.'],
  exam: ['Have you taken an entrance exam?', 'This is separate from your academic requirements.'],
  'exam-details': ['What does your scorecard say?', 'Keep the exam and result type together.'],
  review: ['Your next step, made clearer.', 'Review your details and understand what is still needed.'],
};
const groupFor = (step) => ['stage', 'qualification'].includes(step) ? 0 : step === 'review' ? 2 : 1;
const statusCopy = { match: 'Match', 'not-met': 'Not met', pending: 'Details needed', unverified: 'Review needed' };

// Illustrations come from `media.eligibility` (notebook, certificate, graduation).
function Artwork({ name, className = '' }) {
  const image = useContent('media')?.eligibility?.[name];
  if (!image?.src) return null;
  return <Image className={`${styles.art} ${className}`} src={image.src} unoptimized={!optimisable(image.src)} alt="" width={480} height={Math.round((480 * image.height) / image.width)} sizes="(max-width: 640px) 60px, 108px" loading="lazy" decoding="async" />;
}

function Choice({ name, value, selected, onChange, children, className = '' }) {
  return <label className={`${styles.choice} ${className}`} data-selected={selected}>
    <input className="sr-only" type="radio" name={name} value={value} checked={selected} onChange={() => onChange(value)} />
    <span className={styles.radio} aria-hidden="true">{selected && <Icon name="check" />}</span>
    {children}
  </label>;
}

export default function EligibilityChecker(props) {
  const config = useContent('eligibility');
  if (!config) return <section id="course-eligibility" className={styles.section} aria-labelledby="eligibility-title" data-eligibility-section>
    <div className={`container ${styles.layout}`}><div className={styles.intro}><h2 id="eligibility-title">Eligibility check</h2><p className={styles.helper} role="status">The eligibility checker is temporarily unavailable. Please refresh in a moment.</p></div></div>
  </section>;
  return <Checker {...props} config={config} />;
}

function Checker({ records = [], course, onCourseChange, onExplore, config }) {
  const { stages: studyStages, qualifications: qualificationOptions, subjects: subjectOptions, admissionYears, ruleYear } = config;
  const { courses, exams } = useCatalog();
  const [answers, setAnswers] = useState({ ...initialEligibilityAnswers });
  const [step, setStep] = useState('stage');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [saved, setSaved] = useState(false);
  const headingRef = useRef(null);
  const formRef = useRef(null);
  const hasNavigated = useRef(false);
  const steps = eligibilitySteps(answers, config);
  const index = steps.indexOf(step);
  const group = groupFor(step);
  const selectedCourse = courses.find((item) => item.id === answers.courseId);
  const profile = profileFor(config, answers.courseId);
  const programme = records.find((row) => row.courseId === answers.courseId);
  const review = step === 'review' ? reviewEligibility(answers, config) : null;
  const currentQualification = qualificationFor(answers);
  const marksBasis = profile?.basis || (['degree', 'engineering-degree', 'postgraduate'].includes(currentQualification.id) ? 'Degree aggregate (%)' : 'Academic aggregate (%)');
  const entry = step === 'stage';

  useEffect(() => {
    if (!hasNavigated.current) return;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [step]);

  function update(key, value) {
    setAnswers((previous) => ({ ...previous, [key]: value }));
    setError(''); setSaved(false);
  }
  function navigate(next) { hasNavigated.current = true; setStep(next); setError(''); setSaved(false); }
  function chooseCourse(id) {
    if (id !== answers.courseId) setAnswers((previous) => ({ ...previous, courseId: id, subjects: [], marks: '', grading: 'percentage', examStatus: '', examId: '', examName: '', score: '' }));
    setError(''); setSaved(false);
  }
  function next(event) {
    event.preventDefault();
    const message = validateEligibilityStep(step, answers);
    if (message) { setError(message); return; }
    if (step === 'course') onCourseChange(answers.courseId);
    if (step === 'stage' && course && !answers.courseId) setAnswers((previous) => ({ ...previous, courseId: course }));
    navigate(steps[index + 1]);
  }
  function restart() { setAnswers({ ...initialEligibilityAnswers }); setQuery(''); setShowAll(false); navigate('stage'); }
  function selectStage(id) {
    setAnswers((previous) => ({ ...previous, stage: id, qualification: '', completion: '' })); setError('');
  }
  function toggleSubject(subject) {
    const list = answers.subjects.filter((item) => item !== 'Unknown');
    update('subjects', list.includes(subject) ? list.filter((item) => item !== subject) : [...list, subject]);
  }
  function saveForVisit() {
    // Kept only in this mounted checker; there is no account or device persistence yet.
    setSaved(true);
  }
  function explore() { onExplore(answers.courseId); }
  const filtered = courses.filter((item) => `${item.name} ${item.field} ${item.fullName || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  const visibleCourses = query.trim() || showAll ? filtered : [...new Map([...(selectedCourse ? [selectedCourse] : []), ...courses.slice(0, 6)].map((item) => [item.id, item])).values()];

  return <section id="course-eligibility" className={styles.section} aria-labelledby="eligibility-title" data-eligibility-section data-step={step}>
    <SectionBackdrop variant="study" />
    <div className={`container ${styles.layout}`}>
      <aside className={styles.intro}>
        <p className={`eyebrow section-label`}><Icon name="compass" />Gyaan Vidhya / Eligibility</p>
        <h2 id="eligibility-title"><span className={styles.titleLead}>Your next </span><span className={styles.titleMain}>step starts <span className="section-title-accent">here.</span></span></h2>
        <p className={styles.introDescription}>Check course requirements, one simple question at a time.</p>
        {entry && <StudyPathGraphic />}
        <ol className={styles.journey} aria-label="Eligibility journey">{['Your studies', 'Course details', 'Requirements'].map((label, item) => <li key={label} data-active={item === group} data-complete={item < group} aria-current={item === group ? 'step' : undefined}><span aria-hidden="true">{item < group ? <Icon name="check" /> : item + 1}</span><small>{label}</small></li>)}</ol>
        {!entry && <div className={styles.context}><Artwork name={group === 2 ? 'graduation' : group === 1 ? 'certificate' : 'notebook'} /><div><span className="eyebrow">{group === 2 ? 'Your next chapter' : 'One step at a time'}</span><p>{selectedCourse ? `${selectedCourse.name}${answers.admissionYear ? ` · ${answers.admissionYear}` : ''}` : 'A thoughtful choice starts with your studies.'}</p></div></div>}
      </aside>
      <div className={styles.workspace}>
        <div className={styles.questionHeading}><span className={styles.questionMark} aria-hidden="true"><Icon name={group === 2 ? 'eligibility' : group === 1 ? 'book' : 'cap'} /></span><div>{!entry && <span className={styles.stepLabel}>{step === 'review' ? 'Your requirement review' : `Question ${index + 1}`}</span>}<h3 ref={headingRef} id="eligibility-question" tabIndex={-1}>{stepCopy[step][0]}</h3><p>{stepCopy[step][1]}</p></div></div>
        {step !== 'review' ? <form ref={formRef} onSubmit={next} noValidate aria-labelledby="eligibility-question">
          <div key={step} className={`${styles.stepBody} ${entry ? styles.entryBody : ''}`}>
            {step === 'stage' && <>
              <fieldset className={styles.stageGrid} aria-labelledby="eligibility-question"><legend className="sr-only">Study stage</legend>{studyStages.map((item) => <Choice key={item.id} name="study-stage" value={item.id} selected={answers.stage === item.id} onChange={selectStage} className={styles.stageCard}><Artwork name={item.art} /><span className={styles.selectedLabel} aria-hidden="true">{answers.stage === item.id ? 'Selected' : '\u00a0'}</span><strong>{item.titleLines.map((line, index) => <span className={styles.titleLine} key={line}>{line}{index === 0 ? ' ' : ''}</span>)}</strong><span className={styles.choiceDescription}>{item.description}</span></Choice>)}</fieldset>
            </>}
            {step === 'qualification' && <div className={styles.focusPanel}><div className={styles.panelIcon}><Icon name="cap" /></div><div className={styles.fieldGrid}><label>Highest qualification<select className="field" value={answers.qualification} onChange={(event) => update('qualification', event.target.value)}><option value="">Choose your qualification</option>{qualificationOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Completion status<select className="field" value={answers.completion} onChange={(event) => update('completion', event.target.value)}><option value="">Choose your status</option><option value="completed">Completed</option><option value="studying">Studying / results awaited</option></select></label></div><p className={styles.helper}>Diploma, equivalence and lateral-entry routes need programme-specific rules.</p></div>}
            {step === 'course' && <>
              <label className={styles.search}><Icon name="search" /><span className="sr-only">Search eligibility courses</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a course or field" maxLength={80} /></label>
              <fieldset className={styles.courseGrid} aria-labelledby="eligibility-question"><legend className="sr-only">Choose a course</legend>{visibleCourses.map((item) => <Choice key={item.id} name="eligibility-course" value={item.id} selected={answers.courseId === item.id} onChange={chooseCourse} className={styles.courseChoice}><Icon name={item.icon} /><strong>{item.name}</strong><small>{item.field}</small></Choice>)}</fieldset>
              {!filtered.length && <p className={styles.helper} role="status">No matching course. Try another name or field.</p>}
              {!query.trim() && <button className={styles.otherRoute} type="button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show popular courses' : 'Explore all courses'}<Icon name="arrow" /></button>}
              <p className={styles.sampleNote}><Icon name="eligibility" />This preview uses fictional academic rules. Real programme checks need official criteria.</p>
            </>}
            {step === 'year' && <fieldset className={styles.optionGrid} aria-labelledby="eligibility-question"><legend className="sr-only">Admission year</legend>{admissionYears.map((year) => <Choice key={year} name="admission-year" value={year} selected={answers.admissionYear === year} onChange={(value) => update('admissionYear', value)} className={styles.largeChoice}><Icon name="book" /><strong>{year}</strong><span>Admission year</span></Choice>)}</fieldset>}
            {step === 'subjects' && <div className={styles.focusPanel}><p className={styles.helper}>Sample {selectedCourse.name} requirement: <strong>{profile.subjects.join(', ')}</strong>.</p><fieldset className={styles.subjectGrid} aria-labelledby="eligibility-question"><legend className="sr-only">Subjects studied</legend>{subjectOptions.map((subject) => <label key={subject} className={styles.subjectChoice} data-selected={answers.subjects.includes(subject)}><input type="checkbox" checked={answers.subjects.includes(subject)} onChange={() => toggleSubject(subject)} /><span>{subject}</span></label>)}</fieldset><label className={styles.unknownChoice}><input type="checkbox" checked={answers.subjects.includes('Unknown')} onChange={(event) => update('subjects', event.target.checked ? ['Unknown'] : [])} />I do not have these details yet</label></div>}
            {step === 'marks' && <div className={styles.focusPanel}><fieldset className={styles.grading} aria-label="Mark format"><legend className="sr-only">Mark format</legend>{[['percentage', 'Percentage'], ['cgpa', 'CGPA'], ['pending', 'Result / details awaited']].map(([id, label]) => <Choice key={id} name="mark-format" value={id} selected={answers.grading === id} onChange={(value) => { update('grading', value); update('marks', ''); }} className={styles.inlineChoice}><strong>{label}</strong></Choice>)}</fieldset>{answers.grading === 'pending' ? <div className={styles.pendingNote}><Icon name="book" /><h4>You can plan before your results.</h4><p>Your review will show which details still need to be added.</p></div> : <div className={styles.markInput}><label>{answers.grading === 'cgpa' ? 'Your CGPA' : marksBasis}<span className={styles.inputWithUnit}><input id="eligibility-marks" type="text" className="field" inputMode="decimal" maxLength={8} value={answers.marks} onChange={(event) => update('marks', event.target.value)} placeholder={answers.grading === 'cgpa' ? 'e.g. 8.1' : 'e.g. 78'} aria-describedby="mark-help" /><span>{answers.grading === 'cgpa' ? `/ ${answers.cgpaScale}` : '%'}</span></span></label>{answers.grading === 'cgpa' && <label>CGPA scale<select className="field" value={answers.cgpaScale} onChange={(event) => update('cgpaScale', event.target.value)}>{['4', '5', '10'].map((scale) => <option key={scale} value={scale}>{scale}-point scale</option>)}</select></label>}<p id="mark-help" className={styles.helper}>{answers.grading === 'cgpa' ? 'We do not guess a percentage. An official conversion rule is needed.' : `Enter ${marksBasis.replace(' (%)', '').toLowerCase()} from your marksheet, not an entrance percentile.`}</p></div>}</div>}
            {step === 'exam' && <fieldset className={styles.examChoices} aria-labelledby="eligibility-question"><legend className="sr-only">Entrance exam status</legend>{[['not-taken', 'Not taken yet', 'Review academic requirements first.', 'book'], ['awaited', 'Result awaited', 'I have taken an exam and am waiting for the result.', 'document'], ['result', 'I have my result', 'Add the exam and the value from my scorecard.', 'eligibility']].map(([id, label, description, icon]) => <Choice key={id} name="entrance-status" value={id} selected={answers.examStatus === id} onChange={(value) => update('examStatus', value)} className={styles.examChoice}><Icon name={icon} /><span><strong>{label}</strong><small>{description}</small></span></Choice>)}</fieldset>}
            {step === 'exam-details' && <div className={styles.focusPanel}><div className={styles.fieldGrid}><label>Entrance exam<select className="field" value={answers.examId} onChange={(event) => { update('examId', event.target.value); update('score', ''); }}><option value="">Choose your exam</option>{exams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="other">Another entrance exam</option></select></label>{answers.examId === 'other' && <label>Exam name<input className="field" value={answers.examName} maxLength={80} onChange={(event) => update('examName', event.target.value)} placeholder="Name on your scorecard" /></label>}<label>Result type<select className="field" value={answers.scoreType} onChange={(event) => { update('scoreType', event.target.value); update('score', ''); }}><option value="percentile">Percentile</option><option value="score">Score / marks</option><option value="rank">All India / general rank</option><option value="category-rank">Category rank</option></select></label><label>Value on your scorecard<input className="field" type="text" inputMode="decimal" value={answers.score} onChange={(event) => update('score', event.target.value)} maxLength={10} placeholder={answers.scoreType.includes('rank') ? 'e.g. 12500' : 'e.g. 92.4'} /></label></div><p className={styles.helper}>The result is recorded as entered. Admission chances need verified exam-year and counselling cutoff data.</p></div>}
          </div>
          {error && <p className={styles.error} id="eligibility-error" role="alert"><Icon name="eligibility" />{error}</p>}
          <div className={styles.actions}>{!entry ? <button type="button" className={styles.back} onClick={() => navigate(steps[index - 1])}><Icon name="arrow" />Back</button> : <button className={styles.otherRoute} type="button" onClick={() => { selectStage('other'); navigate('qualification'); }}><Icon name="cap" /><span>Diploma or another qualification? Choose here</span><Icon name="arrow" /></button>}<button type="submit" className={styles.continue}><span>{steps[index + 1] === 'review' ? 'Review requirements' : 'Continue'}</span><span aria-hidden="true"><Icon name="arrow" /></span></button></div>
        </form> : <div className={styles.review}>
          <div className={styles.resultHeading} data-result={review.state}><span className={styles.resultIcon}><Icon name={review.state === 'match' ? 'check' : 'eligibility'} /></span><div><span className="eyebrow">Illustrative academic check</span><h4>{review.title}</h4><p>{review.description}</p></div></div>
          <p className={styles.programme}>{selectedCourse.name} · {answers.admissionYear}{programme ? ` · ${programme.name}` : ''}<small>{profile ? `Fictional programme criteria · sample rule year ${ruleYear}` : 'Programme rules not verified'}</small></p>
          {review.rows.length > 0 && <div className={styles.requirements}>{review.rows.map((row) => <div key={row.label} className={styles.requirement} data-requirement-state={row.state}><div><strong>{row.label}</strong><small>{row.requirement}</small></div><p>{row.detail}</p><span className={styles.requirementStatus}><Icon name={row.state === 'match' ? 'check' : 'eligibility'} />{statusCopy[row.state]}</span></div>)}</div>}
          <div className={styles.entranceReview}><Icon name="compass" /><div><strong>Entrance-route requirements are not checked</strong><p>{answers.examStatus === 'result' ? `${answers.examId === 'other' ? answers.examName : exams.find((item) => item.id === answers.examId)?.name} · ${answers.scoreType === 'rank' ? 'general rank' : answers.scoreType === 'category-rank' ? 'category rank' : answers.scoreType}: ${answers.score}. ` : answers.examStatus === 'awaited' ? 'Your entrance result is awaited. ' : 'You have not taken an entrance exam yet. '}Review the official programme notice, exam year and counselling route.</p></div></div>
          <details className={styles.answerSummary}><summary>Your answers &amp; next steps<Icon name="chevron" /></summary><dl><div><dt>Study stage</dt><dd>{studyStages.find((item) => item.id === answers.stage)?.label || 'Another qualification'}</dd></div><div><dt>Qualification</dt><dd>{qualificationOptions.find((item) => item.id === currentQualification.id)?.label} · {currentQualification.completed ? 'completed' : 'studying / awaited'}</dd></div><div><dt>Subjects</dt><dd>{answers.subjects.length ? answers.subjects.join(', ') : 'Not requested for this sample check'}</dd></div><div><dt>Marks</dt><dd>{answers.grading === 'pending' ? 'Result / details awaited' : answers.grading === 'cgpa' ? `${answers.marks} / ${answers.cgpaScale} CGPA` : `${answers.marks}% · ${marksBasis}`}</dd></div></dl><ol><li>Confirm institution-specific criteria for {answers.admissionYear}.</li><li>Check required exams and the official admission route.</li><li>Compare programme fees and application dates before applying.</li></ol></details>
          <div className={styles.reviewActions}><button type="button" className={styles.continue} onClick={explore}><span>Explore {selectedCourse.name} colleges</span><span aria-hidden="true"><Icon name="arrow" /></span></button><button className="button button--outline" type="button" onClick={() => navigate('stage')}>Edit answers</button><button className={styles.save} type="button" aria-pressed={saved} onClick={saveForVisit}><Icon name={saved ? 'check' : 'heart'} />{saved ? 'Saved for this visit' : 'Save for this visit'}</button></div>
          {saved && <p className={styles.helper} role="status">Your check is kept while this page stays open. Account saving will be available later.</p>}
          <button type="button" className={styles.otherRoute} onClick={restart}>Start a new check<Icon name="arrow" /></button>
          <p className={styles.sampleNote}><Icon name="eligibility" />Sample rules are fictional. This review is not an admission decision.</p>
        </div>}
        <p className={styles.footnote}><span>No sign-up to begin.</span><span>Requirements vary by course, institution and admission year.</span></p>
      </div>
    </div>
  </section>;
}
