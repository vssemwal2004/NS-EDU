import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './Detail.module.css';

// Hero for course and exam detail pages: breadcrumb, title block, actions and a quick-facts <dl>.
export default function DetailHero({ crumbs, icon, eyebrow, title, subtitle, summary, actions, facts, factsTitle = 'At a glance', factsTag, children }) {
  return <section className={styles.hero} aria-labelledby="page-title">
    <svg className={styles.heroLines} viewBox="0 0 600 260" fill="none" aria-hidden="true"><path d="M0 220C110 200 190 110 310 118s210 96 290 64M0 244C130 226 220 140 330 146s190 84 270 58M380 0c14 52 80 92 160 98M440 0c10 34 52 58 110 62" /></svg>
    <div className={`container ${styles.heroInner}`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <ol>{crumbs.map((crumb, index) => <li key={crumb.label}>
          {index > 0 && <Icon name="chevron" />}
          {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
        </li>)}</ol>
      </nav>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.heroEyebrow}><span className={styles.heroIcon}><Icon name={icon} /></span>{eyebrow}</p>
          <h1 id="page-title">{title}</h1>
          {subtitle && <p className={styles.heroSubtitle}>{subtitle}</p>}
          <p className={styles.heroSummary}>{summary}</p>
          {children}
          <div className={styles.heroActions}>{actions}</div>
        </div>
        <div className={styles.factsPanel}>
          <div className={styles.factsHead}><h2>{factsTitle}</h2>{factsTag && <span className={styles.tag}>{factsTag}</span>}</div>
          <dl className={styles.facts}>{facts.map((fact) => <div key={fact.label} className={styles.fact}>
            <dt><Icon name={fact.icon} />{fact.label}</dt>
            <dd>{fact.value}{fact.note && <small>{fact.note}</small>}</dd>
          </div>)}</dl>
        </div>
      </div>
    </div>
  </section>;
}
