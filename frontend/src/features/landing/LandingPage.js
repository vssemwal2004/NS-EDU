'use client';
import { useState } from 'react';
import HeroPhoto from './HeroPhoto';
import Header from '@/components/layout/Header';
import Icon from '@/components/ui/Icon';
import { fields, courses, shortcuts } from '@/data/landing';
import SearchBox from './SearchBox';
import CampusArtwork from './CampusArtwork';
import StudentDialogs from './StudentDialogs';
import LocationDiscovery from './LocationDiscovery';
import CollegeExplorer from './CollegeExplorer';
import EligibilityChecker from './EligibilityChecker';
import BudgetPlanner from './BudgetPlanner';
import EducationNews from './EducationNews';
import styles from './Landing.module.css';
export default function LandingPage({ collegeRecords = [] }) {
  const [city, setCity] = useState('');
  const [browse, setBrowse] = useState(null);
  const [tool, setTool] = useState(null);
  const [account, setAccount] = useState(null);
  const [course, setCourse] = useState('');
  function openBrowse(options) {
    setTool(null); setAccount(null);
    const type = options.type || 'Courses';
    const selected = type !== 'Exams' ? courses.find((item) => item.name.toLowerCase() === options.query?.trim().toLowerCase()) : null;
    if (selected) setCourse(selected.id);
    if (options.location?.type === 'city') setCity(options.location.name);
    setBrowse({ type, query: options.query || '', location: options.location, course: options.course ?? selected?.id ?? (type === 'Colleges' ? course : '') });
  }
  function openTool(id) {
    setBrowse(null); setAccount(null);
    if (id === 'eligibility') {
      setTool(null);
      document.getElementById('course-eligibility')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      document.getElementById('eligibility-question')?.focus({ preventScroll: true });
      return;
    }
    if (id === 'budget') {
      setTool(null);
      document.getElementById('college-budget')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      document.getElementById('budget-college')?.focus({ preventScroll: true });
      return;
    }
    setTool(id);
  }
  function exploreEligibilityCourse(id) {
    setCourse(id);
    document.getElementById('course-colleges')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function openAccount(mode) { setBrowse(null); setTool(null); setAccount(mode); }
  return <div className={styles.shell}>
    <Header city={city} onCityChange={setCity} onBrowse={openBrowse} onTool={openTool} onAccount={openAccount} />
    <main id="main" className={styles.main} tabIndex={-1}>
      <div className={styles.firstScreen} data-first-screen>
      <section className={styles.hero} aria-labelledby="hero-title">
        <CampusArtwork className={styles.artwork} />
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <h1 id="hero-title">Find a college that<br className={styles.desktopBreak} /> fits your future.</h1>
            <p className={styles.heroDescription}>Explore India’s top colleges, courses and career paths —<br className={styles.desktopBreak} /> with clarity, not confusion.</p>
            <SearchBox onBrowse={openBrowse} />
            <nav className={styles.fields} aria-label="Explore by field">{fields.map((field) => <button type="button" key={field.label} onClick={() => openBrowse({ type: 'Courses', query: field.label })}><span className={styles.fieldIcon}><Icon name={field.icon} /></span><span>{field.label}</span></button>)}</nav>
          </div>
          <div className={`${styles.heroVisual} ${styles.compactPhoto}`}><HeroPhoto className={styles.heroImage} /></div>
          <p className={styles.centerQuote} aria-hidden="true">A brighter<br />India<br />begins<br />with you.<span /></p>
          <p className={styles.leftQuote} aria-hidden="true">Different<br />Journeys<br />A Brighter<br />India</p>
          <p className={styles.rightQuote} aria-hidden="true">Knowledge<br />today.<br />A brighter<br />tomorrow.<span /></p>
        </div>
      </section>
      <section className={`container ${styles.discovery}`} aria-label="Popular courses and student resources">
        <div className={styles.courseRow}>
          <div className={styles.courseIntro}><h2>Explore popular courses</h2><p>Start with a course that interests you.</p></div>
          <nav className={styles.courseLinks} aria-label="Popular courses">{courses.slice(0, 6).map((course) => <button key={course.id} className="chip" type="button" onClick={() => openBrowse({ type: 'Courses', query: course.name })}><Icon name={course.icon} />{course.name}</button>)}</nav>
          <button className={`text-link ${styles.allCourses}`} type="button" onClick={() => openBrowse({ type: 'Courses' })}>All courses<Icon name="arrow" /></button>
        </div>
        <nav className={styles.shortcuts} aria-label="Tools for your college journey">{shortcuts.map((shortcut) => <button type="button" key={shortcut.id} className={styles.shortcut} onClick={() => openTool(shortcut.id)}><Icon name={shortcut.icon} /><span><h3>{shortcut.title}</h3><span className={styles.shortcutDescription}>{shortcut.description}</span></span><Icon name="arrow" /></button>)}</nav>
      </section>
      </div>
      <LocationDiscovery course={course} onCourseChange={setCourse} onBrowse={openBrowse} />
      <CollegeExplorer records={collegeRecords} course={course} onCourseChange={setCourse} />
      <EligibilityChecker records={collegeRecords} course={course} onCourseChange={setCourse} onExplore={exploreEligibilityCourse} />
      <BudgetPlanner records={collegeRecords} course={course} onCourseChange={setCourse} onScholarships={() => openTool('scholarships')} />
      <EducationNews />
    </main>
    <StudentDialogs browse={browse} onBrowseChange={setBrowse} onBrowse={openBrowse} tool={tool} onToolClose={() => setTool(null)} account={account} onAccountClose={() => setAccount(null)} city={city} />
  </div>;
}
