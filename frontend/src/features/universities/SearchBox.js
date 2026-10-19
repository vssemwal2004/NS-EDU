'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useDirectory } from './DirectoryState';
import styles from './Directory.module.css';

// The only locally held state: the text being typed. Results follow the URL (debounced while typing).
export default function SearchBox() {
  const { params, pending, go } = useDirectory();
  const current = params.q || '';
  const [query, setQuery] = useState(current);
  const [seen, setSeen] = useState(current);
  const timer = useRef(0);
  if (current !== seen) { setSeen(current); setQuery(current); }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const search = (value) => go({ q: value.trim() }, { push: false });
  return <form role="search" action="/universities" className={styles.search} onSubmit={(event) => { event.preventDefault(); window.clearTimeout(timer.current); search(query); }}>
    <label htmlFor="university-search" className="sr-only">Search universities</label>
    <Icon name="search" className={styles.searchIcon} />
    <input id="university-search" name="q" className={styles.searchInput} type="search" placeholder="Name, city or state" autoComplete="off" maxLength={120} enterKeyHint="search"
      value={query} onChange={(event) => {
        const value = event.target.value;
        setQuery(value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => search(value), 350);
      }} />
    {pending && <span className={styles.spinner} aria-hidden="true" />}
    <button type="submit" className={`lux-button lux-button--gold ${styles.searchButton}`}><span className={styles.searchButtonText}>Search</span><Icon name="arrow" /></button>
  </form>;
}
