'use client';
import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Icon from '@/components/ui/Icon';
import { cities, courses } from '@/data/landing';
import { studyCities, studyStates, stateNames } from '@/data/destinations';
import { DestinationArt, LocationBackdrop } from './LocationArtwork';
import styles from './LocationDiscovery.module.css';

export default function LocationDiscovery({ course, onCourseChange, onBrowse }) {
  const [picker, setPicker] = useState(null);
  const [query, setQuery] = useState('');
  const options = picker === 'states' ? stateNames : cities;
  const matches = options.filter((name) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  function openPicker(type) {
    setQuery('');
    setPicker(type);
  }
  function choose(name, type) {
    setPicker(null);
    onBrowse({ type: 'Colleges', location: { name, type }, course });
  }

  return <section id="study-destinations" className={styles.section} aria-labelledby="destinations-title">
    <LocationBackdrop className={styles.backdrop} />
    <div className={`container ${styles.content}`}>
      <div className={styles.heading}>
        <div className={styles.titleRow}>
          <h2 id="destinations-title">Explore where you want to study</h2>
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
        <p>Choose a city or state to explore colleges, courses and fees.</p>
        <button type="button" className={`text-link ${styles.viewAll}`} onClick={() => openPicker('cities')}>View all locations<Icon name="arrow" /></button>
      </div>

      <nav className={styles.cityGrid} aria-label="Study destinations by city">
        {studyCities.map((destination) => <button key={destination.name} type="button" className={styles.cityTile} aria-label={`Explore colleges in ${destination.name}`} onClick={() => choose(destination.name, 'city')}>
          <DestinationArt destination={destination} className={styles.cityImage} />
          <span className={styles.cityTitle}>{destination.name}<Icon name="arrow" /></span>
          <span className={styles.cityAction}>Explore colleges<Icon name="arrow" /></span>
        </button>)}
      </nav>

      <section id="study-states" className={styles.stateSection} aria-labelledby="states-title">
        <div className={`${styles.heading} ${styles.stateHeading}`}>
          <h2 id="states-title">Explore states to study in India</h2>
          <p>Browse colleges across cities within your preferred state.</p>
          <button type="button" className={`text-link ${styles.viewAll}`} onClick={() => openPicker('states')}>View all states<Icon name="arrow" /></button>
        </div>
        <nav className={styles.stateGrid} aria-label="Study destinations by state">
          {studyStates.map((destination) => <button key={destination.name} type="button" className={styles.stateTile} aria-label={`Explore colleges in ${destination.name}`} onClick={() => choose(destination.name, 'state')}>
            <DestinationArt destination={destination} className={styles.stateImage} />
            <span className={styles.stateTitle}>{destination.name}<Icon name="arrow" /></span>
          </button>)}
        </nav>
      </section>
      <p className={styles.footer}>Your course choice carries into location results.</p>
    </div>

    <Dialog open={Boolean(picker)} onClose={() => setPicker(null)} title={picker === 'states' ? 'Choose a state' : 'Choose a city'}>
      <div className={styles.picker}>
        <p>Choose where you want to explore {courses.find((item) => item.id === course)?.name || 'college'} options.</p>
        <label className="sr-only" htmlFor="location-filter">Search {picker === 'states' ? 'states' : 'cities'}</label>
        <input id="location-filter" className="field" type="search" maxLength={80} placeholder={`Search ${picker === 'states' ? 'states' : 'cities'}`} value={query} onChange={(event) => setQuery(event.target.value)} />
        {matches.length ? <div className={styles.pickerOptions}>{matches.map((name) => <button className="chip" type="button" key={name} onClick={() => choose(name, picker === 'states' ? 'state' : 'city')}>{name}<Icon name="arrow" /></button>)}</div> : <p role="status">No matching locations. Try a different name.</p>}
      </div>
    </Dialog>
  </section>;
}
