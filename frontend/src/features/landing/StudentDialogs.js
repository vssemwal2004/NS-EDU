'use client';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { searchCatalog } from '@/lib/catalog';
import { toolGuides, courses } from '@/data/landing';
import { scholarshipResources } from '@/data/budget';
import styles from './StudentDialogs.module.css';
export default function StudentDialogs({ browse, onBrowseChange, onBrowse, tool, onToolClose, account, onAccountClose, city }) {
  const results = browse ? searchCatalog(browse.type, browse.query) : [];
  const guide = toolGuides[tool];
  const selectedCourse = courses.find((item) => item.id === browse?.course);
  const browseLocation = browse?.location;
  return <>
    <Dialog open={Boolean(browse)} onClose={() => onBrowseChange(null)} title="Explore NSEDU">
      {browse && <>
        <div className={styles.browseTypes} aria-label="Browse category">{['Colleges', 'Courses', 'Exams'].map((type) => <button key={type} type="button" className="chip" aria-pressed={browse.type === type} onClick={() => onBrowseChange({ ...browse, type, query: '' })}>{type}</button>)}</div>
        <label className="sr-only" htmlFor="catalog-query">Filter {browse.type.toLowerCase()}</label>
        <input className="field" id="catalog-query" value={browse.query} onChange={(event) => onBrowseChange({ ...browse, query: event.target.value })} placeholder={`Search ${browse.type.toLowerCase()}`} maxLength={120} />
        {browseLocation ? <p className={styles.cityNote}><Icon name="location" />{browseLocation.type === 'state' ? 'State' : 'City'}: {browseLocation.name}</p> : city && <p className={styles.cityNote}><Icon name="location" />Your preferred city: {city}</p>}
        {selectedCourse && <p className={styles.cityNote}><Icon name="cap" />Course: {selectedCourse.name}</p>}
        {browse.type === 'Colleges' ? <div className={styles.notice}><Icon name="cap" /><h3>Your college discovery starts here.</h3><p>We’re preparing the college directory{browseLocation ? ` for ${browseLocation.name}` : ''}. In the meantime, explore courses and official exam guides to understand your options.</p><button className="button button--primary" type="button" onClick={() => onBrowseChange({ ...browse, type: 'Courses', query: selectedCourse?.name || '' })}>Explore {selectedCourse?.name || 'courses'}<Icon name="arrow" /></button></div> : <>
          <p className={styles.resultCount} role="status">{results.length ? `${results.length} ${results.length === 1 ? 'option' : 'options'} to explore` : 'No matching options. Try a course name or field.'}</p>
          <div className={styles.results}>{results.map((item) => <article key={item.id} className={`surface ${styles.result}`}>
            <div className={styles.resultTitle}><span className={styles.resultIcon}><Icon name={item.icon} /></span><div><p className="eyebrow">{item.field}</p><h3>{item.name}</h3>{item.fullName && <p className={styles.fullName}>{item.fullName}</p>}</div></div>
            <p>{item.summary}</p>
            {item.href ? <a className="text-link" href={item.href} target="_blank" rel="noopener noreferrer">Visit official exam website<span className="sr-only"> (opens in a new tab)</span><Icon name="arrow" /></a> : <p className={styles.courseNote}>Confirm subjects, fees and eligibility with the institution before applying.</p>}
          </article>)}</div>
        </>}
      </>}
    </Dialog>
    <Dialog open={Boolean(guide)} onClose={onToolClose} title={guide?.title || 'Student guide'}>
      {guide && <div className={styles.guide}><p>{guide.intro}</p><ol>{guide.items.map((item) => <li key={item}>{item}</li>)}</ol>{tool === 'scholarships' && <div className={styles.scholarshipLinks}>{scholarshipResources.map((resource) => <div key={resource.href}><a className="text-link" href={resource.href} target="_blank" rel="noopener noreferrer">{resource.label}<span className="sr-only"> (opens in a new tab)</span><Icon name="arrow" /></a><p>{resource.description}</p></div>)}</div>}<p className={styles.infoNote}>{guide.note}</p><button className="text-link" type="button" onClick={() => onBrowse({ type: tool === 'eligibility' ? 'Exams' : 'Courses' })}>Explore {tool === 'eligibility' ? 'exam guides' : 'courses'}<Icon name="arrow" /></button></div>}
    </Dialog>
    <Dialog open={Boolean(account)} onClose={onAccountClose} title={account === 'login' ? 'Welcome back to NSEDU' : 'Your next chapter starts here'}>
      <div className={styles.guide}><p>Keep your college shortlist, comparisons and admission updates together.</p><div className={styles.notice}><Icon name="book" /><h3>Student accounts are coming next.</h3><p>Sign-in and account creation aren’t available yet. You can explore courses and exam guides now.</p></div><button className="button button--primary" type="button" onClick={() => onBrowse({ type: 'Courses' })}>Explore courses<Icon name="arrow" /></button></div>
    </Dialog>
  </>;
}
