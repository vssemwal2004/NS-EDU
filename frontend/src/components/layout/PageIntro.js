import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './PageIntro.module.css';

// Shared heading band for every feature route: breadcrumb, title, summary, an optional
// quick-facts aside and related tools. Optional extras: crumbs [{label, href}] between Home
// and the current page, stats [{value, label}] (catalogue-derived only), actions
// [{href, label, icon, variant}], a small meta line and a compact variant for utility pages.
export default function PageIntro({
  eyebrow, icon = 'compass', title, accent, description, related = [], children,
  crumbs = [], current, stats = [], statsNote, actions = [], meta, compact = false, relatedLabel = 'Related',
}) {
  const here = current || eyebrow || title;
  const aside = children || (stats.length > 0 && <div className={styles.stats}>
    <dl data-count={stats.length}>{stats.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
    {statsNote && <p>{statsNote}</p>}
  </div>);
  return <section className={`${styles.intro} ${compact ? styles.compact : ''}`} aria-labelledby="page-title">
    <svg className={styles.linework} viewBox="0 0 600 200" fill="none" aria-hidden="true"><path d="M0 170C120 150 210 60 330 70s200 90 270 60M0 190C140 170 230 90 340 96s190 80 260 52M420 0c10 40 60 70 120 76" /></svg>
    <div className={`container ${styles.inner}`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <ol>
          <li><Link href="/">Home</Link></li>
          {crumbs.map((crumb) => <li key={crumb.label}><Icon name="chevron" />{crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}</li>)}
          <li><Icon name="chevron" /><span aria-current="page">{here}</span></li>
        </ol>
      </nav>
      <div className={styles.content}>
        <div className={styles.copy}>
          {eyebrow && <p className={styles.eyebrow}><span><Icon name={icon} /></span>{eyebrow}</p>}
          <h1 id="page-title">{title}{accent && <> <em>{accent}</em></>}</h1>
          {description && <p className={styles.description}>{description}</p>}
          {meta && <p className={styles.meta}><Icon name="coursesInfo" />{meta}</p>}
          {actions.length > 0 && <div className={styles.actions}>{actions.map((action) => <Link key={action.href} className={`button button--${action.variant || 'primary'}`} href={action.href}>{action.icon && <Icon name={action.icon} />}{action.label}</Link>)}</div>}
        </div>
        {aside && <div className={styles.aside}>{aside}</div>}
      </div>
      {related.length > 0 && <div className={styles.relatedRow}>
        <span className={styles.relatedLabel} aria-hidden="true">{relatedLabel}</span>
        <nav className={styles.related} aria-label={relatedLabel === 'Related' ? 'Related tools' : relatedLabel}>
          {related.map((item) => <Link key={item.href} href={item.href}><Icon name={item.icon} />{item.label}<Icon name="arrow" /></Link>)}
        </nav>
      </div>}
    </div>
  </section>;
}
