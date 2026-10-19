import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { isGatedPath } from '@/features/auth/gated-routes';
import { LuxLink } from './GuidePage';
import styles from './GuideExtras.module.css';

// Closing blocks shared by the three guides: FAQs, tool links and the scope note (all admin-edited content).
export default function GuideExtras({ config, toolList, scopeNote, className = '' }) {
  const tools = config.tools.filter((key) => toolList[key]).map((key) => ({ key, ...toolList[key] }));
  return <div className={`lux-container ${styles.extras} ${className}`}>
    <section id="faqs" className={styles.faqs} aria-labelledby="faqs-title">
      <p className="lux-eyebrow lux-eyebrow--rule">Questions</p>
      <h2 id="faqs-title" className="lux-display-3">Before you rely on this guide</h2>
      <div className={styles.faqList}>{config.faqs.map((item, index) => <details key={item.q} open={index === 0}>
        <summary><span>{item.q}</span><Icon name="plus" /></summary>
        <div className={styles.answer}><p>{item.a}</p>{item.link && <LuxLink {...item.link} />}</div>
      </details>)}</div>
    </section>

    {tools.length > 0 && <section id="keep-planning" className={styles.tools} aria-labelledby="keep-planning-title">
      <p className="lux-eyebrow lux-eyebrow--rule">Keep planning</p>
      <h2 id="keep-planning-title" className="lux-title">Tools that work with this guide</h2>
      <ul>{tools.map((tool) => <li key={tool.key}>
        <Link className={styles.tool} href={tool.href}>
          <span className={styles.toolIcon}><Icon name={tool.icon} /></span>
          <span className={styles.toolBody}><strong>{tool.title}</strong><small>{tool.text}</small>
            {isGatedPath(tool.href) && <em><Icon name="guideLock" />Sign in to use</em>}</span>
          <Icon name="arrow" />
        </Link>
      </li>)}</ul>
    </section>}

    {(scopeNote || config.note) && <aside className={styles.note} aria-label="About this guide">
      <Icon name="coursesInfo" />
      <p><strong>What Gyaan Vidhya does not do yet</strong>{[scopeNote, config.note].filter(Boolean).join(' ')}</p>
    </aside>}
  </div>;
}
