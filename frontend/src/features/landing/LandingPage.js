'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import HeroPhoto from './HeroPhoto';
import Icon from '@/components/ui/Icon';
import { isGatedPath } from '@/features/auth/gated-routes';
import { useCatalog } from '@/providers/CatalogProvider';
import { useContent } from '@/providers/ContentProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import SearchBox from './SearchBox';
import CampusArtwork from './CampusArtwork';
import styles from './Landing.module.css';

// College searches go to the login-gated university directory; courses and exams stay public.
const searchRoutes = { Colleges: '/universities', Courses: '/courses', Exams: '/exams' };

// Approved first screen: hero + popular courses + tool shortcuts. At ≥1101px it fills
// the viewport below the approved header height. The homepage composition is features/home/HomePage.js.
// The hero says one thing and offers one action: a headline, a single line of lead, the search
// and a trust line counted live from the directory. Decorative quotes and the field-icon grid were
// removed — the popular-course chips directly below already offer browsing by field.
export default function LandingFirstScreen() {
  const router = useRouter();
  const { status, openLogin } = useStudentAuth();
  const { courses, stats: totals, locationTotals } = useCatalog();
  const { setCourse } = usePreferences();
  const { shortcuts = [] } = useContent('landing') ?? {};
  const popular = courses.filter((course) => course.popular).slice(0, 6);
  const number = new Intl.NumberFormat('en-IN');
  // Counted from the directory at render time; a figure that is not available is left out, not guessed.
  const trust = [
    totals?.institutions > 0 && `${number.format(totals.institutions)} institutions`,
    locationTotals?.states > 0 && `${locationTotals.states} states & UTs`,
    'Free for students',
  ].filter(Boolean);
  function search({ type, query }) {
    const target = query ? `${searchRoutes[type]}?q=${encodeURIComponent(query)}` : searchRoutes[type];
    // Signed out, a college search opens the login popup over this page and runs once verified.
    if (status === 'signed-out' && isGatedPath(searchRoutes[type])) { openLogin({ reason: 'directory', onSuccess: () => router.push(target), returnTo: target }); return; }
    router.push(target);
  }
  return <div className={styles.firstScreen} data-first-screen>
    <section className={styles.hero} aria-labelledby="hero-title">
      <CampusArtwork className={styles.artwork} />
      <div className={`container ${styles.heroInner}`}>
        <div className={`${styles.heroVisual} ${styles.compactPhoto}`}><HeroPhoto className={styles.heroImage} /></div>
        <div className={styles.heroContent}>
          <h1 id="hero-title">Find the college that<br className={styles.desktopBreak} /> fits your future.</h1>
          <p className={styles.heroDescription}>Compare colleges, fees and placements — then apply in minutes.</p>
          <SearchBox onBrowse={search} />
          <ul className={styles.trust} aria-label="About Gyaan Vidhya">{trust.map((item) => <li key={item}><Icon name="check" />{item}</li>)}</ul>
        </div>
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
