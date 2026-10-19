import Icon from '@/components/ui/Icon';
import Checklist from './Checklist';
import GuideExtras from './GuideExtras';
import { LuxLink } from './GuidePage';
import { hostname, isExternal, pad, plural, withIds } from './data';
import styles from './Scholarships.module.css';

// Scholarships: a champagne "funding" composition. Portals come from the managed catalogue list; no amounts,
// deadlines or award claims are shown anywhere.
export default function Scholarships({ guides, guide, portals }) {
  const { page, checklist } = guide;
  const sections = withIds(page.sections);
  const portalSection = sections.find((section) => section.links?.some((link) => isExternal(link.href)));
  const steps = sections.filter((section) => section !== portalSection);

  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={styles.hero}>
      <div className={`lux-container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="guideRibbon" />{page.category}</p>
          <h1 className="lux-display-2">{page.title}</h1>
          <p className="lux-lead">{page.description}</p>
          <div className={styles.heroActions}>
            <a className="lux-button lux-button--primary lux-button--lg" href="#portals">Official funding portals<Icon name="arrow" /></a>
            <a className="lux-button lux-button--ghost lux-button--lg" href="#funding-checklist">Open the checklist</a>
          </div>
        </div>
        <figure className={styles.seal} aria-label="Funding at a glance">
          <span className={styles.sealMark} aria-hidden="true"><Icon name="guideSeal" /></span>
          <dl>
            <div><dt>Official portals linked</dt><dd>{portals.length}</dd></div>
            <div><dt>Research steps to tick</dt><dd>{checklist.items.length}</dd></div>
          </dl>
          <figcaption>Amounts, eligibility and deadlines are set by each provider. Gyaan Vidhya never lists them second-hand.</figcaption>
        </figure>
      </div>
    </header>

    <section id="portals" className={`lux-container ${styles.portals}`} aria-labelledby="portals-title">
        <div className={styles.sectionHead}>
          <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="guidePortal" />Official sources</p>
          <h2 id="portals-title" className="lux-display-3">{portalSection?.title || 'Funding portals'}</h2>
          {portalSection?.text && <p className="lux-lead">{portalSection.text}</p>}
        </div>
        {portals.length ? <ul className={styles.portalGrid}>{portals.map((item, index) => <li key={item.id}>
          <a className={styles.portal} href={item.href} target="_blank" rel="noopener noreferrer">
            <span className={styles.portalIndex} aria-hidden="true">{pad(index)}</span>
            <span className={styles.portalIcon} aria-hidden="true"><Icon name="cap" /></span>
            <strong>{item.label}</strong>
            {item.description && <span className={styles.portalText}>{item.description}</span>}
            <span className={styles.portalFoot}>
              <span className={styles.host}><Icon name="guidesGlobe" />{hostname(item.href)}</span>
              <span className={styles.visit}>Visit site<Icon name="external" /></span>
            </span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>)}</ul> : <p className={styles.empty}>No funding portals are listed right now.</p>}
        <p className={styles.caveat}><Icon name="coursesInfo" />Confirm eligibility, amounts and deadlines on the provider’s own site before you apply.</p>
      </section>

      {steps.length > 0 && <section className={`lux-container ${styles.steps}`} aria-labelledby="approach-title">
        <div className={styles.sectionHead}>
          <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="guideRupee" />Before you apply</p>
          <h2 id="approach-title" className="lux-display-3">How to approach each scheme</h2>
        </div>
        <ol className={styles.stepGrid}>{steps.map((step, index) => <li key={step.id} id={step.id} className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">{pad(index)}</span>
          <h3 className="lux-title">{step.title}</h3>
          <p className={styles.stepText}>{step.text}</p>
          {step.points?.length > 0 && <ul className={styles.points}>{step.points.map((point) => <li key={point}><Icon name="check" />{point}</li>)}</ul>}
          {step.links?.length > 0 && <div className={styles.stepLinks}>{step.links.map((link) => <LuxLink key={link.href} {...link} />)}</div>}
        </li>)}</ol>
      </section>}

      <section id="funding-checklist" className={`lux-surface-dark ${styles.panel}`} aria-labelledby="checklist-title">
        <div className="lux-container">
          <Checklist guide="scholarships" variant="dark" eyebrow={`Eligibility & documents · ${plural(checklist.items.length, 'step')}`} icon="guideFiles" {...checklist} />
        </div>
      </section>

      <GuideExtras config={guide} toolList={guides.tools} scopeNote={guides.scopeNote} className={styles.extras} />
  </main>;
}
