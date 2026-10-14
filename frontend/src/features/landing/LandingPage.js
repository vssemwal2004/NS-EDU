'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HeroPhoto from './HeroPhoto';
import Icon from '@/components/ui/Icon';
import { fields, shortcuts } from '@/data/landing';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import SearchBox from './SearchBox';
import CampusArtwork from './CampusArtwork';
import styles from './Landing.module.css';

const searchRoutes = { Colleges: '/search', Courses: '/courses', Exams: '/exams' };

// Approved first screen: hero + popular courses + tool shortcuts. At ≥1101px it fills
// exactly the viewport below the fixed header. The homepage composition is features/home/HomePage.js.
export default function LandingFirstScreen() {
  const router = useRouter();
  const { courses } = useCatalog();
  const { setCourse } = usePreferences();
  const popular = courses.filter((course) => course.popular).slice(0, 6);
  function search({ type, query }) {
    router.push(query ? `${searchRoutes[type]}?q=${encodeURIComponent(query)}` : searchRoutes[type]);
  }
  return <div className={styles.firstScreen} data-first-screen>
    <section className={styles.hero} aria-labelledby="hero-title">
      <CampusArtwork className={styles.artwork} />
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroContent}>
          <h1 id="hero-title">Find a college that<br className={styles.desktopBreak} /> fits your future.</h1>
          <p className={styles.heroDescription}>Explore India’s top colleges, courses and career paths — with clarity, not confusion.</p>
          <SearchBox onBrowse={search} />
          <nav className={styles.fields} aria-label="Explore by field">{fields.map((field) => <Link key={field.label} href={`/courses?field=${encodeURIComponent(field.label)}`}><span className={styles.fieldIcon}><Icon name={field.icon} /></span><span>{field.label}</span></Link>)}</nav>
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
        <nav className={styles.courseLinks} aria-label="Popular courses">{popular.map((course) => <Link key={course.id} className="chip" href={`/colleges?course=${course.id}`} onClick={() => setCourse(course.id)}><Icon name={course.icon} />{course.name}</Link>)}</nav>
        <Link className={`text-link ${styles.allCourses}`} href="/courses">All courses<Icon name="arrow" /></Link>
      </div>
      <nav className={styles.shortcuts} aria-label="Tools for your college journey">{shortcuts.map((shortcut) => <Link key={shortcut.id} href={shortcut.href} className={styles.shortcut}><Icon name={shortcut.icon} /><span><h3>{shortcut.title}</h3><span className={styles.shortcutDescription}>{shortcut.description}</span></span><Icon name="arrow" /></Link>)}</nav>
    </section>
  </div>;
}
