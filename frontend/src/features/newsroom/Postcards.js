import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import PlaceVisual from '@/features/landing/PlaceVisual';
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

// A place shows a postcard when it has an uploaded photo or a window into the shared artwork
// (`media.destinationsArt`, crops in its pixel space); every other place is a stamp.
export const hasPicture = (place, art) => Boolean(place.image || (art && place.crop));

export function Postcard({ place, kind, art, count, index = 0 }) {
  return <li className={styles.postcardItem} style={{ '--tilt': `${[-1.2, .8, -.5, 1.1, -.9, .6][index % 6]}deg` }}>
    <Link className={styles.postcard} href={placeHref(place, kind)} data-kind={kind} data-empty={!count?.institutions || undefined}>
      <span className={styles.photo}><PlaceVisual place={place} art={art} className={styles.photoArt} decorative /></span>
      <span className={styles.stamp} aria-hidden="true"><span>{place.name.slice(0, 1)}</span><small>India</small></span>
      <span className={styles.message}>
        <span className={styles.greeting}>Study in</span>
        <strong className={styles.placeName}>{place.name}</strong>
        {place.landmark && !place.image && <span className={styles.landmark}><Icon name="newsPostmark" />Illustrated: {place.landmark}</span>}
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
