import Form from 'next/form';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { UniversityLogo } from '@/features/universities/Imagery';
import { formatCount, hostOf, placeOf } from '@/features/universities/labels';
import { feeFacts, formatLakh, plural } from './data';
import styles from './CourseInstitutions.module.css';

function pageHref(courseId, filters, page) {
  const params = new URLSearchParams({ ...filters, ...(page > 1 ? { page: String(page) } : {}) });
  if (page <= 1) params.delete('page');
  const query = params.toString();
  return `/courses/${courseId}${query ? `?${query}` : ''}#colleges`;
}

const SORTS = [['popular', 'Most viewed'], ['fee', 'Fee: low to high'], ['-fee', 'Fee: high to low'], ['name', 'Name']];
// Phones show this many programme rows per institution (CSS); the "All … programmes" link then
// appears there too, even when the desktop list is complete.
const PHONE_ROWS = 3;

// One programme row as the institution prints it: its own name, duration and each published fee
// with the period it is for. Nothing is converted or estimated.
function Programme({ row }) {
  const fees = feeFacts(row);
  return <li className={styles.programme}>
    <span className={styles.programmeName}>{row.name}</span>
    <span className={styles.programmeMeta}>
      {row.durationYears ? <span>{row.durationYears} {row.durationYears === 1 ? 'year' : 'years'}</span> : null}
      {fees.length ? fees.map((fee) => <span key={fee.label} className={styles.fee}><strong>{fee.value}</strong> {fee.label}</span>)
        : <span className={styles.muted}>Fee not published</span>}
      {row.feeYear ? <span className={styles.session}>{row.feeYear}</span> : null}
      {row.sourcePage ? <a className={styles.source} href={row.sourcePage} target="_blank" rel="noopener noreferrer nofollow">{/\.pdf($|\?)/i.test(row.sourcePage) ? 'Fee document' : hostOf(row.sourcePage)}<Icon name="external" /></a> : null}
    </span>
  </li>;
}

export default function CourseInstitutions({ course, offerings, filters }) {
  if (!offerings) {
    return <div className={`lux-state ${styles.empty}`} role="status"><Icon name="building" /><p className="lux-title">Institutions are unavailable right now</p><p>Please refresh in a moment.</p></div>;
  }
  const { stats } = offerings;
  if (!stats.institutions) {
    return <div className={`lux-state ${styles.empty}`}><Icon name="building" /><p className="lux-title">No institution lists {course.name} yet</p>
      <p>Institutions are linked to a course from the programmes they publish. Search the directory by name instead.</p>
      <Link className="lux-button lux-button--outline" href="/universities">Search universities</Link></div>;
  }
  if (offerings.requiresLogin) {
    return <div className={styles.locked}>
      <Icon name="lock" />
      <div>
        <p className="lux-title">{formatCount(stats.institutions)} institutions list {course.name}</p>
        <p>Sign in to see each one with the programmes and fees it publishes — free for students.</p>
      </div>
      <Link className="lux-button lux-button--primary" href={`/universities?course=${course.id}`}>See the institutions<Icon name="arrow" /></Link>
    </div>;
  }

  const { items, total, page, pages } = offerings;
  const active = { ...(filters.state ? { state: filters.state } : {}), ...(filters.sort ? { sort: filters.sort } : {}) };
  return <div className={styles.wrap}>
    <Form action={`/courses/${course.id}`} scroll={false} className={styles.filters} aria-label={`Filter ${course.name} institutions`}>
      <label className={styles.field}><span>State / UT</span>
        <select name="state" defaultValue={filters.state ?? ''}>
          <option value="">All states ({formatCount(stats.institutions)})</option>
          {stats.states.map((state) => <option key={state.name} value={state.name}>{state.name} ({formatCount(state.count)})</option>)}
        </select>
      </label>
      <label className={styles.field}><span>Sort</span>
        <select name="sort" defaultValue={filters.sort || 'popular'}>
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button type="submit" className="lux-button lux-button--outline lux-button--sm">Apply</button>
      <p className={styles.count} role="status">{plural(total, 'institution')}{filters.state ? ` in ${filters.state}` : ''}</p>
    </Form>

    {items.length ? <ol className={styles.list}>
      {items.map((item) => <li key={item.id} className={styles.row}>
        <header className={styles.rowHead}>
          <UniversityLogo item={item} size="sm" />
          <div className={styles.identity}>
            <h3><Link href={`/universities/${item.id}`}>{item.name}</Link></h3>
            <p>{[placeOf(item), item.naacGrade && `NAAC ${item.naacGrade}`, item.nirfRank && `NIRF${item.nirfCategory ? ` ${item.nirfCategory}` : ''} #${item.nirfRank}`].filter(Boolean).join(' · ')}</p>
          </div>
          <div className={styles.from}>
            {item.feeFromInr != null ? <><strong>{formatLakh(item.feeFromInr)}</strong><span>a year, from</span></> : <span className={styles.muted}>See programmes</span>}
          </div>
        </header>
        <ul className={styles.programmes}>
          {item.programmes.map((row) => <Programme key={row.name} row={row} />)}
        </ul>
        {(item.rowCount > item.programmes.length || item.programmes.length > PHONE_ROWS) && <Link className={item.rowCount > item.programmes.length ? styles.more : `${styles.more} ${styles.phoneOnly}`} href={`/universities/${item.id}#courses`}>All {Math.max(item.rowCount, item.programmes.length)} {course.name} programmes<Icon name="arrow" /></Link>}
      </li>)}
    </ol> : <div className={`lux-state ${styles.empty}`}><Icon name="search" /><p className="lux-title">No institution in {filters.state} lists {course.name}</p>
      <Link className="lux-button lux-button--outline" scroll={false} href={pageHref(course.id, {}, 1)}>All states</Link></div>}

    {pages > 1 && <nav className={styles.pager} aria-label="Pages">
      {page > 1 ? <Link scroll={false} className={styles.back} href={pageHref(course.id, active, page - 1)}><Icon name="arrow" />Previous</Link> : <span />}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link scroll={false} href={pageHref(course.id, active, page + 1)}>Next<Icon name="arrow" /></Link> : <span />}
    </nav>}
  </div>;
}
