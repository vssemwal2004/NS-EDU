'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { useContent } from '@/providers/ContentProvider';
import { calculateBudgetEstimate, formatBudgetCurrency as money, formatBudgetInput, getBudgetAssumptions, parseBudgetAmount } from '@/lib/budget';
import { SectionBackdrop, BudgetHeaderGraphic, BudgetResultGraphic } from './SectionVisuals';
import styles from './BudgetPlanner.module.css';

const costLabel = (value) => value === null ? 'Not available' : money(value);
const amountHelp = 'Enter whole rupees from 0 to 10,00,00,000.';

// `budget` content: pre-selected programme, starting budget, living options and cost rows.
export default function BudgetPlanner(props) {
  const config = useContent('budget');
  if (!config) return <section id="college-budget" className={styles.section} aria-labelledby="budget-title" data-budget-section>
    <div className={`container ${styles.container}`}><div className={styles.heading}><div><h2 id="budget-title">Budget check</h2><p className={styles.description} role="status">The budget planner is temporarily unavailable. Please refresh in a moment.</p></div></div></div>
  </section>;
  return <Planner {...props} config={config} />;
}

// The student enters the annual tuition printed on their college's own fee page; the planner adds
// stay, food and one-time costs (editable estimates from the `budget` content) and compares the
// total with their budget. No sample college is pre-selected, so no fee on screen is invented.
const STARTING_TUITION = 150000;

