import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CompareToggle from '@/features/compare/CompareToggle';
import { CampusPhoto, UniversityLogo } from './Imagery';
import { SourceTag, applyTarget } from './UniversityCard';
import { feeOf, formatCount, hostOf, kindOf, monogram, nirfOf, ownershipOf, placeOf, secondStatOf } from './labels';
import styles from './Listing.module.css';

// What the institution itself publishes, in the order a student asks for it. Each entry is dropped
// when the site does not state it — the rail says "Not published" rather than guessing a figure.
export function badgesOf(item) {
  return [
    item.nirfRank && { key: 'nirf', tone: 'rank', icon: 'uniRibbon', label: `NIRF ${nirfOf(item)}` },
    item.naacGrade && { key: 'naac', icon: 'uniMedal', label: `NAAC ${item.naacGrade}` },
    ...item.approvals.slice(0, 3).map((approval) => ({ key: approval, icon: 'uniVerified', label: approval })),
  ].filter(Boolean);
}

function Stat({ label, fact, empty }) {
  return <div className={styles.stat} data-empty={fact ? undefined : true}>
    <dt>{label}</dt>
    <dd>{fact ? <>{fact.value}<small>{fact.note}</small></> : empty}</dd>
  </div>;
}

// Counts of the depth behind the profile, so the row shows there is something to open.
function signalsOf(preview) {
  if (!preview) return [];
  return [
    preview.photoCount > 1 && { key: 'photos', icon: 'uniPhotos', label: `${preview.photoCount} campus photos` },
    preview.programmeCount > 0 && { key: 'programmes', icon: 'uniBook', label: `${formatCount(preview.programmeCount)} programmes` },
    preview.facilityCount > 0 && { key: 'facilities', icon: 'uniCampus', label: `${preview.facilityCount} facilities` },
    preview.awardCount > 0 && { key: 'awards', icon: 'uniFlag', label: `${preview.awardCount} awards` },
    preview.hostelAvailable === true && { key: 'hostel', icon: 'bed', label: 'Hostel' },
  ].filter(Boolean);
}

export default function UniversityRow({ item, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  const href = `/universities/${item.id}`;
  const preview = item.preview ?? null;
  const photo = preview?.photoUrl || item.coverUrl || '';
  const badges = badgesOf(item);
  const fee = feeOf(item);
  const second = secondStatOf(item);
  const signals = signalsOf(preview);
  const courses = preview?.topProgrammes?.length ? preview.topProgrammes : item.streams;
  const extra = (preview?.programmeCount || item.streams.length) - courses.slice(0, 3).length;

  return <article className={styles.row} aria-labelledby={`uni-${item.id}`}>
    <div className={styles.frame}>
      <CampusPhoto src={photo}><span className={styles.crest} aria-hidden="true">{monogram(item.name)}</span></CampusPhoto>
      {item.nirfRank && <span className={styles.frameRank}><Icon name="uniRibbon" />NIRF #{item.nirfRank}</span>}
      {photo && preview?.photoCount > 1 && <span className={styles.frameFoot}><Icon name="uniPhotos" />{preview.photoCount} photos</span>}
    </div>

    <div className={styles.body}>
      <div className={styles.head}>
        <UniversityLogo item={item} />
        <div className={styles.headText}>
          <p className={styles.kind}>{[kindOf(item), ownershipOf(item)].filter(Boolean).join(' · ')}</p>
          <Heading id={`uni-${item.id}`} className={styles.name}><Link href={href}>{item.name}</Link></Heading>
          <p className={styles.meta}>
            <span><Icon name="uniMapPin" />{placeOf(item) || 'Location not listed'}</span>
            {item.establishedYear && <span><Icon name="uniCalendar" />Est. {item.establishedYear}</span>}
          </p>
        </div>
      </div>

      {badges.length > 0 && <ul className={styles.badges} aria-label="Accreditation and approvals">
        {badges.map((badge) => <li key={badge.key} data-tone={badge.tone}><Icon name={badge.icon} />{badge.label}</li>)}
      </ul>}

      {preview?.tagline && <p className={styles.tagline}>{preview.tagline}</p>}

      {courses.length > 0 && <ul className={styles.courses} aria-label="Programmes and streams">
        {courses.slice(0, 3).map((course) => <li key={course}>{course}</li>)}
        {extra > 0 && <li data-more="true">+{extra} more</li>}
      </ul>}

      {signals.length > 0 && <ul className={styles.signals}>
        {signals.map((signal) => <li key={signal.key}><Icon name={signal.icon} />{signal.label}</li>)}
      </ul>}

      <div className={styles.bodyFoot}>
        <SourceTag item={item} />
        {item.website && <a className={styles.site} href={item.website} target="_blank" rel="noreferrer nofollow">{hostOf(item.website)}</a>}
      </div>
    </div>

    <div className={styles.rail}>
      <dl className={styles.stats}>
        <Stat label="Fees" fact={fee} empty="Not published" />
        <Stat label={second.label} fact={second.fact} empty={second.empty} />
      </dl>
      <div className={styles.actions}>
        <Link className="lux-button lux-button--outline lux-button--sm" href={href}>View profile<span className="sr-only">: {item.name}</span></Link>
        <CompareToggle slug={item.id} name={item.name} />
        <ApplyButton university={applyTarget(item)} className="lux-button--sm" />
      </div>
    </div>
  </article>;
}
