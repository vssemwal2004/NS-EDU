import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './Home.module.css';

// Band heading row: eyebrow + serif title + description, with a top-right "View all" link.
export function BandHeading({ id, eyebrow, icon, title, description, href, linkLabel }) {
  return <div className={styles.bandHeading}>
    <div className={styles.bandCopy}>
      <p className={styles.bandEyebrow}><Icon name={icon} />{eyebrow}</p>
      <h2 id={id}>{title}</h2>
      {description && <p className={styles.bandDescription}>{description}</p>}
    </div>
    {href && <Link className={`text-link ${styles.bandLink}`} href={href}>{linkLabel}<Icon name="arrow" /></Link>}
  </div>;
}

// "View all" row placed directly under an embedded section (3–6) that owns its own heading.
// `narrow` aligns the row with sections that use the 1480px content width.
export function HomeSectionLink({ title, icon, meta, href, label, secondary, narrow = false }) {
  return <nav className={styles.sectionLink} aria-label={`More ${title.toLowerCase()}`}>
    <div className={`container ${styles.sectionLinkInner}`} data-narrow={narrow}>
      <p className={styles.sectionMeta}><span className={styles.sectionMetaIcon}><Icon name={icon} /></span><span>{meta}</span></p>
      <div className={styles.sectionActions}>
        {secondary && <Link className="text-link" href={secondary.href}>{secondary.label}<Icon name="arrow" /></Link>}
        <Link className={`button button--outline ${styles.sectionButton}`} href={href}>{label}<Icon name="arrow" /></Link>
      </div>
    </div>
  </nav>;
}
