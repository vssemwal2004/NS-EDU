'use client';
import { useState } from 'react';
import { courses } from '@/data/landing';
import { collegeCourseTabs, collegeDemo } from '@/data/colleges';
import { filterCollegeRecords, formatTuition, formatSalary } from '@/lib/college-catalog';
import Icon from '@/components/ui/Icon';
import Dialog from '@/components/ui/Dialog';
import CollegeArtwork from './CollegeArtwork';
import styles from './CollegeExplorer.module.css';

const primaryCourses = collegeCourseTabs.map((id) => courses.find((item) => item.id === id));
const additionalCourses = courses.filter((item) => !collegeCourseTabs.includes(item.id));
const tabName = (item) => item.id === 'llb' ? 'Law' : item.id === 'nursing' ? 'Nursing' : item.name;

function Placement({ row }) {
  return <div className={styles.placement}>{row.medianSalaryLpa === null ? <span>Not provided</span> : <><span><small>Median</small><strong>{formatSalary(row.medianSalaryLpa)}</strong></span><span><small>Highest</small><strong>{formatSalary(row.highestSalaryLpa)}</strong></span></>}</div>;
}

function CollegeFacts({ row, courseName }) {
  return <dl className={styles.facts}>
    <div><dt>Course</dt><dd>{courseName}</dd></div>
    <div><dt>Location</dt><dd>{row.city}{row.state ? `, ${row.state}` : ''}</dd></div>
    <div><dt>Annual tuition · {row.tuitionYear}</dt><dd>{formatTuition(row.annualTuitionInr)} / year</dd></div>
    <div><dt>Median salary · {row.placementYear}</dt><dd>{formatSalary(row.medianSalaryLpa)}</dd></div>
    <div><dt>Highest salary · {row.placementYear}</dt><dd>{formatSalary(row.highestSalaryLpa)}</dd></div>
    <div><dt>Demo rating</dt><dd>{row.demoRating.toFixed(1)} / 5 · illustrative score</dd></div>
  </dl>;
}

