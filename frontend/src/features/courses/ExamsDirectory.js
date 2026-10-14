'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useCatalog } from '@/providers/CatalogProvider';
import { EXAM_NOTES, examLevel, hostname, plural, relatedCourses } from './data';
import { FieldChips, LevelBadge, SearchBox, syncUrl } from './Filters';
import styles from './Listing.module.css';

export default function ExamsDirectory({ initialQuery = '', initialField = '' }) {
  const { exams, courses } = useCatalog();
  const [query, setQuery] = useState(initialQuery);
  const [field, setField] = useState(initialField);
  const fields = useMemo(() => [...new Set(exams.map((exam) => exam.field))].sort(), [exams]);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const related = useMemo(() => Object.fromEntries(exams.map((exam) => [exam.id, relatedCourses(exam, courses)])), [exams, courses]);
  const searched = exams.filter((exam) => {
    const text = [exam.name, exam.field, exam.summary, ...related[exam.id].map((course) => course.name)].join(' ').toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const visible = searched.filter((exam) => !field || exam.field === field);

  function update(patch) {
    if ('q' in patch) setQuery(patch.q);
    if ('field' in patch) setField(patch.field);
    syncUrl(Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, value.trim()])));
  }
  const clear = () => update({ q: '', field: '' });

  return <section className={`container ${styles.section}`} aria-label="Entrance exam guides">
    <div className={styles.toolbar}>
      <div className={styles.toolbarRow}>
        <SearchBox label="Search exams" value={query} placeholder="Search an exam or course, e.g. JEE Main or MBA" onChange={(value) => update({ q: value })} />
      </div>
      <FieldChips label="Filter by field" value={field} total={searched.length} items={fields.map((name) => ({ value: name, label: name, count: searched.filter((exam) => exam.field === name).length }))} onChange={(value) => update({ field: value })} />
    </div>

    <aside className={styles.callout} aria-labelledby="exam-callout-title">
      <span className={styles.calloutIcon}><Icon name="shield" /></span>
      <div>
        <h2 id="exam-callout-title">Official bulletins first</h2>
        <p>NSEDU does not reproduce exam dates, patterns, fees or cut-offs. Each guide points you to the official website, where the latest information bulletin is the only source to rely on.</p>
      </div>
    </aside>

    <div className={styles.resultBar}>
      <p role="status" className={styles.resultText}><strong>{[plural(visible.length, 'exam guide'), field, query.trim() && `“${query.trim()}”`].filter(Boolean).join(' · ')}</strong></p>
      {(field || query.trim()) && <button type="button" className={styles.clear} onClick={clear}><Icon name="close" />Clear all</button>}
    </div>

    {visible.length ? <div className={styles.examGrid}>{visible.map((exam) => {
      const level = examLevel(exam.id);
      const host = hostname(exam.href);
      return <article key={exam.id} id={exam.id} className={styles.examCard} aria-labelledby={`${exam.id}-title`}>
        <div className={styles.cardHead}>
          <span className={styles.cardIcon}><Icon name={exam.icon} /></span>
          <div className={styles.cardTitle}>
            <p className={styles.cardMeta}><span>{exam.field}</span>{level && <LevelBadge level={level} />}</p>
            <h2 id={`${exam.id}-title`}>{exam.name}</h2>
            {host && <p className={styles.cardSub}>Official source · {host}</p>}
          </div>
        </div>
        <p className={styles.cardText}>{exam.summary}</p>
        {EXAM_NOTES[exam.id] && <p className={styles.examNote}><Icon name="coursesInfo" />{EXAM_NOTES[exam.id]}</p>}
        <div className={styles.examCourses}>
          <p>Commonly used for</p>
          {related[exam.id].length ? <ul>{related[exam.id].map((course) => <li key={course.id}><Link href={`/courses/${course.id}`}>{course.name}</Link></li>)}</ul> : <span className={styles.muted}>No linked course in the catalogue yet</span>}
        </div>
        <p className={styles.examDates}><Icon name="calendar" />Dates &amp; eligibility: official bulletin only</p>
        <div className={styles.examActions}>
          <Link className="button button--primary" href={`/exams/${exam.id}`}>Exam guide<span className="sr-only">: {exam.name}</span><Icon name="arrow" /></Link>
          {exam.href && <a className="button button--outline" href={exam.href} target="_blank" rel="noopener noreferrer">Official website<Icon name="external" /><span className="sr-only"> for {exam.name} (opens in a new tab)</span></a>}
          <Link className="text-link" href="/news">Exam news<Icon name="arrow" /></Link>
        </div>
      </article>;
    })}</div> : <div className={styles.empty}>
      <Icon name="search" /><h2>No exam guides match</h2><p>Try the exam name, a course such as B.Tech, or a field such as Engineering.</p>
      <button type="button" className="button button--outline" onClick={clear}>Clear filters</button>
    </div>}
    <p className={styles.footnote}><Icon name="coursesInfo" />Course links are a general guide to where each exam is commonly used. Participating institutions and programmes change by cycle — always confirm in the official bulletin.</p>
  </section>;
}
