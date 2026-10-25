import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './Locations.module.css';

// `shown` lets a large count carry thousands separators while the plural still follows the number.
const plural = (count, word, many = `${word}s`, shown = count) => `${shown}\u00a0${count === 1 ? word : many}`;
const number = new Intl.NumberFormat('en-IN');

export const placeHref = (place, kind) => `/universities?${new URLSearchParams({ [kind === 'city' ? 'city' : 'state']: place.name })}`;

// Institutions come from the directory; the programme count is the curated fee catalogue and is
// usually zero, so it only appears where there is something to show.
export function countLine(count) {
  if (!count?.institutions) return 'No catalogue institutions yet';
  const listed = plural(count.institutions, 'institution', 'institutions', number.format(count.institutions));
  return count.programmes ? `${listed} · ${plural(count.programmes, 'programme')}` : listed;
}

// One window into the shared destination artwork (`media.destinationsArt`); crops are in its pixel space.
export function ArtWindow({ art, crop, className }) {
  if (!art || !crop) return null;
  return <svg className={className} viewBox={crop.join(' ')} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <image href={art.src} x="0" y="0" width={art.width} height={art.height} />
  </svg>;
}

export function Postcard({ place, kind, art, count, index = 0 }) {
  return <li className={styles.postcardItem} style={{ '--tilt': `${[-1.2, .8, -.5, 1.1, -.9, .6][index % 6]}deg` }}>
    <Link className={styles.postcard} href={placeHref(place, kind)} data-kind={kind} data-empty={!count?.institutions || undefined}>
      <span className={styles.photo}><ArtWindow art={art} crop={place.crop} className={styles.photoArt} /></span>
      <span className={styles.stamp} aria-hidden="true"><span>{place.name.slice(0, 1)}</span><small>India</small></span>
      <span className={styles.message}>
        <span className={styles.greeting}>Study in</span>
        <strong className={styles.placeName}>{place.name}</strong>
        {place.landmark && <span className={styles.landmark}><Icon name="newsPostmark" />Illustrated: {place.landmark}</span>}
        <span className={styles.count}>{countLine(count)}</span>
        <span className={styles.open}>Universities<span className={styles.openPlace}>&nbsp;in {place.name}</span><Icon name="arrow" /></span>
      </span>
    </Link>
  </li>;
}

export function Stamp({ place, kind, count }) {
  return <li>
    <Link className={styles.stampTile} href={placeHref(place, kind)} data-empty={!count?.institutions || undefined}>
      <span className={styles.stampInner}>
        <span className={styles.stampKind}>{kind === 'city' ? 'City' : 'State'}</span>
        <strong>{place.name}</strong>
        <span className={styles.stampCount}>{count?.institutions ? countLine(count) : 'None listed yet'}</span>
        <Icon name="arrow" />
      </span>
    </Link>
  </li>;
}
