import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import Checklist from './Checklist';
import GuideExtras from './GuideExtras';
import { LuxLink } from './GuidePage';
import { pad, plural, slugify, withIds } from './data';
import styles from './CareerGuidance.module.css';

const LEVEL = { UG: 'Undergraduate', PG: 'Postgraduate' };

// Courses grouped by field, each with the catalogue exams that lead into it.
function streamsFrom(courses, exams) {
  const fields = [...new Set(courses.map((course) => course.field).filter(Boolean))].sort();
  return fields.map((field) => {
    const list = courses.filter((course) => course.field === field);
    const ids = new Set(list.map((course) => course.id));
    return { field, id: slugify(field), icon: list[0].icon, courses: list, exams: exams.filter((exam) => exam.courseSlugs?.some((slug) => ids.has(slug))) };
  });
}

// Career guidance: a dark "route" hero, then a vertical journey of questions ending at stream cards.
export default function CareerGuidance({ guides, guide, courses, exams }) {
  const { page, checklist, catalogSection } = guide;
  const steps = withIds(page.sections);
  const streams = streamsFrom(courses, exams);
  const exploreId = 'explore-by-field';
  const stops = [...steps.map((step) => ({ id: step.id, label: step.title })), ...(catalogSection && streams.length ? [{ id: exploreId, label: catalogSection.toc || catalogSection.title, end: true }] : [])];

  return <main id="main" tabIndex={-1} className={styles.page}>
    <header className={`lux-surface-dark ${styles.hero}`}>
      <svg className={styles.heroRoute} viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M-20 340 C 120 330, 160 220, 280 230 S 430 120, 520 110 S 600 40, 640 20" />
      </svg>
      <div className={`lux-container ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="guideCompassRose" />{page.category}</p>
          <h1 className="lux-display-2">{page.title}</h1>
          <p className="lux-lead">{page.description}</p>
          <dl className={styles.stats}>
            <div><dt>Courses</dt><dd>{courses.length}</dd></div>
            <div><dt>Fields</dt><dd>{streams.length}</dd></div>
            <div><dt>Exam guides</dt><dd>{exams.length}</dd></div>
          </dl>
          <p className={styles.statsNote}>Counts from the Gyaan Vidhya catalogue.</p>
        </div>
        <nav className={styles.route} aria-label="Your route">
          <p className={styles.routeTitle}>Your route · {plural(stops.length, 'stop')}</p>
          <ol>{stops.map((stop, index) => <li key={stop.id}>
            <a href={`#${stop.id}`}><span aria-hidden="true">{stop.end ? <Icon name="guideFlag" /> : pad(index)}</span>{stop.label}</a>
          </li>)}</ol>
        </nav>
      </div>
    </header>

    <div className={`lux-container ${styles.journey}`}>
      <ol className={styles.timeline}>
        {steps.map((step, index) => <li key={step.id} id={step.id} className={styles.stop}>
          <span className={styles.node} aria-hidden="true">{pad(index)}</span>
          <article className={styles.card}>
            <p className={styles.kicker}>Stop {pad(index)}</p>
            <h2 id={`${step.id}-title`} className="lux-display-3">{step.title}</h2>
            <p className={styles.text}>{step.text}</p>
            {step.points?.length > 0 && <div className={styles.ask}>
              <p><Icon name="guideQuestion" />Think about</p>
              <ul>{step.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </div>}
            {step.links?.length > 0 && <div className={styles.links}>{step.links.map((link) => <LuxLink key={link.href} {...link} />)}</div>}
          </article>
        </li>)}
        {stops.at(-1)?.end && <li className={`${styles.stop} ${styles.stopEnd}`}>
          <span className={styles.node} aria-hidden="true"><Icon name="guideFlag" /></span>
          <a className={styles.endCard} href={`#${exploreId}`}><span><small>Next stop</small>{catalogSection.title}</span><Icon name="arrow" /></a>
        </li>}
      </ol>
      <aside className={styles.aside} aria-labelledby="checklist-title">
        <Checklist guide="career-guidance" variant="paper" eyebrow="Ask yourself" icon="guideQuestion" {...checklist} />
      </aside>
    </div>

    {catalogSection && streams.length > 0 && <section id={exploreId} className={styles.streams} aria-labelledby={`${exploreId}-title`}>
      <div className="lux-container">
        <div className={styles.streamsHead}>
          <p className="lux-eyebrow lux-eyebrow--rule"><Icon name="guideRoute" />Streams</p>
          <h2 id={`${exploreId}-title`} className="lux-display-3">{catalogSection.title}</h2>
          {catalogSection.text && <p className="lux-lead">{catalogSection.text}</p>}
        </div>
        <ul className={styles.streamGrid}>{streams.map((stream) => <li key={stream.field} className={styles.stream}>
          <header className={styles.streamHead}>
            <span className={styles.streamIcon} aria-hidden="true"><Icon name={stream.icon} /></span>
            <h3 className="lux-title" id={`stream-${stream.id}`}>{stream.field}</h3>
            <span className={styles.streamCount}>{plural(stream.courses.length, 'course')}</span>
          </header>
          <ul className={styles.courseList} aria-labelledby={`stream-${stream.id}`}>{stream.courses.map((course) => <li key={course.id}>
            <Link href={`/courses/${course.id}`}>
              <span><strong>{course.name}</strong>{course.fullName && <small>{course.fullName}</small>}</span>
              {LEVEL[course.level] && <abbr className={styles.level} title={LEVEL[course.level]}>{course.level}</abbr>}
              <Icon name="arrow" />
            </Link>
          </li>)}</ul>
          {stream.exams.length > 0 && <footer className={styles.streamExams}>
            <span>Entrance exams</span>
            {stream.exams.map((exam) => <Link key={exam.id} href={`/exams/${exam.id}`} className={styles.examChip}>{exam.name}<span className="sr-only"> exam guide</span></Link>)}
          </footer>}
        </li>)}</ul>
      </div>
    </section>}

    <GuideExtras config={guide} toolList={guides.tools} scopeNote={guides.scopeNote} />
  </main>;
}
