'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { filterCollegeRecords } from '@/lib/college-catalog';
import { useCatalog } from '@/providers/CatalogProvider';
import { usePreferences } from '@/providers/PreferencesProvider';
import { collegesHref, plural } from './catalog-nav';
import { useCatalogNav } from './useCatalogNav';
import styles from './Preferences.module.css';

// Course + city selects bound to the stored preference, with a live match count.
export function PreferenceFields({ idPrefix, onNavigate, variant = 'popover' }) {
  const { colleges, cityNames, findCourse } = useCatalog();
  const { streams, cities, cityCount } = useCatalogNav();
  const { course, city, setCourse, setCity } = usePreferences();
  const selected = findCourse(course);
  const count = filterCollegeRecords(colleges, { courseId: course, location: city }).length;
  const target = selected?.id || cities.find((item) => item.name === city)?.courseId || streams[0]?.topCourse;
  const cityOptions = city && !cityNames.includes(city) ? [city, ...cityNames] : cityNames;
  const what = `${selected ? `${selected.name} ` : ''}programme`;
  const where = city ? ` in ${city}` : '';
  const status = !course && !city ? `${plural(colleges.length, 'programme')} in the catalogue`
    : count ? `${plural(count, what)}${where}` : `No ${what}s listed${where} yet. Try another city.`;

  return <div className={styles.fields} data-variant={variant}>
    <label className={styles.field} htmlFor={`${idPrefix}-course`}>
      <span>Course</span>
      <span className={styles.select}><Icon name="cap" />
        <select id={`${idPrefix}-course`} value={course} onChange={(event) => setCourse(event.target.value)}>
          <option value="">Any course</option>
          {streams.map((stream) => <optgroup key={stream.id} label={stream.field}>{stream.courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
        </select><Icon name="chevron" />
      </span>
    </label>
    <label className={styles.field} htmlFor={`${idPrefix}-city`}>
      <span>City</span>
      <span className={styles.select}><Icon name="location" />
        <select id={`${idPrefix}-city`} value={city} onChange={(event) => setCity(event.target.value)}>
          <option value="">Any city</option>
          {cityOptions.map((name) => <option key={name} value={name}>{name}{cityCount(name) ? '' : ' (no programmes yet)'}</option>)}
        </select><Icon name="chevron" />
      </span>
    </label>
    <p className={styles.status} aria-live="polite" data-empty={Boolean(course || city) && !count}><Icon name={count ? 'check' : 'search'} /><span>{status}<small>Illustrative data</small></span></p>
    <div className={styles.fieldActions}>
      <Link className="button button--primary" href={collegesHref(target, count ? city : '')} onClick={onNavigate}>Show colleges<Icon name="arrow" /></Link>
      {(course || city) && <button type="button" className="button button--ghost" onClick={() => { setCourse(''); setCity(''); }}>Clear</button>}
    </div>
  </div>;
}

export default function PreferenceChip() {
  const { findCourse } = useCatalog();
  const { course, city } = usePreferences();
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const button = useRef(null);
  const name = findCourse(course)?.name;
  const label = name || city ? `${name || 'Any course'} · ${city || 'any city'}` : 'Set course & city';

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    const onPointer = (event) => { if (!wrapper.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [open]);

  return <div className={styles.chipWrap} ref={wrapper}>
    <button ref={button} type="button" className={styles.chip} aria-expanded={open} aria-controls="header-preference" onClick={() => setOpen(!open)}>
      <Icon name="location" /><span className="sr-only">Study preference: </span><span className={styles.chipLabel}>{label}</span><Icon name="chevron" />
    </button>
    <div id="header-preference" className={styles.popover} role="dialog" aria-labelledby="header-preference-title" hidden={!open}>
      {open && <>
        <p id="header-preference-title" className={styles.popoverTitle}>Your study preference</p>
        <p className={styles.popoverText}>Saved in this browser to personalise colleges, compare and tools.</p>
        <PreferenceFields idPrefix="header-preference" onNavigate={() => setOpen(false)} />
      </>}
    </div>
  </div>;
}
