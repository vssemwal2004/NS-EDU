import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { loginHref } from '@/features/auth/gated-routes';
import { countByPlace, mergePlaceCount } from '@/features/home/placeCounts';
import PlaceVisual from '@/features/landing/PlaceVisual';
import { hasPicture, Postcard, Stamp } from '@/features/newsroom/Postcards';
import { getCatalog } from '@/lib/api/catalog';
import { getSharedContent } from '@/lib/api/content';
import { getStudentSession } from '@/lib/api/session';
import { mediaImage } from '@/lib/hero-image';
import styles from '@/features/newsroom/Locations.module.css';

export const metadata = { title: 'Study destinations | Gyaan Vidhya', description: 'Browse study cities and states in India and open the universities in each.' };

// Each postcard is a small window into one shared sprite, so a 1200px-wide copy is plenty even on
// desktop. width/height stay the original values because the crop coordinates live in that space.
function artFor(entry) {
  const image = mediaImage(entry, Math.min(1200, entry?.width ?? 1200));
  return image ? { src: image.src, width: entry.width, height: entry.height } : null;
}

export default async function LocationsPage() {
  const [catalog, { media }, student] = await Promise.all([getCatalog(), getSharedContent(), getStudentSession()]);
  const art = artFor(media?.destinationsArt);
  const programmeCounts = countByPlace(catalog.colleges);
  // Institution totals come from the directory records; the sample programme rows add the fee line.
  const counts = new Map([...catalog.cities, ...catalog.states].map((place) => [place.name, mergePlaceCount(place, programmeCounts)]));
  // Both lists keep the API order: most institutions first.
  const split = (places) => [places.filter((place) => hasPicture(place, art)), places.filter((place) => !hasPicture(place, art))];
  const [cityCards, cityStamps] = split(catalog.cities);
  const [stateCards, stateStamps] = split(catalog.states);
  const totals = catalog.locationTotals ?? { cities: 0, states: 0 };
  const number = (value) => new Intl.NumberFormat('en-IN').format(value ?? 0);
  const illustrative = catalog.colleges.some((row) => row.isIllustrative);
  const fan = [cityCards[1], stateCards[0], cityCards[0]].filter(Boolean);
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
            <div><dt>Cities &amp; districts</dt><dd>{number(totals.cities)}</dd></div>
            <div><dt>States &amp; UTs</dt><dd>{number(totals.states)}</dd></div>
            <div><dt>Institutions listed</dt><dd>{number(catalog.stats?.institutions)}</dd></div>
          </dl>}
          {!empty && <nav className={styles.jump} aria-label="On this page">
            <a className="lux-chip" href="#cities"><Icon name="building" />Cities</a>
            <a className="lux-chip" href="#states"><Icon name="map" />States</a>
          </nav>}
        </div>
        {fan.length > 0 && <div className={styles.fan} aria-hidden="true">
          {fan.map((place) => <span key={place.name} className={styles.fanCard}><PlaceVisual place={place} art={art} className={styles.fanArt} decorative /><span>{place.name}</span></span>)}
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
        {/* The site navigation's "Study by state" links to /locations#study-states. */}
        <div id="study-states" className="lux-container">
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
        <p className={styles.footnote}>Institution counts come from the Gyaan Vidhya directory and are not a ranking; programme counts come from the curated fee catalogue{illustrative ? ', which still includes illustrative sample institutions' : ''}. Places are listed by how many institutions they have; landmark artwork is illustrative.</p>
      </section>
    </>}
  </main>;
}
