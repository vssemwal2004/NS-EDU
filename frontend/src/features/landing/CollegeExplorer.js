'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useCatalog } from '@/providers/CatalogProvider';
import { useContent } from '@/providers/ContentProvider';
import { FEE_LIMITS, SORT_OPTIONS, filterCollegeRecords, formatTuition, formatSalary } from '@/lib/college-catalog';
import { COMPARE_MAX, compareHref, useCompare } from '@/features/colleges/compareStore';
import Icon from '@/components/ui/Icon';
import Dialog from '@/components/ui/Dialog';
import CollegeArtwork from './CollegeArtwork';
import styles from './CollegeExplorer.module.css';

function Placement({ row }) {
  return <div className={styles.placement}>{row.medianSalaryLpa === null ? <span>Not provided</span> : <><span><small>Median</small><strong>{formatSalary(row.medianSalaryLpa)}</strong></span><span><small>Highest</small><strong>{formatSalary(row.highestSalaryLpa)}</strong></span></>}</div>;
}

// Course-wise preview (homepage). Compare picks go to the shared nsedu:compare store used by /colleges and /compare.
// Tabs and year labels are admin-edited content (`explorer`); rows come from the catalogue.
export default function CollegeExplorer(props) {
  const { courses } = useCatalog();
  const config = useContent('explorer');
  if (!config || !courses.length) return <section id="course-colleges" className={styles.section} aria-labelledby="college-section-title" data-college-section>
    <div className="container"><div className={styles.heading}><div><h2 id="college-section-title">Course-wise colleges in India</h2><p role="status">College listings are temporarily unavailable. Please refresh in a moment.</p></div></div></div>
  </section>;
  return <Explorer {...props} courses={courses} config={config} />;
}