function Planner({ course, onCourseChange, onScholarships, config }) {
  const { defaults: budgetDefaults, livingOptions, costFields: budgetCostFields } = config;
  const { courses, stats } = useCatalog();
  const [livingId, setLivingId] = useState(budgetDefaults.livingId);
  const [budget, setBudget] = useState(formatBudgetInput(budgetDefaults.budgetInr));
  const [tuitionInput, setTuitionInput] = useState(formatBudgetInput(budgetDefaults.tuitionInr ?? STARTING_TUITION));
  const [overrides, setOverrides] = useState({});
  const detailsRef = useRef(null);
  const budgetRef = useRef(null);
  const tuitionRef = useRef(null);
  const currentCourse = courses.find((item) => item.id === course) || courses.find((item) => item.popular) || courses[0];
  const courseName = currentCourse?.name || 'this course';
  const tuition = parseBudgetAmount(tuitionInput, { allowZero: true });
  const record = { annualTuitionInr: tuition };
  const assumptions = getBudgetAssumptions(config, livingId, overrides[livingId]);
  const estimate = calculateBudgetEstimate(config, record, assumptions, budget);
  const offering = currentCourse ? stats?.courseCounts?.[currentCourse.id] ?? 0 : 0;
  const budgetError = budget.trim() === '' ? 'Add your first-year budget to see how it compares.' : estimate.budget === null ? 'Enter a budget from ₹1 to ₹10,00,00,000 in whole rupees.' : '';
  const tuitionError = tuition === null ? 'Enter the annual tuition in whole rupees, from the college’s fee page.' : '';
  const groups = [
    { label: 'College fees', icon: 'cap', amount: estimate.tuition, helper: 'Tuition for the first year' },
    { label: 'Stay & food', icon: 'bed', amount: estimate.living, helper: 'Accommodation and meals' },
    { label: 'Other costs', icon: 'book', amount: estimate.other, helper: 'Books, travel and joining charges' },
  ];
  const resultText = estimate.state === 'within' ? `${money(estimate.difference)} left in your budget`
    : estimate.state === 'exact' ? 'Matches your budget'
    : estimate.state === 'over' ? `${money(-estimate.difference)} above your budget`
    : estimate.state === 'incomplete' ? 'Complete the costs to see your estimate'
    : 'Add a budget to see the difference';

  function updateCost(id, value) {
    setOverrides((previous) => ({ ...previous, [livingId]: { ...previous[livingId], [id]: value } }));
  }
  function normalizeCost(id, raw) {
    const value = parseBudgetAmount(raw, { allowZero: true });
    if (value !== null) updateCost(id, formatBudgetInput(value));
  }
  // Enter in any field points at the first thing still missing.
  function explore(event) {
    event.preventDefault();
    if (tuition === null) tuitionRef.current?.focus();
    else if (estimate.budget === null) budgetRef.current?.focus();
    else if (estimate.invalidFields.length) {
      detailsRef.current.open = true;
      document.getElementById(`budget-cost-${estimate.invalidFields[0]}`)?.focus();
    }
  }
  return <section id="college-budget" className={styles.section} aria-labelledby="budget-title" data-budget-section>
    <SectionBackdrop variant="budget" />
    <div className={`container ${styles.container}`}>
      <div className={styles.heading}>
        <div><p className={`eyebrow section-label`}><Icon name="wallet" />Gyaan Vidhya / Budget check</p><h2 id="budget-title">Can this college fit <span className="section-title-accent">your budget?</span></h2><p className={styles.description}>See your first-year cost, including living expenses.</p></div>
        <BudgetHeaderGraphic className={styles.desk} />
      </div>
      <form className={styles.planner} onSubmit={explore} noValidate>
        <div className={styles.controls}>
          <div className={styles.control}>
            <label htmlFor="budget-course">Course</label>
            <div className={styles.selectWrap}><select id="budget-course" value={currentCourse?.id || ''} onChange={(event) => onCourseChange(event.target.value)} disabled={!courses.length}>
              {courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select><Icon name="chevron" /></div>
          </div>
          <div className={styles.control}>
            <label htmlFor="budget-tuition">Annual tuition fee</label>
            <div className={styles.currencyInput}><span aria-hidden="true">₹</span><input ref={tuitionRef} id="budget-tuition" inputMode="numeric" autoComplete="off" value={tuitionInput} maxLength={16} onChange={(event) => setTuitionInput(event.target.value)} onBlur={() => { if (tuition !== null) setTuitionInput(formatBudgetInput(tuition)); }} aria-invalid={tuition === null} aria-describedby={tuitionError ? 'budget-tuition-error' : 'budget-tuition-help'} /></div>
            {tuitionError ? <p id="budget-tuition-error" className={styles.inputError}>{tuitionError}</p> : <p id="budget-tuition-help" className={styles.context}>From the college’s official fee page</p>}
          </div>
          <div className={styles.control}><label htmlFor="budget-living">Where will you stay?</label><div className={styles.selectWrap}><select id="budget-living" value={livingId} onChange={(event) => setLivingId(event.target.value)}>{livingOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><Icon name="chevron" /></div></div>
          <div className={styles.control}>
            <label htmlFor="budget-amount">Your first-year budget</label>
            <div className={styles.currencyInput}><span aria-hidden="true">₹</span><input ref={budgetRef} id="budget-amount" inputMode="numeric" autoComplete="off" value={budget} maxLength={16} onChange={(event) => setBudget(event.target.value)} onBlur={() => { if (estimate.budget !== null) setBudget(formatBudgetInput(estimate.budget)); }} aria-invalid={estimate.budget === null} aria-describedby={budgetError ? 'budget-input-error' : 'budget-amount-help'} /></div>
            {budgetError ? <p id="budget-input-error" className={styles.inputError}>{budgetError}</p> : <span className="sr-only" id="budget-amount-help">Enter your total budget for the first year in rupees.</span>}
          </div>
        </div>
        <div className={styles.summary}>
          <div className={styles.groups}>
            <h3>What makes up the cost?</h3>
            <dl className={styles.costGroups}>{groups.map((group) => <div key={group.label}><dt><span className={styles.groupIcon}><Icon name={group.icon} /></span><span><strong>{group.label}</strong><small>{group.helper}</small></span></dt><dd>{costLabel(group.amount)}</dd></div>)}</dl>
            <details ref={detailsRef} className={styles.details}>
              <summary>View detailed costs<Icon name="chevron" /></summary>
              <div className={styles.breakdown}>
                <p className={styles.breakdownIntro}>Adjust estimates for your situation. All amounts below are for the first year.</p>
                <div className={styles.tuitionRow}><span><strong>Tuition</strong><small>{courseName} · as you entered it above</small></span><strong>{costLabel(estimate.tuition)}</strong></div>
                {budgetCostFields.map((field) => <div className={styles.costField} key={field.id}>
                  <label htmlFor={`budget-cost-${field.id}`}><span>{field.label}</span><small>{field.id === 'accommodation' && livingId === 'home' ? 'At home: no extra accommodation cost assumed' : field.note}</small></label>
                  <div className={styles.currencyInput}><span aria-hidden="true">₹</span><input id={`budget-cost-${field.id}`} aria-label={`${field.label} estimate`} inputMode="numeric" autoComplete="off" maxLength={16} value={assumptions[field.id]} onChange={(event) => updateCost(field.id, event.target.value)} onBlur={(event) => normalizeCost(field.id, event.target.value)} aria-invalid={estimate.values[field.id] === null} aria-describedby={estimate.values[field.id] === null ? `budget-error-${field.id}` : undefined} /></div>
                  {estimate.values[field.id] === null && <p className={styles.inputError} id={`budget-error-${field.id}`}>{amountHelp}</p>}
                </div>)}
                <button type="button" className={styles.reset} onClick={() => setOverrides((previous) => ({ ...previous, [livingId]: {} }))}>Reset these estimates</button>
              </div>
            </details>
          </div>
          <div className={styles.result} data-budget-state={estimate.state}>
            <BudgetResultGraphic className={styles.resultArtwork} />
            <div role="status" aria-live="polite" aria-atomic="true">
              <p className={styles.resultLabel}>Estimated first-year cost</p><p className={styles.total} data-budget-total>{estimate.total === null ? 'Costs incomplete' : money(estimate.total)}</p>
              <p className={styles.deposit}>{estimate.values.deposit !== null ? `Includes ${money(estimate.values.deposit)} refundable deposit` : 'Add the refundable deposit estimate below.'}</p>
              <div className={styles.balance}><span className={styles.balanceIcon}><Icon name={['within', 'exact'].includes(estimate.state) ? 'check' : 'document'} /></span><div><strong>{resultText}</strong><p>{estimate.budget !== null ? `Your budget: ${money(estimate.budget)}` : 'Your college cost stays visible while you edit.'}</p></div></div>
            </div>
            {currentCourse && <Link className={`button button--primary ${styles.primary}`} href={`/universities?course=${currentCourse.id}`}>
              {offering > 0 ? `Browse ${new Intl.NumberFormat('en-IN').format(offering)} ${courseName} colleges` : `Browse ${courseName} colleges`}<Icon name="arrow" /></Link>}
            <p className={styles.resultHelp}>{estimate.state === 'over' ? 'Adjust your costs, or look for colleges with a lower fee.' : estimate.state === 'incomplete' ? 'Check the detailed costs. Missing amounts are not counted as zero.' : 'Change the fee or your budget above to try another college.'}</p>
          </div>
        </div>
      </form>
      <div className={styles.funding}><span className={styles.fundingIcon}><Icon name="cap" /></span><div><h3>Need help with the cost?</h3><p>Explore merit, income and state-based scholarships.</p></div><button type="button" className="button button--outline" onClick={onScholarships}>Find scholarships<Icon name="arrow" /></button></div>
      <p className={styles.footnote}>An estimate from the fee you enter. Stay and other costs are typical figures you can edit. Confirm current fees with the institution; scholarships are not included.</p>
    </div>
  </section>;
}
