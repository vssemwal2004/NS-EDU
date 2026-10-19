import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import { kindOf, lakhRange, monogram, nirfOf, ownershipOf, placeOf, sourceNote } from './labels';
import styles from './Directory.module.css';

// Logos are remote URLs from many hosts (official sites, Cloudinary), so a plain sized <img> is used.
export function UniversityLogo({ item, size = 'md', className = '' }) {
  const px = size === 'lg' ? 112 : size === 'sm' ? 44 : 60;
  return <span className={`${styles.logo} ${className}`} data-size={size} data-fallback={item.logoUrl ? undefined : true} aria-hidden="true">
    {item.logoUrl ? <img src={item.logoUrl} alt="" width={px} height={px} loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : monogram(item.name)}
  </span>;
}

export const applyTarget = (item) => ({ id: item.id, name: item.name, city: item.city, state: item.state || '', logoUrl: item.logoUrl || '' });

export function SourceTag({ item, className = '' }) {
  const tone = item.isIllustrative ? 'illustrative' : item.verification === 'verified' ? 'verified' : 'plain';
  return <span className={`${styles.source} ${className}`} data-tone={tone}>
    <Icon name={tone === 'verified' ? 'uniVerified' : 'uniInfo'} />{sourceNote(item)}
  </span>;
}

export default function UniversityCard({ item, courseNames = {}, headingLevel = 3 }) {
  const Heading = `h${headingLevel}`;
  const href = `/universities/${item.id}`;
  const fees = item.programmes;
  const kind = [kindOf(item), ownershipOf(item)].filter(Boolean).join(' · ');
  const badges = [
    item.naacGrade && { key: 'naac', icon: 'uniMedal', label: `NAAC ${item.naacGrade}` },
    item.nirfRank && { key: 'nirf', icon: 'uniRibbon', label: `NIRF ${nirfOf(item)}` },
    ...item.approvals.slice(0, 3).map((approval) => ({ key: approval, icon: 'uniVerified', label: approval })),
    item.establishedYear && { key: 'est', icon: 'uniCalendar', label: `Est. ${item.establishedYear}` },
  ].filter(Boolean);
  const courses = fees?.courseIds?.map((id) => courseNames[id] || id) || [];

  return <article className={styles.card} aria-labelledby={`uni-${item.id}`}>
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

    {item.streams.length > 0 && <p className={styles.streams}><span className="sr-only">Streams: </span>
      {item.streams.slice(0, 4).join(' · ')}{item.streams.length > 4 && <span className={styles.more}> +{item.streams.length - 4}</span>}
    </p>}

    {fees && fees.feeMin != null && <div className={styles.feeWell}>
      <p><span>Annual tuition{fees.tuitionYear ? ` · ${fees.tuitionYear}` : ''}</span><strong>{lakhRange(fees.feeMin, fees.feeMax)}</strong></p>
      {courses.length > 0 && <small>{fees.count === 1 ? '1 programme' : `${fees.count} programmes`}: {courses.slice(0, 4).join(', ')}{courses.length > 4 ? ` +${courses.length - 4}` : ''}</small>}
    </div>}

    <div className={styles.cardFoot}>
      <SourceTag item={item} />
      <div className={styles.cardActions}>
        <Link className="lux-button lux-button--ghost lux-button--sm" href={href}>View profile<span className="sr-only">: {item.name}</span></Link>
        <ApplyButton university={applyTarget(item)} className="lux-button--sm" />
      </div>
    </div>
  </article>;
}
