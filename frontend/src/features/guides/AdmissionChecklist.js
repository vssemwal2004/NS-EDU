import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { BoardBar, BoardSummary, TickGroup } from './AdmissionBoard';
import GuideExtras from './GuideExtras';
import { LuxLink } from './GuidePage';
import { hostname, pad, plural, slugify, withIds } from './data';
import styles from './AdmissionChecklist.module.css';

// Admission checklist: a printable "board" of grouped tick-lists. Each step's points become ticks; the
// documents list keeps its original item ids, so ticks saved before this layout still show.
export default function AdmissionChecklist({ guides, guide, exams }) {
  const { page, checklist, catalogSection } = guide;
  const steps = withIds(page.sections);
  const groups = [
    ...steps.map((step, index) => ({
      id: step.id, kicker: `Step ${pad(index)}`, title: step.title, text: step.text, links: step.links,
      items: (step.points || []).map((point) => ({ id: `${step.id}--${slugify(point)}`, label: point })),
    })).filter((group) => group.items.length),
    { id: 'documents', documents: true, kicker: 'Keep ready', title: checklist.title, text: checklist.intro, note: checklist.note, items: checklist.items },
  ];
  const allIds = groups.flatMap((group) => group.items.map((item) => item.id));

  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={styles.hero}>
      <div className={`lux-container ${styles.heroInner}`}>
        <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="guideBoard" />{page.category}</p>
        <h1 className="lux-display-2">{page.title}</h1>
        <p className="lux-lead">{page.description}</p>
        <ul className={styles.heroMeta}>
          <li><Icon name="guidesChecklist" />{plural(groups.length, 'group')} · {plural(allIds.length, 'tick')}</li>
          <li><Icon name="guideLock" />Saved only on this device</li>
          <li><Icon name="guidePrint" />Printable</li>
        </ul>
      </div>
    </header>

    <div className={`lux-container ${styles.board}`}>
      <aside id="board-summary" className={styles.aside} aria-label="Your progress">
        <BoardSummary groups={groups.map(({ id, title, items }) => ({ id, title, items }))} allIds={allIds} />
        <p className={styles.printNote}>Your institution’s official notice is the final word on documents and dates.</p>
      </aside>
      <div className={styles.groups}>
        {groups.map((group, index) => <TickGroup key={group.id} group={group} number={pad(index)} allIds={allIds} />)}
      </div>
    </div>

    {catalogSection && exams.length > 0 && <section id="official-exam-websites" className={styles.exams} aria-labelledby="exams-title">
      <div className="lux-container">
        <div className={styles.examsHead}>
          <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="document" />{catalogSection.toc || 'Official sources'}</p>
          <h2 id="exams-title" className="lux-display-3">{catalogSection.title}</h2>
          {catalogSection.text && <p className="lux-lead">{catalogSection.text}</p>}
        </div>
        <ul className={styles.examList}>{exams.map((exam) => <li key={exam.id}>
          <span className={styles.examIcon} aria-hidden="true"><Icon name={exam.icon} /></span>
          <span className={styles.examName}><small>{exam.field}</small><strong>{exam.name}</strong></span>
          <span className={styles.examLinks}>
            {exam.href && <a href={exam.href} target="_blank" rel="noopener noreferrer"><Icon name="guidesGlobe" />{hostname(exam.href)}<Icon name="external" /><span className="sr-only"> — {exam.name} official website (opens in a new tab)</span></a>}
            <Link href={`/exams/${exam.id}`}>Guide<span className="sr-only"> to {exam.name}</span><Icon name="arrow" /></Link>
          </span>
        </li>)}</ul>
        {catalogSection.links?.length > 0 && <div className={styles.examMore}>{catalogSection.links.map((link) => <LuxLink key={link.href} {...link} />)}</div>}
      </div>
    </section>}

    <GuideExtras config={guide} toolList={guides.tools} scopeNote={guides.scopeNote} className={styles.extras} />
    <BoardBar allIds={allIds} />
  </main>;
}
