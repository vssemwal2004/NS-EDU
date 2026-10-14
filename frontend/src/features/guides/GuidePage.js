import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import GuideChecklist from './GuideChecklist';
import GuideToc from './GuideToc';
import { guides, scopeNote, slugify, tools as toolList } from './data';
import styles from './Guides.module.css';

const pad = (index) => String(index + 1).padStart(2, '0');

// Editorial guide layout: sticky TOC | numbered steps + FAQs + tools | sticky checklist.
// One DOM; grid areas reorder it for tablet and mobile.
export default function GuidePage({ guide, sections, note }) {
  const config = guides[guide];
  const steps = sections.map((section) => ({ ...section, id: section.id || slugify(section.title) }));
  const toc = [
    ...steps.map((step, index) => ({ id: step.id, label: step.toc || step.title, number: pad(index) })),
    { id: 'checklist', label: config.checklist.title, number: '✓', mobileOnly: true },
    { id: 'faqs', label: 'Questions', number: '?' },
    { id: 'keep-planning', label: 'Keep planning', number: '→' },
  ];

  return <div className={`container ${styles.layout}`}>
    <GuideToc items={toc} />
    <div className={styles.steps}>
      {steps.map((step, index) => <section key={step.id} id={step.id} className={styles.step} aria-labelledby={`${step.id}-title`}>
        <span className={styles.badge} aria-hidden="true">{pad(index)}</span>
        <div className={styles.stepBody}>
          <p className={styles.kicker}>Step {pad(index)}</p>
          <h2 id={`${step.id}-title`}>{step.title}</h2>
          <p className={styles.stepText}>{step.text}</p>
          {step.points?.length > 0 && <div className={styles.points}>
            <p>Key points</p>
            <ul>{step.points.map((point) => <li key={point}><Icon name="coursesCheckCircle" />{point}</li>)}</ul>
          </div>}
          {step.content}
          {step.links?.length > 0 && <ul className={styles.stepLinks}>{step.links.map((link) => <li key={link.href}><GuideLink {...link} /></li>)}</ul>}
        </div>
      </section>)}
    </div>

    <aside className={styles.aside} aria-label="Checklist">
      <GuideChecklist guide={guide} {...config.checklist} />
    </aside>

    <div className={styles.more}>
      <section id="faqs" className={styles.block} aria-labelledby="faqs-title">
        <header className={styles.blockHead}><p className={styles.kicker}>Questions</p><h2 id="faqs-title">Before you rely on this guide</h2></header>
        <div className={styles.faq}>{config.faqs.map((item, index) => <details key={item.q} open={index === 0}>
          <summary>{item.q}<Icon name="chevron" /></summary>
          <p>{item.a}{item.link && <> <Link href={item.link.href}>{item.link.label}</Link>.</>}</p>
        </details>)}</div>
      </section>

      <section id="keep-planning" className={styles.block} aria-labelledby="keep-planning-title">
        <header className={styles.blockHead}><p className={styles.kicker}>Keep planning</p><h2 id="keep-planning-title">Tools that work with this guide</h2></header>
        <ul className={styles.tools}>{config.tools.map((key) => { const tool = toolList[key]; return <li key={key}>
          <Link className={styles.tool} href={tool.href}><span className={styles.toolIcon}><Icon name={tool.icon} /></span><strong>{tool.title}</strong><span>{tool.text}</span><Icon name="arrow" /></Link>
        </li>; })}</ul>
      </section>

      <aside className={styles.note} aria-label="About this guide">
        <Icon name="coursesInfo" />
        <div><strong>What NSEDU does not do yet</strong><p>{scopeNote}{note && ` ${note}`}</p></div>
      </aside>
    </div>
  </div>;
}

export function GuideLink({ href, label }) {
  if (!href.startsWith('https:')) return <Link className="text-link" href={href}>{label}<Icon name="arrow" /></Link>;
  return <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">{label}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>;
}
