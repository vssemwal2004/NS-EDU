import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import BudgetDashboard from '@/features/tools/BudgetDashboard';
import { getContent } from '@/lib/api/content';
import styles from '@/features/tools/Budget.module.css';

export const metadata = { title: 'First-year budget planner | Gyaan Vidhya', description: 'Estimate first-year tuition, stay, meals and one-time costs against your budget, then see which sample programmes fit.' };

const receipt = [
  ['cap', 'Tuition', 'From the programme’s fee data'],
  ['bed', 'Stay & food', 'Hostel, rental or home: your call'],
  ['toolCalculator', 'One-time costs', 'Books, travel, joining fees, deposit'],
];
const notes = [
  ['toolPiggy', 'Scholarships are not subtracted', 'Any award you win lowers the real cost. Look for schemes before you rule a college out.', '/scholarships', 'Find scholarships'],
  ['eligibility', 'Check eligibility first', 'A budget only matters for programmes you can apply to. Compare your marks with sample rules.', '/eligibility', 'Check eligibility'],
  ['toolChecklist', 'Plan the paperwork', 'Fee receipts, deposits and documents follow a calendar. Keep track of each step.', '/admission-checklist', 'Admission checklist'],
];

export default async function BudgetPage({ searchParams }) {
  const [{ course = '' }, { budget }] = await Promise.all([searchParams, getContent(['budget'])]);
  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={styles.hero}>
      <div className={`lux-container ${styles.heroInner}`}>
        <div className={`lux-reveal ${styles.heroCopy}`}>
          <p className="lux-eyebrow lux-eyebrow--rule">Budget planner</p>
          <h1 className="lux-display-2">What will your first year <em>really</em> cost?</h1>
          <p className="lux-lead">Add tuition, stay, meals and one-time costs into a single first-year figure, set it against your budget, and see which sample programmes fit.</p>
        </div>
        <aside className={styles.receipt} aria-label="What the estimate counts">
          <p className={styles.receiptHead}><Icon name="toolCalculator" />Your estimate counts</p>
          <ol>{receipt.map(([icon, title, text]) => <li key={title}><Icon name={icon} /><span><strong>{title}</strong><small>{text}</small></span></li>)}</ol>
          <p className={styles.receiptFoot}>Every line is editable. Missing amounts are never counted as zero.</p>
        </aside>
      </div>
    </header>

    <div className={`lux-container ${styles.board}`}>
      <BudgetDashboard config={budget} initialCourse={String(Array.isArray(course) ? course[0] : course)} />
    </div>

    <section className={`lux-container ${styles.notes}`} aria-labelledby="budget-notes">
      <h2 id="budget-notes" className="lux-display-3">Before you commit to a number</h2>
      <ul>{notes.map(([icon, title, text, href, label]) => <li key={href}>
        <span aria-hidden="true"><Icon name={icon} /></span>
        <h3>{title}</h3>
        <p>{text}</p>
        <Link className="lux-link" href={href}>{label}<Icon name="arrow" /></Link>
      </li>)}</ul>
    </section>
  </main>;
}
