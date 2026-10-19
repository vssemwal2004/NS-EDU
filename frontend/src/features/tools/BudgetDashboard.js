'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { useCourseSelection } from '@/features/site/useCourseSelection';
import { calculateBudgetEstimate, findAffordableColleges, formatBudgetCurrency as money, formatBudgetInput, getBudgetAssumptions, parseBudgetAmount } from '@/lib/budget';
import GatedLink from './GatedLink';
import styles from './Budget.module.css';

const LIVING_ICON = { hostel: 'bed', rental: 'toolKey', home: 'toolHouse' };
const PRESETS = [200000, 300000, 500000, 800000];
const PARTS = [['tuition', 'College fees', 'Tuition for the first year'], ['living', 'Stay & food', 'Accommodation and meals'], ['other', 'Other costs', 'Books, travel, joining fees, deposit']];
const MATCH_LIMIT = 6;
const amountHelp = 'Enter whole rupees from 0 to 10,00,00,000.';
const lakh = (value) => `₹${formatBudgetInput(value / 100000)} lakh`;

function Donut({ parts, total }) {
  const length = 2 * Math.PI * 52;
  const starts = parts.reduce((list, part, index) => [...list, index ? list[index - 1] + parts[index - 1].value : 0], []);
  return <svg className={styles.donut} viewBox="0 0 132 132" aria-hidden="true">
    <circle className={styles.donutTrack} cx="66" cy="66" r="52" />
    {total > 0 && parts.map((part, index) => part.value > 0 && <circle key={part.id} className={styles.donutPart} data-part={part.id} cx="66" cy="66" r="52"
      strokeDasharray={`${Math.max((part.value / total) * length - 2.5, 0.5)} ${length}`} strokeDashoffset={-(starts[index] / total) * length} />)}
  </svg>;
}

export default function BudgetDashboard({ config, initialCourse = '' }) {
  if (!config) return <div className="lux-state" role="status"><Icon name="wallet" /><p className="lux-lead">The budget planner is temporarily unavailable. Please refresh in a moment.</p></div>;
  return <Dashboard config={config} initialCourse={initialCourse} />;
}

