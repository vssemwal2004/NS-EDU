'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { usePreferences } from '@/providers/PreferencesProvider';
import { collegesHref, courseHref, plural, withCourse } from './catalog-nav';
import { useCatalogNav } from './useCatalogNav';
import styles from './Mega.module.css';

// Whole course catalogue at a glance, grouped by field.
export default function MegaCourses({ id, onNavigate }) {
  const { streams, courses } = useCatalogNav();
  const { course } = usePreferences();
  const fieldHref = (field) => `/courses?field=${encodeURIComponent(field)}`;
  const preferred = courses.find((item) => item.id === course);

  return <div className={`${styles.card} ${styles.coursesCard}`}>
    <div className={styles.coursesMain}>
      <div className={styles.coursesHead}>
        <p className={styles.kicker}>Courses</p>
        <p className={styles.streamTitle}>Find your course by field</p>
        <p className={styles.headMeta}>{plural(courses.length, 'course')} across {plural(streams.length, 'field')}</p>
      </div>
      <div className={styles.fieldGrid}>
        {streams.map((stream) => <section key={stream.id} className={styles.fieldGroup} aria-labelledby={`${id}-${stream.id}`}>
          <Link id={`${id}-${stream.id}`} href={fieldHref(stream.field)} onClick={onNavigate} className={styles.fieldHeading}>
            <Icon name={stream.icon} />{stream.field}<small>{stream.courses.length}</small>
          </Link>
          <ul>
            {stream.courses.map((item) => <li key={item.id}><Link href={courseHref(item.id)} onClick={onNavigate} className={styles.courseItem}>
              <span><strong>{item.name}</strong>{item.popular && <span className={styles.tag}>Popular</span>}</span>
              <small>{item.fullName || `${item.field} programme`}</small>
            </Link></li>)}
          </ul>
        </section>)}
      </div>
    </div>
    <aside className={styles.side} aria-label="Course tools">
      <Link className={styles.feature} href={withCourse('/eligibility', preferred?.id)} onClick={onNavigate}>
        <span className={styles.featureEyebrow}>Two-minute check</span>
        <strong>Are you eligible{preferred ? ` for ${preferred.name}` : ''}?</strong>
        <span>Compare your marks and subjects with sample requirements.</span>
        <span className={styles.featureAction}>Check eligibility<Icon name="arrow" /></span>
      </Link>
      <Link className={styles.sideLink} href="/career-guidance" onClick={onNavigate}>
        <Icon name="compass" /><span><strong>Not sure what to study?</strong><small>Career guidance by interest</small></span>
      </Link>
      <Link className={styles.sideLink} href="/admission-checklist" onClick={onNavigate}>
        <Icon name="document" /><span><strong>Admission checklist</strong><small>Documents to prepare early</small></span>
      </Link>
    </aside>
    <div className={`${styles.panelFoot} ${styles.panelFootWide}`}>
      <Link href="/courses" onClick={onNavigate} className={styles.footLink}>All courses<Icon name="arrow" /></Link>
      {preferred && <Link href={collegesHref(preferred.id)} onClick={onNavigate} className={styles.footLink}>{preferred.name} colleges<Icon name="arrow" /></Link>}
      <p>Course details are general guidance. Confirm requirements with each institution.</p>
    </div>
  </div>;
}
