'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { countByPlace, institutionLabel, mergePlaceCount, placeHref } from '@/features/home/placeCounts';
import { DestinationArt, LocationBackdrop } from './LocationArtwork';
import styles from './LocationDiscovery.module.css';

function CountBadge({ count }) {
  return <span className={styles.badge} data-empty={!count.institutions}>{institutionLabel(count)}</span>;
}

// variant "home": homepage section 2 with links to /locations.
// variant "page": featured tiles on /locations (the full directory follows it there).
export default function LocationDiscovery({ variant = 'home' }) {
  const { courses, colleges, featuredCities: studyCities, featuredStates: studyStates } = useCatalog();
  const { course, setCourse: onCourseChange } = usePreferences();
  const counts = useMemo(() => countByPlace(colleges, course), [colleges, course]);
  const courseName = courses.find((item) => item.id === course)?.name;
  const home = variant === 'home';
  // Badges count the real directory records for the place; the course choice carries into the link.
  const countFor = (place) => mergePlaceCount(place, counts);
  const label = (place) => `Explore ${courseName ? `${courseName} ` : ''}colleges in ${place.name} — ${institutionLabel(countFor(place))}`;

  return <section id="study-destinations" className={styles.section} aria-labelledby="destinations-title" data-variant={variant}>
    <LocationBackdrop className={styles.backdrop} />
    <div className={`container ${styles.content}`}>
      <div className={styles.heading}>
        <div className={styles.titleRow}>
          <h2 id="destinations-title">{home ? 'Explore where you want to study' : 'Featured destinations'}</h2>
          <label className={styles.courseControl} htmlFor="destination-course">
            <span>Course:</span>
            <span className="sr-only">Choose a course for location browsing</span>
            <select id="destination-course" value={course} onChange={(event) => onCourseChange(event.target.value)}>
              <option value="">All courses</option>
              {courses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <Icon name="chevron" />
          </label>
        </div>
        <p>{home ? 'Choose a city or state to explore colleges, courses and fees.' : 'Landmark tiles for popular study cities and states, with the number of institutions listed in each.'}</p>
        {home && <Link className={`text-link ${styles.viewAll}`} href="/locations">View all destinations<Icon name="arrow" /></Link>}
      </div>

      <ul className={styles.cityGrid} aria-label="Study destinations by city">
        {studyCities.map((destination) => <li key={destination.name}>
          <Link className={styles.cityTile} href={placeHref(destination.name, course)} aria-label={label(destination)}>
            <DestinationArt destination={destination} className={styles.cityImage} />
            <span className={styles.cityTitle}>{destination.name}<Icon name="arrow" /></span>
            <CountBadge count={countFor(destination)} />
            <span className={styles.cityAction}>Explore colleges<Icon name="arrow" /></span>
          </Link>
        </li>)}
      </ul>

      <section id="study-states" className={styles.stateSection} aria-labelledby="states-title">
        <div className={`${styles.heading} ${styles.stateHeading}`}>
          <h2 id="states-title">{home ? 'Explore states to study in India' : 'Featured states'}</h2>
          <p>Browse colleges across cities within your preferred state.</p>
          {home && <Link className={`text-link ${styles.viewAll}`} href="/locations#states">View all states<Icon name="arrow" /></Link>}
        </div>
        <ul className={styles.stateGrid} aria-label="Study destinations by state">
          {studyStates.map((destination) => <li key={destination.name}>
            <Link className={styles.stateTile} href={placeHref(destination.name, course)} aria-label={label(destination)}>
              <DestinationArt destination={destination} className={styles.stateImage} />
              <span className={styles.stateTitle}>{destination.name}<Icon name="arrow" /></span>
              <CountBadge count={countFor(destination)} />
            </Link>
          </li>)}
        </ul>
      </section>
      <p className={styles.footer}>Your course choice carries into location results{courseName ? ` for ${courseName}` : ''}. Counts are institutions in the Gyaan Vidhya directory, not a ranking.</p>
    </div>
  </section>;
}
