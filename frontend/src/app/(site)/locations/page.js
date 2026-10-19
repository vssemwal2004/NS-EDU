import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { loginHref } from '@/features/auth/gated-routes';
import { countByPlace } from '@/features/home/placeCounts';
import { ArtWindow, Postcard, Stamp } from '@/features/newsroom/Postcards';
import { getCatalog } from '@/lib/api/catalog';
import { getSharedContent } from '@/lib/api/content';
import { getStudentSession } from '@/lib/api/session';
import { mediaImage } from '@/lib/hero-image';
import styles from '@/features/newsroom/Locations.module.css';

export const metadata = { title: 'Study destinations | Gyaan Vidhya', description: 'Browse study cities and states in India and open the universities in each.' };

const byName = (a, b) => a.name.localeCompare(b.name);

function artFor(entry) {
  const image = mediaImage(entry);
  return image ? { src: image.src, width: entry.width, height: entry.height } : null;
}

export default async function LocationsPage() {
  const [catalog, { media }, student] = await Promise.all([getCatalog(), getSharedContent(), getStudentSession()]);
  const art = artFor(media?.destinationsArt);
  const counts = countByPlace(catalog.colleges);
  const split = (places) => [places.filter((place) => art && place.crop), places.filter((place) => !(art && place.crop)).toSorted(byName)];
  const [cityCards, cityStamps] = split(catalog.cities);
  const [stateCards, stateStamps] = split(catalog.states);
  const placesWithInstitutions = [...catalog.cities, ...catalog.states].filter((place) => counts.get(place.name)?.institutions).length;
  const illustrative = catalog.colleges.some((row) => row.isIllustrative);
  const fan = [cityCards[2], stateCards[3], cityCards[5]].filter(Boolean);
  const empty = !catalog.cities.length && !catalog.states.length;

  return <main id="main" tabIndex={-1} className={styles.page}>
    <section className={styles.hero} aria-labelledby="locations-title">
      <div className={styles.airmail} aria-hidden="true" />
      <div className={`lux-container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className="lux-eyebrow lux-eyebrow--rule">Study destinations</p>
          <h1 id="locations-title" className={`lux-display-1 ${styles.heroTitle}`}>Where in India will <span>you study?</span></h1>
          <p className="lux-lead">Choose a city or state to open its universities. From there, narrow the list by course, fees and approvals.</p>
          {!empty && <dl className={styles.facts}>
            <div><dt>Cities</dt><dd>{catalog.cities.length}</dd></div>
            <div><dt>States</dt><dd>{catalog.states.length}</dd></div>
            <div><dt>With institutions listed</dt><dd>{placesWithInstitutions}</dd></div>
          </dl>}
          {!empty && <nav className={styles.jump} aria-label="On this page">
            <a className="lux-chip" href="#cities"><Icon name="building" />Cities</a>
            <a className="lux-chip" href="#states"><Icon name="map" />States</a>
          </nav>}
        </div>
        {fan.length > 0 && <div className={styles.fan} aria-hidden="true">
          {fan.map((place) => <span key={place.name} className={styles.fanCard}><ArtWindow art={art} crop={place.crop} className={styles.fanArt} /><span>{place.name}</span></span>)}
          <span className={styles.fanMark}><Icon name="newsPostmark" /></span>
        </div>}
      </div>
    </section>

    {!student && !empty && <div className="lux-container">
      <p className={styles.signin}><Icon name="lock" /><span>University lists open after a quick email sign-in — no password needed.</span><Link className="lux-link" href={loginHref('/universities')}>Sign in<Icon name="arrow" /></Link></p>
    </div>}

    {empty ? <div className="lux-state" role="status"><Icon name="map" /><h2 className="lux-title">Destinations are temporarily unavailable</h2><p>Please refresh in a moment.</p></div> : <>
      <section id="cities" className={styles.section} aria-labelledby="cities-title">
        <div className="lux-container">
          <header className={styles.sectionHead}>
            <p className="lux-eyebrow">Cities · {catalog.cities.length}</p>
            <h2 id="cities-title" className="lux-display-3">Postcards from study cities</h2>
          </header>
          {cityCards.length > 0 && <ul className={styles.postcards} data-kind="city">{cityCards.map((place, index) => <Postcard key={place.name} place={place} kind="city" art={art} count={counts.get(place.name)} index={index} />)}</ul>}
          {cityStamps.length > 0 && <>
            <h3 className={styles.stampsTitle}>{cityCards.length ? 'More cities' : 'All cities'}</h3>
            <ul className={styles.stamps}>{cityStamps.map((place) => <Stamp key={place.name} place={place} kind="city" count={counts.get(place.name)} />)}</ul>
          </>}
        </div>
      </section>

      <section id="states" className={`${styles.section} ${styles.states}`} aria-labelledby="states-title">
        <div className="lux-container">
          <header className={styles.sectionHead}>
            <p className="lux-eyebrow">States · {catalog.states.length}</p>
            <h2 id="states-title" className="lux-display-3">Study across India’s states</h2>
          </header>
          {stateCards.length > 0 && <ul className={styles.postcards} data-kind="state">{stateCards.map((place, index) => <Postcard key={place.name} place={place} kind="state" art={art} count={counts.get(place.name)} index={index + 1} />)}</ul>}
          {stateStamps.length > 0 && <>
            <h3 className={styles.stampsTitle}>{stateCards.length ? 'Every other state' : 'All states'}</h3>
            <ul className={styles.stamps}>{stateStamps.map((place) => <Stamp key={place.name} place={place} kind="state" count={counts.get(place.name)} />)}</ul>
          </>}
        </div>
      </section>

      <section className="lux-container" aria-labelledby="next-title">
        <div className={`lux-surface-dark ${styles.closing}`}>
          <div>
            <p className="lux-eyebrow lux-eyebrow--rule">Not sure where yet?</p>
            <h2 id="next-title" className="lux-display-3">Start from the course, then pick the city.</h2>
          </div>
          <div className={styles.closingActions}>
            <Link className="lux-button lux-button--light" href="/courses">Explore courses<Icon name="arrow" /></Link>
            <Link className="lux-button lux-button--outline" href="/budget">Check living costs</Link>
          </div>
        </div>
        <p className={styles.footnote}>Counts come from the Gyaan Vidhya catalogue{illustrative ? ', which currently includes illustrative sample institutions' : ''}. Landmarks are illustrations, not photographs.</p>
      </section>
    </>}
  </main>;
}
