'use client';
import { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import styles from './Landing.module.css';
const tabs = ['Colleges', 'Courses', 'Exams'];
export default function SearchBox({ onBrowse }) {
  const [type, setType] = useState('Colleges');
  const [query, setQuery] = useState('');
  const id = useId();
  const placeholders = { Colleges: 'Search by college name, course or city', Courses: 'Search courses or a field of study', Exams: 'Search entrance exams, e.g. JEE Main' };
  function moveTab(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault(); setType(tabs[next]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  }
  return <div className={styles.searchBox}>
    <div className={styles.tabs} role="tablist" aria-label="What would you like to explore?">
      {tabs.map((tab, index) => <button key={tab} id={`${id}-${tab}`} role="tab" type="button" aria-selected={type === tab} tabIndex={type === tab ? 0 : -1} aria-controls={`${id}-panel`} onKeyDown={(event) => moveTab(event, index)} onClick={() => { setType(tab); setQuery(''); }}>{tab}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${type}`}>
      <form className={styles.heroSearch} role="search" onSubmit={(event) => { event.preventDefault(); onBrowse({ type, query: query.trim() }); }}>
        <div className={styles.searchInput}><Icon name="search" /><label className="sr-only" htmlFor={`${id}-query`}>Search {type.toLowerCase()}</label><input id={`${id}-query`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholders[type]} maxLength={120} autoComplete="off" enterKeyHint="search" /></div>
        <button className="button button--primary" type="submit">Search<Icon name="arrow" /></button>
      </form>
    </div>
  </div>;
}
