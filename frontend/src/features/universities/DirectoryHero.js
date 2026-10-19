import Icon from '@/components/ui/Icon';
import { DirLink } from './DirectoryState';
import SearchBox from './SearchBox';
import { directoryHref } from './directory-url';
import { formatCount } from './labels';
import styles from './Directory.module.css';

// Dark "search console": headline, the large search, state quick-picks and a live readout.
export default function DirectoryHero({ params, facets, result }) {
  const picks = facets.states.toSorted((a, b) => b.count - a.count).slice(0, 6);
  if (params.state && !picks.some((row) => row.value === params.state)) picks.unshift({ value: params.state });
  const matching = result.failed ? null : result.total;
  const scope = params.city || params.state || 'India';
  const readout = [
    matching !== facets.total && { label: 'In the directory', value: facets.total },
    { label: 'States & UTs', value: facets.states.length },
    { label: 'Streams', value: facets.streams.length },
  ].filter((row) => row && row.value);

  return <section className={`lux-surface-dark ${styles.hero}`} aria-labelledby="directory-title">
    <div className={styles.heroPattern} aria-hidden="true" />
    <div className={`lux-container lux-container--wide ${styles.heroInner}`}>
      <div className={styles.heroMain}>
        <p className="lux-eyebrow lux-eyebrow--rule">University directory</p>
        <h1 id="directory-title" className={`lux-display-1 ${styles.heroTitle}`}>Find your <span>university</span></h1>
        <p className={styles.heroLead}>Search universities and colleges by name, city or state. Narrow by stream, course and accreditation, then apply with one short form.</p>
        <SearchBox />
        {picks.length > 0 && <nav className={styles.picks} aria-label="Browse by state">
          <span className={styles.picksLabel}>Popular states</span>
          <ul>
            <li><DirLink className="lux-chip" href={directoryHref(params, { state: '' })} aria-current={!params.state ? 'page' : undefined}><Icon name="uniCompass" />All India</DirLink></li>
            {picks.map((row) => <li key={row.value}>
              <DirLink className="lux-chip" href={directoryHref(params, { state: row.value })} aria-current={params.state === row.value ? 'page' : undefined}>{row.value}</DirLink>
            </li>)}
          </ul>
        </nav>}
      </div>

      <aside className={styles.readout} aria-label="Directory at a glance">
        <p className={styles.readoutLabel}>Matching in {scope}</p>
        <p className={styles.readoutValue}>{matching == null ? '—' : formatCount(matching)}</p>
        <p className={styles.readoutCaption}>{matching == null ? 'Directory temporarily unavailable' : matching === 1 ? 'institution' : 'institutions'}</p>
        {readout.length > 0 && <dl className={styles.readoutStats}>
          {readout.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{formatCount(row.value)}</dd></div>)}
        </dl>}
        <a className={styles.readoutJump} href="#directory-results">See results<Icon name="arrow" /></a>
      </aside>
    </div>
  </section>;
}