export default function CollegeExplorer({ records, course, onCourseChange }) {
  const currentCourse = courses.find((item) => item.id === course) || courses[0];
  const [location, setLocation] = useState('');
  const [maxFee, setMaxFee] = useState('');
  const [sort, setSort] = useState('default');
  const [saved, setSaved] = useState([]);
  const [comparisons, setComparisons] = useState({ btech: collegeDemo.initialComparison });
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [directoryQuery, setDirectoryQuery] = useState('');
  const criteria = { courseId: currentCourse.id, location, maxFee, sort };
  const matches = filterCollegeRecords(records, criteria);
  const preview = matches.slice(0, 5);
  const selectedIds = comparisons[currentCourse.id] || [];
  const selected = selectedIds.map((id) => records.find((row) => row.id === id)).filter(Boolean);
  const modalRow = records.find((row) => row.id === modal?.id);
  const cities = [...new Set(records.map((row) => row.city))].sort();
  const states = [...new Set(records.map((row) => row.state).filter(Boolean))].sort();
  const directoryMatches = filterCollegeRecords(records, { ...criteria, query: directoryQuery });
  const titles = { directory: 'College directory', more: 'Explore more courses', compare: 'Compare selected colleges', apply: 'Application checklist', details: modalRow?.name || 'College details' };

  function changeCourse(id) { onCourseChange(id); setMessage(''); }
  function toggleSaved(row) {
    const isSaved = saved.includes(row.collegeId);
    setSaved((previous) => isSaved ? previous.filter((id) => id !== row.collegeId) : [...previous, row.collegeId]);
    setMessage(`${row.name} ${isSaved ? 'removed from your saved colleges' : 'saved for this visit'}.`);
  }
  function toggleCompare(row) {
    const isSelected = selectedIds.includes(row.id);
    if (!isSelected && selectedIds.length >= collegeDemo.maxComparison) {
      setMessage('You can compare up to 3 colleges for one course. Remove a college to add another.'); return;
    }
    setComparisons((previous) => ({ ...previous, [currentCourse.id]: isSelected ? selectedIds.filter((id) => id !== row.id) : [...selectedIds, row.id] }));
    setMessage(`${row.shortName} ${isSelected ? 'removed from' : 'added to'} comparison.`);
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
  function showDetails(row) { setModal({ type: 'details', id: row.id }); }

  return <section id="course-colleges" className={styles.section} aria-labelledby="college-section-title" data-college-section>
    <svg className={styles.decor} viewBox="0 0 1600 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 32C100 24 145 0 185-20M0 46C110 38 160 0 210-20M1320-20C1440 44 1490 76 1600 86M1350-20C1460 37 1510 63 1600 72" /></svg>
    <div className="container">
      <div className={styles.heading}>
        <div><h2 id="college-section-title">Course-wise colleges in India</h2><p>Explore fees, placements and reviews for your preferred course.</p></div>
        <div className={styles.headingActions}><button className="text-link" onClick={() => { setDirectoryQuery(''); setModal({ type: 'directory' }); }}>View all colleges<Icon name="arrow" /></button><span className={styles.badge}>Static demo data</span></div>
      </div>
      <div className={styles.courseNavigation}>
        <div className={styles.tabs} role="tablist" aria-label="College courses">{primaryCourses.map((item, index) => <button key={item.id} id={`college-tab-${item.id}`} role="tab" aria-selected={currentCourse.id === item.id} aria-controls="college-results" tabIndex={currentCourse.id === item.id || (!collegeCourseTabs.includes(currentCourse.id) && index === 0) ? 0 : -1} onClick={() => changeCourse(item.id)} onKeyDown={(event) => tabKeyboard(event, index)}>{tabName(item)}</button>)}</div>
        <button className={`button button--ghost ${styles.more}`} onClick={() => setModal({ type: 'more' })}>{collegeCourseTabs.includes(currentCourse.id) ? 'More' : currentCourse.name}<Icon name="chevron" /></button>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.resultHeading}><h3>{currentCourse.name} colleges</h3><span>{matches.length} sample {matches.length === 1 ? 'college' : 'colleges'}</span></div>
        <div className={styles.filters}>
          <label><span>Location:</span><select aria-label="College location" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">All India</option><optgroup label="Cities / regions">{cities.map((name) => <option key={name}>{name}</option>)}</optgroup><optgroup label="States">{states.map((name) => <option key={name}>{name}</option>)}</optgroup></select></label>
          <label><span>Annual fee:</span><select aria-label="Maximum annual tuition" value={maxFee} onChange={(event) => setMaxFee(event.target.value)}><option value="">Any budget</option>{[100000, 150000, 200000, 300000, 800000].map((fee) => <option key={fee} value={fee}>Up to {formatTuition(fee)}</option>)}</select></label>
          <label><span>Sort:</span><select aria-label="Sort colleges" value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">Default</option><option value="fee-asc">Fee: low to high</option><option value="fee-desc">Fee: high to low</option><option value="salary">Median salary</option><option value="rating">Demo rating</option></select></label>
        </div>
      </div>
      <div id="college-results" role="tabpanel" aria-label={`${currentCourse.name} sample colleges`} tabIndex={0}>
        {preview.length ? <table className={styles.table} role="table" aria-label={`${currentCourse.name} college comparison preview`}>
          <thead role="rowgroup"><tr role="row"><th scope="col" className={styles.number}>#</th><th scope="col">College</th><th scope="col">Annual tuition<small>{collegeDemo.tuitionYear}</small></th><th scope="col">Placements<small>{collegeDemo.placementYear}</small></th><th scope="col">Demo rating</th><th scope="col">Actions</th></tr></thead>
          <tbody role="rowgroup">{preview.map((row, index) => <tr key={row.id} role="row" data-college-id={row.id} data-selected={selectedIds.includes(row.id)}>
            <td role="cell" className={styles.number}><span aria-label={`List position ${index + 1}`}>{index + 1}</span></td>
            <td role="cell" className={styles.collegeCell}><div className={styles.collegeIdentity}><CollegeArtwork row={row} className={styles.thumbnail} /><div><button className={styles.collegeName} onClick={() => showDetails(row)}>{row.name}</button><p>{row.city}{row.state ? `, ${row.state}` : ''}<span className={styles.courseTag}>{currentCourse.name}</span></p></div><button className={styles.save} aria-label={`Save ${row.name}`} aria-pressed={saved.includes(row.collegeId)} title={saved.includes(row.collegeId) ? 'Saved for this visit' : 'Save college'} onClick={() => toggleSaved(row)}><Icon name="heart" /></button></div></td>
            <td role="cell" className={styles.feeCell}><span className={styles.mobileLabel}>Annual tuition</span><strong>{formatTuition(row.annualTuitionInr)}</strong><small>per year</small></td>
            <td role="cell" className={styles.salaryCell}><span className={styles.mobileLabel}>Placements</span><Placement row={row} /></td>
            <td role="cell" className={styles.ratingCell}><span className={styles.mobileLabel}>Demo rating</span><span className={styles.rating}><Icon name="star" /><strong>{row.demoRating.toFixed(1)}</strong><small>/ 5</small></span></td>
            <td role="cell" className={styles.actionsCell}><div className={styles.rowActions}><label className={styles.compareCheck}><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleCompare(row)} aria-label={`Compare ${row.name}`} />Compare</label><button className="button button--primary" onClick={() => showDetails(row)}>View details<Icon name="arrow" /></button><button className={`text-link ${styles.apply}`} onClick={() => setModal({ type: 'apply', id: row.id })}>Apply now<Icon name="arrow" /></button></div></td>
          </tr>)}</tbody>
        </table> : <div className={styles.empty}><Icon name="search" /><h3>No sample colleges match these filters</h3><p>Try another location or budget for {currentCourse.name}.</p><button className="button button--outline" onClick={resetFilters}>Reset filters</button></div>}
      </div>
      <div className={styles.compareBar}>
        <div><Icon name="compare" /><span><strong>{selected.length ? `${selected.length} ${selected.length === 1 ? 'college' : 'colleges'} selected` : 'Build your college shortlist'}</strong><small>{selected.length ? selected.map((row) => row.shortName).join(' · ') : 'Select 2–3 colleges to compare fees and outcomes.'}</small></span></div>
        <div>{selected.length > 0 && <button className="text-link" onClick={() => { setComparisons((previous) => ({ ...previous, [currentCourse.id]: [] })); setMessage('Comparison cleared for this course.'); }}>Clear</button>}<button className="button button--primary" disabled={selected.length < 2} onClick={() => setModal({ type: 'compare' })}>Compare colleges<Icon name="arrow" /></button></div>
      </div>
      <p className={styles.footnote}>Illustrative colleges and values · Not a ranking · Tuition excludes hostel/living costs.</p>
      <p className={`sr-only ${styles.status}`} role="status" aria-live="polite">{message}</p>
      {message && <p className={styles.feedback} aria-hidden="true">{message}</p>}
    </div>
    <Dialog open={!!modal} onClose={() => setModal(null)} title={titles[modal?.type] || 'Colleges'} variant={['directory', 'compare'].includes(modal?.type) ? 'dialog--wide' : ''}>
      <p className={styles.notice}><strong>Static demo.</strong> Colleges, fees, salaries and ratings are illustrative. These are not admission recommendations or verified results.</p>
      {modal?.type === 'more' && <div className={styles.moreCourses}>{additionalCourses.map((item) => <button className="chip" key={item.id} onClick={() => { changeCourse(item.id); setModal(null); }}><Icon name={item.icon} />{item.name}</button>)}</div>}
      {modal?.type === 'details' && modalRow && <><CollegeFacts row={modalRow} courseName={currentCourse.name} /><p className={styles.note}>Compare full costs, eligibility and official admission notices before choosing a college. Fees above cover tuition only.</p><div className={styles.modalActions}><button className="button button--outline" onClick={() => toggleSaved(modalRow)}>{saved.includes(modalRow.collegeId) ? 'Unsave college' : 'Save college'}<Icon name="heart" /></button><button className="button button--primary" onClick={() => setModal({ type: 'apply', id: modalRow.id })}>Application checklist<Icon name="arrow" /></button></div></>}
      {modal?.type === 'apply' && modalRow && <><h3>{modalRow.name}</h3><p className={styles.note}>{currentCourse.name} · {modalRow.city}</p><ol className={styles.checklist}><li>Check the official programme eligibility and required entrance exams.</li><li>Review tuition, hostel costs, scholarships and the refund policy.</li><li>Keep marksheets, identification and any required entrance scorecards ready.</li><li>Confirm deadlines and apply through the college’s official admission channel.</li></ol><p className={styles.notice}>This is a demo college. Applications cannot be submitted here yet. Online submission will be added with the backend.</p><button className="text-link" onClick={() => showDetails(modalRow)}>Back to college details<Icon name="arrow" /></button></>}
      {modal?.type === 'compare' && <><p className={styles.note}>{currentCourse.name} · Same course, side-by-side details</p><div className={styles.comparisonGrid}>{selected.map((row) => <article className="surface" key={row.id}><h3>{row.name}</h3><CollegeFacts row={row} courseName={currentCourse.name} /><button className="text-link" onClick={() => toggleCompare(row)} aria-label={`Remove ${row.name} from comparison`}>Remove<Icon name="close" /></button></article>)}</div>{selected.length < 2 && <p className={styles.note}>Add another college from the list to compare at least two options.</p>}</>}
      {modal?.type === 'directory' && <><p className={styles.note}>{currentCourse.name} · {location || 'All India'} · {maxFee ? `Up to ${formatTuition(Number(maxFee))}` : 'Any budget'}</p><label className={styles.directorySearch}><span className="sr-only">Search sample colleges</span><input className="field" placeholder="Search by college or city" value={directoryQuery} onChange={(event) => setDirectoryQuery(event.target.value)} /></label><p className={styles.note}>{directoryMatches.length} sample {directoryMatches.length === 1 ? 'college' : 'colleges'}</p><div className={styles.directoryGrid}>{directoryMatches.map((row) => <article key={row.id} className="surface"><CollegeArtwork row={row} className={styles.directoryThumbnail} /><div><h3>{row.name}</h3><p>{row.city}{row.state ? `, ${row.state}` : ''}</p><p>{formatTuition(row.annualTuitionInr)} / year</p><button className="text-link" onClick={() => showDetails(row)}>View details<Icon name="arrow" /></button></div></article>)}</div>{!directoryMatches.length && <div className={styles.empty}><h3>No matching sample colleges</h3><p>Try another name or city, or reset the location and fee filters.</p><button className="button button--outline" onClick={() => { setDirectoryQuery(''); resetFilters(); }}>Reset search and filters</button></div>}</>}
    </Dialog>
  </section>;
}