function Dashboard({ config, initialCourse }) {
  const { defaults, livingOptions, costFields } = config;
  const { courses, colleges: records } = useCatalog();
  const [course, setCourse] = useCourseSelection(initialCourse);
  const [selectedId, setSelectedId] = useState(defaults.collegeId);
  const [livingId, setLivingId] = useState(defaults.livingId);
  const [budget, setBudget] = useState(formatBudgetInput(defaults.budgetInr));
  const [overrides, setOverrides] = useState({});
  const [showAll, setShowAll] = useState(false);

  const courseOptions = courses.filter((item) => records.some((row) => row.courseId === item.id));
  const fallbackCourse = records.find((row) => row.id === defaults.collegeId)?.courseId || records[0]?.courseId || '';
  const courseId = records.some((row) => row.courseId === course) ? course : fallbackCourse;
  const missingCourse = course && course !== courseId ? courses.find((item) => item.id === course)?.name : '';
  const available = records.filter((row) => row.courseId === courseId);
  const record = available.find((row) => row.id === selectedId) || available[0];
  const knownCourse = courses.find((item) => item.id === courseId)?.name || '';
  const courseName = knownCourse || 'this course';
  const living = livingOptions.find((option) => option.id === livingId) || livingOptions[0];
  const assumptions = getBudgetAssumptions(config, livingId, overrides[livingId]);
  const estimate = calculateBudgetEstimate(config, record, assumptions, budget);
  const matches = findAffordableColleges(config, records, { courseId, tuitionYear: record?.tuitionYear, assumptions, budget });
  const budgetError = budget.trim() === '' ? 'Add your first-year budget to see how it compares.' : estimate.budget === null ? 'Enter a budget from ₹1 to ₹10,00,00,000 in whole rupees.' : '';
  const parts = PARTS.map(([id, label, helper]) => ({ id, label, helper, value: estimate[id] }));
  const complete = estimate.total !== null;
  const scale = Math.max(estimate.total ?? 0, estimate.budget ?? 0) || 1;
  const good = ['within', 'exact'].includes(estimate.state);
  const verdict = estimate.state === 'within' ? `${money(estimate.difference)} left in your budget`
    : estimate.state === 'exact' ? 'Matches your budget exactly'
    : estimate.state === 'over' ? `${money(-estimate.difference)} above your budget`
    : estimate.state === 'incomplete' ? 'Complete the costs to see your estimate'
    : 'Add a budget to see the difference';
  const shortVerdict = estimate.state === 'within' ? `${money(estimate.difference)} left` : estimate.state === 'exact' ? 'On budget' : estimate.state === 'over' ? `${money(-estimate.difference)} over` : estimate.state === 'incomplete' ? 'Costs incomplete' : 'Add a budget';

  function chooseCourse(id) { setCourse(id); setSelectedId(''); setShowAll(false); }
  function pickProgramme(row) {
    if (row.courseId !== courseId) setCourse(row.courseId);
    setSelectedId(row.id);
    document.getElementById('budget-dashboard')?.scrollIntoView({ block: 'start' });
  }
  // Defaults arrive as plain digits; show them grouped. Typed values are left exactly as typed.
  function display(id) {
    const raw = assumptions[id];
    return !Object.hasOwn(overrides[livingId] || {}, id) && /^\d+$/.test(raw) ? formatBudgetInput(Number(raw)) : raw;
  }
  function updateCost(id, value) { setOverrides((previous) => ({ ...previous, [livingId]: { ...previous[livingId], [id]: value } })); }
  function normalizeCost(id, raw) {
    const value = parseBudgetAmount(raw, { allowZero: true });
    if (value !== null) updateCost(id, formatBudgetInput(value));
  }

  return <>
    <div id="budget-dashboard" className={styles.dashboard}>
      <form className={styles.inputs} onSubmit={(event) => event.preventDefault()} noValidate aria-label="Budget inputs">
        <section className={styles.block} aria-labelledby="budget-step-programme">
          <header className={styles.blockHead}><span aria-hidden="true">01</span><h2 id="budget-step-programme">Choose a programme</h2></header>
          <div className={styles.pair}>
            <div><label className="lux-label" htmlFor="budget-course">Course</label>
              <select id="budget-course" className="lux-field" value={courseId} onChange={(event) => chooseCourse(event.target.value)} disabled={!courseOptions.length}>
                {!courseOptions.length && <option value="">No courses available</option>}
                {courseOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></div>
            <div><label className="lux-label" htmlFor="budget-college">Sample programme</label>
              <select id="budget-college" className="lux-field" value={record?.id || ''} onChange={(event) => setSelectedId(event.target.value)} disabled={!available.length} aria-describedby="budget-programme">
                {!record && <option value="">No programme data</option>}
                {available.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select></div>
          </div>
          {missingCourse && <p className={styles.notice} role="status"><Icon name="eligibility" />There is no sample fee data for {missingCourse} yet, so this plan uses {courseName}.</p>}
          <p id="budget-programme" className={styles.context}>
            {record ? <><Icon name="location" />{record.city}{record.state ? `, ${record.state}` : ''} · fees for {record.tuitionYear || 'year not provided'}</> : 'Programme data is temporarily unavailable.'}
            {record?.isIllustrative && <span className={styles.sample}>Sample data</span>}
          </p>
        </section>

        <section className={styles.block} aria-labelledby="budget-step-living">
          <header className={styles.blockHead}><span aria-hidden="true">02</span><h2 id="budget-step-living">Where will you stay?</h2></header>
          <fieldset className={styles.living}>
            <legend className="sr-only">Where will you stay?</legend>
            {livingOptions.map((option) => {
              const base = costFields.filter((field) => field.group === 'living').reduce((sum, field) => sum + (Number(option[field.id] ?? field.defaultInr) || 0), 0);
              return <label key={option.id} data-checked={livingId === option.id}>
                <input className="sr-only" type="radio" name="budget-living" value={option.id} checked={livingId === option.id} onChange={() => setLivingId(option.id)} />
                <Icon name={LIVING_ICON[option.id] || 'bed'} />
                <strong>{option.label}</strong>
                <small>{base ? `${money(base)} a year, estimated` : 'No stay cost assumed'}</small>
              </label>;
            })}
          </fieldset>
        </section>

        <section className={styles.block} aria-labelledby="budget-step-amount">
          <header className={styles.blockHead}><span aria-hidden="true">03</span><h2 id="budget-step-amount">Your first-year budget</h2></header>
          <label className="sr-only" htmlFor="budget-amount">Your first-year budget in rupees</label>
          <div className={styles.money}><span aria-hidden="true">₹</span><input id="budget-amount" className="lux-field" inputMode="numeric" autoComplete="off" value={budget} maxLength={16}
            onChange={(event) => setBudget(event.target.value)} onBlur={() => { if (estimate.budget !== null) setBudget(formatBudgetInput(estimate.budget)); }}
            aria-invalid={estimate.budget === null} aria-describedby={budgetError ? 'budget-amount-error' : 'budget-amount-help'} /></div>
          <div className={styles.presets} role="group" aria-label="Quick budget amounts">
            {PRESETS.map((value) => <button key={value} type="button" className="lux-chip" aria-pressed={estimate.budget === value} onClick={() => setBudget(formatBudgetInput(value))}>{lakh(value)}</button>)}
          </div>
          {budgetError ? <p id="budget-amount-error" className="lux-error">{budgetError}</p> : <p id="budget-amount-help" className="lux-hint">Everything you can spend in the first year, including family support and savings.</p>}
        </section>

        <section className={styles.block} aria-labelledby="budget-step-costs">
          <header className={styles.blockHead}><span aria-hidden="true">04</span><h2 id="budget-step-costs">Fine-tune the costs</h2></header>
          <p className={styles.blockIntro}>Estimates for {living?.label.toLowerCase() || 'your stay'}. Change any line to match your situation. Missing amounts are never counted as zero.</p>
          <div className={styles.ledger}>
            <div className={styles.line} data-locked>
              <span className={styles.lineLabel}><strong>Tuition</strong><small>{record?.isIllustrative ? 'Sample programme fee' : 'Programme fee'} · {record?.tuitionYear || 'year not provided'}</small></span>
              <strong className={styles.lineValue}>{estimate.tuition === null ? 'Not available' : money(estimate.tuition)}</strong>
            </div>
            {costFields.map((field) => <div className={styles.line} key={field.id}>
              <label className={styles.lineLabel} htmlFor={`budget-cost-${field.id}`}><strong>{field.label}</strong><small>{field.id === 'accommodation' && livingId === 'home' ? 'At home: no extra accommodation cost assumed' : field.note}</small></label>
              <div className={styles.money} data-size="sm"><span aria-hidden="true">₹</span><input id={`budget-cost-${field.id}`} className="lux-field" inputMode="numeric" autoComplete="off" maxLength={16} value={display(field.id)}
                onChange={(event) => updateCost(field.id, event.target.value)} onBlur={(event) => normalizeCost(field.id, event.target.value)}
                aria-invalid={estimate.values[field.id] === null} aria-describedby={estimate.values[field.id] === null ? `budget-error-${field.id}` : undefined} /></div>
              {estimate.values[field.id] === null && <p className="lux-error" id={`budget-error-${field.id}`}>{amountHelp}</p>}
            </div>)}
          </div>
          <button type="button" className="lux-link" onClick={() => setOverrides((previous) => ({ ...previous, [livingId]: {} }))}><Icon name="refresh" />Reset these estimates</button>
        </section>
      </form>

      <p className={styles.bar} data-state={estimate.state}>
        <span><small>First-year total</small><strong>{complete ? money(estimate.total) : 'Incomplete'}</strong></span>
        <span className={styles.barVerdict}>{shortVerdict}</span>
        <a href="#budget-summary" className="lux-button lux-button--primary lux-button--sm">Breakdown</a>
      </p>

      <aside id="budget-summary" className={`lux-surface-dark ${styles.summary}`} aria-labelledby="budget-summary-title" data-state={estimate.state}>
        <h2 id="budget-summary-title" className={styles.summaryTitle}>Estimated first-year cost</h2>
        <div className={styles.chart}>
          <div className={styles.totalBlock} role="status" aria-live="polite" aria-atomic="true">
            <div className={styles.donutWrap}>
              <Donut parts={parts.map((part) => ({ ...part, value: part.value ?? 0 }))} total={complete ? estimate.total : 0} />
              <p className={styles.total}><small>First-year total</small><strong data-budget-total>{complete ? money(estimate.total) : 'Incomplete'}</strong></p>
            </div>
            <p className={styles.verdict}><Icon name={good ? 'check' : estimate.state === 'over' ? 'trend' : 'document'} />{verdict}</p>
          </div>
          <ul className={styles.legend}>
            {parts.map((part) => <li key={part.id} data-part={part.id}>
              <span className={styles.swatch} aria-hidden="true" />
              <span><strong>{part.label}</strong><small>{part.helper}</small></span>
              <span className={styles.legendValue}>{part.value === null ? 'Not available' : money(part.value)}{complete && part.value !== null && <small>{Math.round((part.value / estimate.total) * 100)}%</small>}</span>
            </li>)}
          </ul>
        </div>

        {complete && estimate.budget !== null && <div className={styles.meter}>
          <div className={styles.meterTrack} aria-hidden="true">
            {parts.map((part) => <span key={part.id} data-part={part.id} style={{ width: `${((part.value ?? 0) / scale) * 100}%` }} />)}
            <i style={{ left: `${(estimate.budget / scale) * 100}%` }} />
          </div>
          <p className={styles.meterLegend}><span>Cost {money(estimate.total)}</span><span>Budget {money(estimate.budget)}</span></p>
        </div>}

        <p className={styles.deposit}>{estimate.values.deposit !== null ? `Includes ${money(estimate.values.deposit)} refundable deposit. Scholarships are not included.` : 'Add the refundable deposit estimate to complete the total.'}</p>
        <div className={styles.summaryActions}>
          <a href="#budget-matches" className="lux-button lux-button--light lux-button--block">Find colleges in my budget<Icon name="arrow" /></a>
          <Link href="/scholarships" className="lux-link"><Icon name="toolPiggy" />Find scholarships to close the gap<Icon name="arrow" /></Link>
        </div>
      </aside>
    </div>

    <section id="budget-matches" className={styles.matches} aria-labelledby="budget-matches-title">
      <div className={styles.matchesHead}>
        <div>
          <p className="lux-eyebrow">Sample programmes</p>
          <h2 id="budget-matches-title" className="lux-display-3">Colleges that fit this plan</h2>
        </div>
        <p className={styles.matchesIntro}>{knownCourse || 'No course selected'} ·{living?.label} · budget {estimate.budget !== null ? money(estimate.budget) : 'not entered'}. Tuition plus your current stay and extra-cost estimates. These are illustrative sample programmes; confirm each institution’s fee structure.</p>
      </div>
      {estimate.budget === null ? <div className="lux-state"><Icon name="wallet" /><p>Add your first-year budget above to see which sample programmes fit.</p></div>
        : matches.length ? <>
          <ol className={styles.matchList}>
            {(showAll ? matches : matches.slice(0, MATCH_LIMIT)).map(({ record: row, estimate: match }) => <li key={row.id} className={styles.match} data-current={row.id === record?.id}>
              <div className={styles.matchMain}>
                <h3>{row.name}</h3>
                <p><Icon name="location" />{row.city}{row.state ? `, ${row.state}` : ''}</p>
                <p className={styles.matchSplit}>Tuition {money(match.tuition)} + stay and other {money(match.living + match.other)}</p>
              </div>
              <div className={styles.matchFigures}>
                <strong>{money(match.total)}</strong><small>estimated first year</small>
                <span>{match.difference === 0 ? 'Exactly on budget' : `${money(match.difference)} left`}</span>
              </div>
              {row.id === record?.id ? <span className={styles.current}><Icon name="check" />In your plan</span>
                : <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={() => pickProgramme(row)}>Use this programme</button>}
            </li>)}
          </ol>
          {matches.length > MATCH_LIMIT && <button type="button" className="lux-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${matches.length}`}<Icon name="chevron" /></button>}
        </> : <div className="lux-state"><Icon name="search" /><h3 className="lux-title">No sample programme fits this plan yet</h3><p>Try a different place to stay, review the cost lines or adjust your budget.</p></div>}
      <div className={styles.directory}>
        <p>Looking for real institutions? The university directory lists programmes and published fee ranges.</p>
        <GatedLink href={courseId ? `/universities?course=${encodeURIComponent(courseId)}` : '/universities'} className="lux-button lux-button--outline">{knownCourse ? `Explore ${knownCourse} universities` : 'Explore universities'}<Icon name="arrow" /></GatedLink>
      </div>
    </section>
  </>;
}
