'use client';
// Data pipeline › Import: universities (upload → dry run → import) or the course catalogue.
import { useState } from 'react';
import { PageToolbar, ViewTabs } from '../ui/Page';
import ImportCourses from './ImportCourses';
import ImportUniversities from './ImportUniversities';
import styles from '../catalogue/Catalogue.module.css';

export default function ImportScreen({ initialKind = 'universities' }) {
  const [kind, setKind] = useState(initialKind === 'courses' ? 'courses' : 'universities');
  return <div className={styles.screen}>
    <PageToolbar start={<><ViewTabs label="What to import" value={kind} onChange={setKind} items={[
      { key: 'universities', label: 'Universities', icon: 'building' },
      { key: 'courses', label: 'Courses', icon: 'book' },
    ]} /><span className={styles.toolbarCount}>{kind === 'universities' ? 'Check a file with a dry run first; nothing is written until you import.' : 'Add degrees or import courses; institutions relink to them.'}</span></>} />
    {kind === 'universities' ? <ImportUniversities /> : <ImportCourses />}
  </div>;
}
