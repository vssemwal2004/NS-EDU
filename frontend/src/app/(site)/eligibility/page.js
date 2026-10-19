import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import EligibilityWizard from '@/features/tools/EligibilityWizard';
import { getContent } from '@/lib/api/content';
import styles from '@/features/tools/Eligibility.module.css';

export const metadata = { title: 'Check course eligibility | Gyaan Vidhya', description: 'Compare your academic profile with sample course requirements, one question at a time.' };

const facts = [['toolChecklist', '5 to 8 short questions'], ['lock', 'No sign-up to begin'], ['eligibility', 'Sample rules, clearly labelled']];
const legend = [
  ['match', 'check', 'Meets sample rule', 'Your answer matches the fictional sample criterion for that requirement.'],
  ['pending', 'toolHourglass', 'Details needed', 'A result or detail is still awaited. You can plan now and check again later.'],
  ['unverified', 'eligibility', 'Check with institution', 'An official equivalence, CGPA conversion or admission-year rule is needed.'],
  ['not-met', 'close', 'Not met', 'An answer falls short of the sample criterion. Look at other courses or routes.'],
];
const related = [['/courses', 'book', 'Course guides'], ['/exams', 'document', 'Entrance exam guides'], ['/admission-checklist', 'toolChecklist', 'Admission checklist'], ['/budget', 'wallet', 'First-year budget planner']];

export default async function EligibilityPage({ searchParams }) {
  const [{ course = '' }, { eligibility }] = await Promise.all([searchParams, getContent(['eligibility'])]);
  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={styles.hero}>
      <div className={`lux-container lux-reveal ${styles.heroInner}`}>
        <p className="lux-eyebrow lux-eyebrow--rule">Eligibility check</p>
        <h1 className="lux-display-2">Check your eligibility, <em>one calm question</em> at a time</h1>
        <p className="lux-lead">Tell us where you are in your studies and what you want to study. We compare your answers with sample course requirements and explain what matches, what is missing and what to confirm.</p>
        <ul className={styles.facts}>{facts.map(([icon, text]) => <li key={text}><Icon name={icon} />{text}</li>)}</ul>
      </div>
    </header>

    <div className={`lux-container ${styles.wizardWrap}`}>
      <EligibilityWizard config={eligibility} initialCourse={String(Array.isArray(course) ? course[0] : course)} />
    </div>

    <section className={`lux-container ${styles.guide}`} aria-labelledby="eligibility-legend">
      <div className={styles.guideHead}>
        <p className="lux-eyebrow">Reading your result</p>
        <h2 id="eligibility-legend" className="lux-display-3">Four honest answers, no guesswork</h2>
        <p className="lux-lead">Each requirement gets one of these labels. None of them is an admission decision: institutions publish the official criteria for every admission year.</p>
      </div>
      <ul className={styles.legend4}>{legend.map(([state, icon, title, text]) => <li key={state} data-state={state}><span aria-hidden="true"><Icon name={icon} /></span><h3>{title}</h3><p>{text}</p></li>)}</ul>
      <nav className={styles.related} aria-label="Related tools and guides">
        {related.map(([href, icon, label]) => <Link key={href} href={href}><Icon name={icon} /><span>{label}</span><Icon name="arrow" /></Link>)}
      </nav>
    </section>
  </main>;
}
