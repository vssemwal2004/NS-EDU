import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CompareToggle from '@/features/compare/CompareToggle';
import { CampusPhoto, UniversityLogo } from './Imagery';
import { feeOf, kindOf, nirfOf, ownershipOf, placeOf, secondStatOf, sourceNote } from './labels';
import styles from './Directory.module.css';
import listing from './Listing.module.css';

// Remote imagery (and its fallbacks) lives in Imagery.js; it is re-exported here because the
// profile and the recommendation rail have always imported the crest from this module.
export { UniversityLogo, CampusPhoto, secureImage } from './Imagery';

export const applyTarget = (item) => ({ id: item.id, name: item.name, city: item.city, state: item.state || '', logoUrl: item.logoUrl || '' });

export function SourceTag({ item, className = '' }) {
  const tone = item.isIllustrative ? 'illustrative' : item.verification === 'verified' ? 'verified' : 'plain';
  return <span className={`${styles.source} ${className}`} data-tone={tone}>
    <Icon name={tone === 'verified' ? 'uniVerified' : 'uniInfo'} />{sourceNote(item)}
  </span>;
}

// One figure in the card's stat strip; an absent one is named, never filled in.
function Stat({ label, fact, empty }) {
  return <div className={listing.stat} data-empty={fact ? undefined : true}>
    <dt>{label}</dt>
    <dd>{fact ? <>{fact.value}<small>{fact.note}</small></> : empty}</dd>
  </div>;
}

// `reason` is the recommendation engine's explanation ("Because you searched MBA in Pune"); it is
// passed only where the list really is personalised, never as decoration.
export default function UniversityCard({ item, courseNames = {}, headingLevel = 3, reason = '' }) {
  const Heading = `h${headingLevel}`;
  const href = `/universities/${item.id}`;
  const preview = item.preview ?? null;
  const photo = preview?.photoUrl || item.coverUrl || '';
  const fee = feeOf(item);
  const second = secondStatOf(item);
  const kind = [kindOf(item), ownershipOf(item)].filter(Boolean).join(' · ');
  const badges = [
    item.naacGrade && { key: 'naac', icon: 'uniMedal', label: `NAAC ${item.naacGrade}` },
    item.nirfRank && { key: 'nirf', icon: 'uniRibbon', label: `NIRF ${nirfOf(item)}` },
    ...item.approvals.slice(0, 3).map((approval) => ({ key: approval, icon: 'uniVerified', label: approval })),
    item.establishedYear && { key: 'est', icon: 'uniCalendar', label: `Est. ${item.establishedYear}` },
  ].filter(Boolean);
  const courses = preview?.topProgrammes?.length ? preview.topProgrammes
    : item.programmes?.courseIds?.map((id) => courseNames[id] || id) || [];

  return <article className={styles.card} aria-labelledby={`uni-${item.id}`}>
    {photo && <div className={listing.cardFrame}><CampusPhoto src={photo} /></div>}
    {reason && <p className={listing.reason}><Icon name="spark" />{reason}</p>}
    <div className={styles.cardTop}>
      <UniversityLogo item={item} />
      <div className={styles.cardTitle}>
        <p className={styles.cardKind}>{kind}</p>
        <Heading id={`uni-${item.id}`}><Link href={href}>{item.name}</Link></Heading>
        <p className={styles.cardPlace}><Icon name="uniMapPin" />{placeOf(item) || 'Location not listed'}</p>
      </div>
    </div>

    {badges.length > 0 && <ul className={styles.badges} aria-label="Accreditation and approvals">
      {badges.map((badge) => <li key={badge.key}><Icon name={badge.icon} />{badge.label}</li>)}
    </ul>}

    {preview?.tagline ? <p className={listing.tagline}>{preview.tagline}</p>
      : item.streams.length > 0 && <p className={styles.streams}><span className="sr-only">Streams: </span>
        {item.streams.slice(0, 4).join(' · ')}{item.streams.length > 4 && <span className={styles.more}> +{item.streams.length - 4}</span>}
      </p>}

    {courses.length > 0 && <ul className={listing.courses} aria-label="Programmes offered">
      {courses.slice(0, 3).map((course) => <li key={course}>{course}</li>)}
      {courses.length > 3 && <li data-more="true">+{courses.length - 3} more</li>}
    </ul>}

    <dl className={listing.cardStats}>
      <Stat label="Fees" fact={fee} empty="Not published" />
      <Stat label={second.label} fact={second.fact} empty={second.empty} />
    </dl>

    <div className={styles.cardFoot}>
      <SourceTag item={item} />
      <div className={styles.cardActions}>
        <Link className="lux-button lux-button--ghost lux-button--sm" href={href}>View profile<span className="sr-only">: {item.name}</span></Link>
        <CompareToggle slug={item.id} name={item.name} />
        <ApplyButton university={applyTarget(item)} className="lux-button--sm" />
      </div>
    </div>
  </article>;
}