function Explorer({ records, course, onCourseChange, initialLocation = '', courses, config }) {
  const { courseTabs: collegeCourseTabs, tabLabels = {}, tuitionYear, placementYear } = config;
  const tabName = (item) => (Object.hasOwn(tabLabels, item.id) && tabLabels[item.id]) || item.name;
  const compare = useCompare(records);
  const primaryCourses = collegeCourseTabs.map((id) => courses.find((item) => item.id === id)).filter(Boolean);
  const additionalCourses = courses.filter((item) => !primaryCourses.includes(item) && records.some((row) => row.courseId === item.id));
  const currentCourse = courses.find((item) => item.id === course) || primaryCourses[0] || courses[0];
  const [location, setLocation] = useState(initialLocation);
  const [maxFee, setMaxFee] = useState('');
  const [sort, setSort] = useState('default');
  const [message, setMessage] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const matches = filterCollegeRecords(records, { courseId: currentCourse.id, location, maxFee, sort });
  const preview = matches.slice(0, 5);
  const selected = compare.lists[currentCourse.id] || [];
  const states = [...new Set(records.map((row) => row.state).filter(Boolean))].sort();
  const cities = [...new Set([...records.map((row) => row.city), ...(location && !states.includes(location) ? [location] : [])])].sort();
  const listingHref = `/colleges?${new URLSearchParams(Object.entries({ course: currentCourse.id, location, fee: maxFee, sort: sort === 'default' ? '' : sort }).filter(([, value]) => value))}`;

  function changeCourse(id) { onCourseChange(id); setMessage(''); }
  function toggleCompare(row) {
    const result = compare.toggle(row);
    setMessage(result === 'full' ? `You can compare up to ${COMPARE_MAX} ${currentCourse.name} colleges. Remove one to add another.`
      : `${row.shortName} ${result === 'added' ? 'added to' : 'removed from'} your ${currentCourse.name} comparison.`);
  }
  function resetFilters() { setLocation(''); setMaxFee(''); setSort('default'); setMessage('Location and budget filters cleared.'); }
  function tabKeyboard(event, index) {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (delta === undefined && !['Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? primaryCourses.length - 1 : (index + delta + primaryCourses.length) % primaryCourses.length;
    changeCourse(primaryCourses[next].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  }

  return <section id="course-colleges" className={styles.section} aria-labelledby="college-section-title" data-college-section>
    <svg className={styles.decor} viewBox="0 0 1600 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 32C100 24 145 0 185-20M0 46C110 38 160 0 210-20M1320-20C1440 44 1490 76 1600 86M1350-20C1460 37 1510 63 1600 72" /></svg>
    <div className="container">
      <div className={styles.heading}>
        <div><h2 id="college-section-title">Course-wise colleges in India</h2><p>Explore fees, placements and demo ratings for your preferred course.</p></div>
        <div className={styles.headingActions}><Link className="text-link" href={listingHref}>View all colleges<Icon name="arrow" /></Link><span className={styles.badge}>Illustrative data</span></div>
      </div>
      <div className={styles.courseNavigation}>
        <div className={styles.tabs} role="tablist" aria-label="College courses">{primaryCourses.map((item, index) => <button key={item.id} id={`college-tab-${item.id}`} role="tab" aria-selected={currentCourse.id === item.id} aria-controls="college-results" tabIndex={currentCourse.id === item.id || (!collegeCourseTabs.includes(currentCourse.id) && index === 0) ? 0 : -1} onClick={() => changeCourse(item.id)} onKeyDown={(event) => tabKeyboard(event, index)}>{tabName(item)}</button>)}</div>
        {additionalCourses.length > 0 && <button className={`button button--ghost ${styles.more}`} onClick={() => setMoreOpen(true)}>{collegeCourseTabs.includes(currentCourse.id) ? 'More' : currentCourse.name}<Icon name="chevron" /></button>}
      </div>
      <div className={styles.toolbar}>
        <div className={styles.resultHeading}><h3>{currentCourse.name} colleges</h3><span>{matches.length} sample {matches.length === 1 ? 'college' : 'colleges'}</span></div>
        <div className={styles.filters}>
          <label><span>Location:</span><select aria-label="College location" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">All India</option><optgroup label="Cities / regions">{cities.map((name) => <option key={name}>{name}</option>)}</optgroup><optgroup label="States">{states.map((name) => <option key={name}>{name}</option>)}</optgroup></select></label>
          <label><span>Annual fee:</span><select aria-label="Maximum annual tuition" value={maxFee} onChange={(event) => setMaxFee(event.target.value)}><option value="">Any budget</option>{FEE_LIMITS.map((fee) => <option key={fee} value={fee}>Up to {formatTuition(fee)}</option>)}</select></label>
          <label><span>Sort:</span><select aria-label="Sort colleges" value={sort} onChange={(event) => setSort(event.target.value)}>{SORT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.value === 'default' ? 'Default' : item.label}</option>)}</select></label>
        </div>
      </div>
      <div id="college-results" role="tabpanel" aria-label={`${currentCourse.name} sample colleges`} tabIndex={0}>
        {preview.length ? <table className={styles.table} role="table" aria-label={`${currentCourse.name} college comparison preview`}>
          <thead role="rowgroup"><tr role="row"><th scope="col" className={styles.number}>#</th><th scope="col">College</th><th scope="col">Annual tuition<small>{tuitionYear}</small></th><th scope="col">Placements<small>{placementYear}</small></th><th scope="col">Demo rating</th><th scope="col">Actions</th></tr></thead>
          <tbody role="rowgroup">{preview.map((row, index) => {
            const picked = compare.has(row.id);
            return <tr key={row.id} role="row" data-college-id={row.id} data-selected={picked}>
              <td role="cell" className={styles.number}><span aria-label={`List position ${index + 1}`}>{index + 1}</span></td>
              <td role="cell" className={styles.collegeCell}><div className={styles.collegeIdentity}><CollegeArtwork row={row} className={styles.thumbnail} /><div><Link className={styles.collegeName} href={`/universities/${row.collegeId}`}>{row.name}</Link><p>{row.city}{row.state ? `, ${row.state}` : ''}<span className={styles.courseTag}>{currentCourse.name}</span></p></div></div></td>
              <td role="cell" className={styles.feeCell}><span className={styles.mobileLabel}>Annual tuition</span><strong>{formatTuition(row.annualTuitionInr)}</strong><small>per year</small></td>
              <td role="cell" className={styles.salaryCell}><span className={styles.mobileLabel}>Placements</span><Placement row={row} /></td>
              <td role="cell" className={styles.ratingCell}><span className={styles.mobileLabel}>Demo rating</span>{row.demoRating != null ? <span className={styles.rating}><Icon name="star" /><strong>{row.demoRating.toFixed(1)}</strong><small>/ 5</small></span> : <span>—</span>}</td>
              <td role="cell" className={styles.actionsCell}><div className={styles.rowActions}><label className={styles.compareCheck}><input type="checkbox" checked={picked} onChange={() => toggleCompare(row)} aria-label={`Compare ${row.name}`} />Compare</label><Link className="button button--primary" href={`/universities/${row.collegeId}#courses`}>View details<span className="sr-only">: {row.name}</span><Icon name="arrow" /></Link><Link className={`text-link ${styles.apply}`} href="/admission-checklist"><span className="sr-only">Admission </span>Checklist<Icon name="arrow" /></Link></div></td>
            </tr>;
          })}</tbody>
        </table> : <div className={styles.empty}><Icon name="search" /><h3>No sample colleges match these filters</h3><p>Try another location or budget for {currentCourse.name}.</p><button className="button button--outline" onClick={resetFilters}>Reset filters</button></div>}
      </div>
      <div className={styles.compareBar}>
        <div><Icon name="compare" /><span><strong>{selected.length ? `${selected.length} of ${COMPARE_MAX} ${currentCourse.name} ${selected.length === 1 ? 'college' : 'colleges'} selected` : 'Build your college shortlist'}</strong><small>{selected.length ? selected.map((row) => row.shortName).join(' · ') : 'Select 2–3 colleges to compare fees and outcomes.'}</small></span></div>
        <div>{selected.length > 0 && <button className="text-link" onClick={() => { compare.clear(currentCourse.id); setMessage(`${currentCourse.name} comparison cleared.`); }}>Clear</button>}<Link className="button button--primary" href={compareHref(currentCourse.id)}>Compare colleges<Icon name="arrow" /></Link></div>
      </div>
      <p className={styles.footnote}>Illustrative colleges and values · Not a ranking · Tuition excludes hostel/living costs.</p>
      <p className={`sr-only ${styles.status}`} role="status" aria-live="polite">{message}</p>
      {message && <p className={styles.feedback} aria-hidden="true">{message}</p>}
    </div>
    <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Explore more courses">
      <div className={styles.moreCourses}>{additionalCourses.map((item) => <button className="chip" key={item.id} onClick={() => { changeCourse(item.id); setMoreOpen(false); }}><Icon name={item.icon} />{item.name}</button>)}</div>
    </Dialog>
  </section>;
}
