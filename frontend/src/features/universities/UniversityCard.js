import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { CATEGORY_LABELS, TYPE_LABELS, formatInr, labelOf, monogram, placeOf, sourceNote } from './labels';
import styles from './Universities.module.css';

export function UniversityLogo({ item, size = 'md' }) {
  // Logos are remote URLs from many hosts (official sites, Cloudinary), so a plain lazy <img> is used.
  return item.logoUrl ? <img className={styles.logo} data-size={size} src={item.logoUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    : <span className={styles.logo} data-size={size} data-fallback aria-hidden="true">{monogram(item.name)}</span>;
}

export default function UniversityCard({ item, courseNames = {} }) {
  const href = `/universities/${item.id}`;
  const fees = item.programmes;
  const badges = [
    item.category && item.category !== 'other' ? labelOf(CATEGORY_LABELS, item.category) : labelOf(TYPE_LABELS, item.type),
    item.establishedYear && `Est. ${item.establishedYear}`,
    item.naacGrade && `NAAC ${item.naacGrade}`,
    item.nirfRank && `NIRF #${item.nirfRank}${item.nirfYear ? ` (${item.nirfYear})` : ''}`,
    ...item.approvals.slice(0, 3),
  ].filter(Boolean);
  return <article className={styles.card} aria-labelledby={`uni-${item.id}`}>
    <UniversityLogo item={item} />
    <div className={styles.cardMain}>
      <h3 id={`uni-${item.id}`}><Link href={href}>{item.name}</Link></h3>
      <p className={styles.cardMeta}>
        <span><Icon name="location" />{placeOf(item) || 'Location not listed'}</span>
        <span className={styles.source} data-verified={item.verification === 'verified' || undefined}><Icon name={item.verification === 'verified' ? 'shield' : 'collegesInfo'} />{sourceNote(item)}</span>
      </p>
      {badges.length > 0 && <ul className={styles.badges} aria-label="Key facts">{badges.map((badge) => <li key={badge}>{badge}</li>)}</ul>}
      {item.streams.length > 0 && <p className={styles.streams}><Icon name="book" />{item.streams.slice(0, 5).join(' · ')}{item.streams.length > 5 ? ` +${item.streams.length - 5}` : ''}</p>}
      {fees && <p className={styles.fees}><Icon name="collegesRupee" /><span>
        <strong>{fees.feeMin === fees.feeMax ? formatInr(fees.feeMin) : `${formatInr(fees.feeMin)} – ${formatInr(fees.feeMax)}`}</strong> annual tuition{fees.tuitionYear ? ` (${fees.tuitionYear})` : ''}
        <small>{fees.courseIds.map((id) => courseNames[id] || id).join(', ')}</small>
      </span></p>}
    </div>
    <div className={styles.cardActions}>
      <Link className="button button--primary" href={`/apply?university=${encodeURIComponent(item.id)}`}>Apply<span className="sr-only"> to {item.name}</span><Icon name="arrow" /></Link>
      <Link className="button button--outline" href={href}>View profile<span className="sr-only">: {item.name}</span></Link>
    </div>
  </article>;
}
