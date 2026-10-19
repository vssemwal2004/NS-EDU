'use client';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { api } from '@/lib/api/client';
import { placeOf } from '@/features/universities/labels';
import InstitutionBoard from './InstitutionBoard';
import InstitutionStage from './InstitutionStage';
import { boardWins, buildBoard, joinInstitutionNames } from './institution-rows';
import { UNI_COMPARE_MAX, cleanSlugs, uniCompareHref, useUniCompare, writeSlugs } from './institutionStore';
import styles from './InstitutionCompare.module.css';

const noop = () => () => {};
// Native share sheet only on touch devices; desktops get "Copy link".
const canShareSnapshot = () => Boolean(window.navigator.share) && window.matchMedia('(pointer: coarse)').matches;

function replaceUrl(slugs) {
  const url = new URL(window.location.href);
  url.searchParams.delete('course');
  url.searchParams.delete('c');
  if (slugs.length) url.searchParams.set('u', slugs.join(',')); else url.searchParams.delete('u');
  const query = url.searchParams.toString().replaceAll('%2C', ',');
  window.history.replaceState(window.history.state, '', `${url.pathname}${query ? `?${query}` : ''}${url.hash}`);
}

export default function InstitutionCompareView({ initialSlugs = [], initialDetails = [], intro = null }) {
  const store = useUniCompare();
  const canShare = useSyncExternalStore(noop, canShareSnapshot, () => false);
  const [touched, setTouched] = useState(false);
  const [highlight, setHighlight] = useState(false);
  const [message, setMessage] = useState('');
  const [share, setShare] = useState({ status: '', url: '' });
  const pickerRef = useRef(null);
  const focusPicker = useRef(false);

  // Details cache: seeded with whatever the server already loaded for the ?u= slugs.
  const [cache, setCache] = useState(() => new Map(initialDetails.filter((entry) => entry?.item?.id).map((entry) => [entry.item.id, entry])));
  const inFlight = useRef(new Set());
  const put = useCallback((slug, value) => setCache((current) => new Map(current).set(slug, value)), []);

  // Until the visitor touches anything the link wins, so the server and client first render agree.
  const fromUrl = !touched && initialSlugs.length > 0;
  const slugs = useMemo(() => (fromUrl ? cleanSlugs(initialSlugs) : store.slugs), [fromUrl, initialSlugs, store.slugs]);
  const ready = fromUrl || store.ready;

  // A shared link's picks are copied into the shortlist once, so the cards and other tabs agree.
  useEffect(() => { if (initialSlugs.length) writeSlugs(initialSlugs); }, [initialSlugs]);

  useEffect(() => {
    for (const slug of slugs) {
      if (cache.has(slug) || inFlight.current.has(slug)) continue;
      inFlight.current.add(slug);
      api(`/universities/${encodeURIComponent(slug)}`).then(
        (data) => put(slug, data?.item ? data : { error: 'missing' }),
        (error) => put(slug, { error: error?.status === 404 ? 'missing' : 'failed' }),
      ).finally(() => inFlight.current.delete(slug));
    }
  }, [slugs, cache, put]);

  useEffect(() => {
    if (!focusPicker.current) return;
    focusPicker.current = false;
    pickerRef.current?.focus();
  });

  // At most three records with ~24 rows each, so the board is rebuilt on render rather than memoised.
  const loaded = slugs.map((slug) => cache.get(slug)).filter((entry) => entry?.item);
  const errors = Object.fromEntries(slugs.map((slug) => [slug, cache.get(slug)?.error]).filter(([, value]) => value));
  const board = buildBoard(loaded);
  const wins = boardWins(board);

  const commit = useCallback((next) => {
    const clean = writeSlugs(next);
    setTouched(true);
    replaceUrl(clean);
    return clean;
  }, []);

  function add(item) {
    if (slugs.length >= UNI_COMPARE_MAX) { setMessage(`You can compare up to ${UNI_COMPARE_MAX} institutions. Remove one first.`); return; }
    if (slugs.includes(item.id)) { setMessage(`${item.name} is already in the comparison.`); return; }
    commit([...slugs, item.id]);
    focusPicker.current = slugs.length + 1 < UNI_COMPARE_MAX;
    setMessage(`${item.name} added · ${slugs.length + 1} of ${UNI_COMPARE_MAX} slots used`);
  }
  function remove(slug) {
    const name = cache.get(slug)?.item?.name || slug;
    commit(slugs.filter((item) => item !== slug));
    focusPicker.current = true;
    setMessage(`${name} removed · ${slugs.length - 1} of ${UNI_COMPARE_MAX} slots used`);
  }
  function retry(slug) { setCache((current) => { const next = new Map(current); next.delete(slug); return next; }); }
  function clear() { commit([]); setHighlight(false); focusPicker.current = true; setMessage('Comparison cleared'); }

  async function shareLink() {
    const url = new URL(uniCompareHref(slugs), window.location.origin).href;
    if (canShare) {
      try { await window.navigator.share({ title: document.title, url }); } catch (error) { if (error?.name !== 'AbortError') setShare({ status: 'failed', url }); }
      return;
    }
    try {
      await window.navigator.clipboard.writeText(url);
      setShare({ status: 'copied', url });
      window.setTimeout(() => setShare((current) => (current.status === 'copied' ? { status: '', url: '' } : current)), 4000);
    } catch { setShare({ status: 'failed', url }); }
  }

  const showBoard = ready && board.facts.length > 0;
  const comparing = board.facts.length > 1;
  const seen = new Map();
  for (const entry of board.facts) for (const row of entry.similar) if (!slugs.includes(row.id) && !seen.has(row.id)) seen.set(row.id, row);
  const suggestions = [...seen.values()].slice(0, 8);

  return <div className={styles.page}>
    <section className={`lux-surface-dark ${styles.stage}`} aria-labelledby="compare-title" id="comparison" data-board={showBoard || undefined}>
      <div className={`lux-container ${styles.stageInner}`}>
        <div className={styles.stageHead}>
          <div className={styles.intro}>{intro}</div>
          <div className={styles.controls}>
            <p className={styles.controlLabel}>Your shortlist</p>
            <p className={styles.controlHint}>Pick up to {UNI_COMPARE_MAX} institutions. The shortlist is kept on this device and the link below carries it to anyone you send it to.</p>
            {slugs.length > 0 && <div className={styles.controlRow}>
              <button type="button" className="lux-button lux-button--ghost lux-button--sm" onClick={shareLink}>
                <Icon name={canShare ? 'compareShare' : 'compareLink'} />{canShare ? 'Share' : 'Copy link'}
              </button>
              <button type="button" className={`lux-button lux-button--ghost lux-button--sm ${styles.print}`} onClick={() => window.print()}><Icon name="comparePrint" />Print</button>
              <button type="button" className={styles.textButton} onClick={clear}>Clear</button>
            </div>}
            <p className={styles.shareStatus} role="status">
              {share.status === 'copied' ? <><Icon name="check" />Link copied</> : share.status === 'failed' ? 'Copy failed — select the link below' : ''}
            </p>
            {share.status === 'failed' && <label className={styles.shareField}><span className="sr-only">Comparison link</span>
              <input className="lux-field" readOnly value={share.url} onFocus={(event) => event.target.select()} /></label>}
          </div>
        </div>

        <InstitutionStage slugs={slugs} facts={board.facts} errors={errors} ready={ready}
          onAdd={add} onRemove={remove} onRetry={retry} pickerRef={pickerRef} />

        {ready && slugs.length === 1 && <p className={styles.oneMore}><Icon name="compareInfo" />Add one more institution to compare. The table below already shows everything on record for this one.</p>}
      </div>
    </section>
    <p className="sr-only" role="status" aria-live="polite">{message}</p>

    {showBoard && <div className={`lux-container ${styles.board}`}>
      {comparing && wins.length > 0 && <section className={styles.verdict} aria-label="Where the figures differ">
        <h2 className={styles.verdictTitle}>Where the published figures differ</h2>
        <ul>{wins.map((win) => <li key={win.key}>
          <span className={styles.verdictIcon} aria-hidden="true"><Icon name="compareTrophy" /></span>
          <span className={styles.verdictLabel}>{win.label}</span>
          <span className={styles.verdictName}>{win.name}</span>
          <span className={styles.verdictValue}>{win.value}{win.sub && <small>{win.sub}</small>}</span>
        </li>)}</ul>
        <p className={styles.verdictFoot}>Compares only the institutions you picked, only where both published the same figure for the same year. It is not a ranking.</p>
      </section>}

      <div className={styles.toolbar}>
        <nav className={styles.jump} aria-label="Comparison sections">
          {board.sections.map((section) => <a key={section.id} className={styles.jumpLink} href={`#${section.id}`}>{section.label}</a>)}
        </nav>
        <button type="button" className={styles.switch} aria-pressed={highlight && comparing} disabled={!comparing} onClick={() => setHighlight(!highlight)}
          title={comparing ? undefined : 'Add a second institution to highlight differences'}>
          <span className={styles.switchTrack} aria-hidden="true"><span /></span><Icon name="compareDiff" />Highlight the better figure
        </button>
      </div>

      <InstitutionBoard board={board} highlight={highlight && comparing} onRemove={remove} />

      {board.hidden.length > 0 && <p className={styles.gap}>
        <Icon name="compareInfo" />
        <span>Nothing is on record yet for <strong>{board.hidden.join(', ').toLowerCase()}</strong> at {board.facts.length === 1 ? 'this institution' : 'any of these institutions'}, so {board.hidden.length === 1 ? 'that section is' : 'those sections are'} not shown. We would rather leave a gap than fill one in.</span>
      </p>}

      <aside className={styles.footnote} aria-label="About this data">
        <Icon name="compareInfo" />
        <div>
          <p><strong>Read this before you decide.</strong> Everything above is reproduced from the institution&apos;s own website or from a dated public directory snapshot, with the source shown in the last section. NAAC, NIRF, AICTE, UGC and NBA entries are <strong>historical snapshots, not a confirmation that an approval is current</strong>, and they are not a Gyaan Vidhya rating or ranking. Blank cells mean the figure is not published, not that it is zero.</p>
          {board.caveats.length > 0 && <ul className={styles.caveats}>{board.caveats.map((note) => <li key={note}>{note}</li>)}</ul>}
          <p className={styles.footLinks}>
            <Link className="lux-link" href="/universities">Browse all institutions<Icon name="arrow" /></Link>
            <Link className="lux-link" href="/compare?course=btech">Compare fees course by course<Icon name="arrow" /></Link>
          </p>
        </div>
      </aside>
    </div>}

    {ready && slugs.length === 0 && <div className={`lux-container ${styles.emptyBoard}`}>
      <div className="lux-state">
        <Icon name="compareColumns" />
        <h2 className="lux-title">Nothing in the arena yet</h2>
        <p>Search above for any of the 9,000+ listed institutions, or add them from the directory with the <strong>Compare</strong> button on each card.</p>
        <Link className="lux-button lux-button--primary" href="/universities">Browse the directory<Icon name="arrow" /></Link>
      </div>
    </div>}

    {showBoard && suggestions.length > 0 && slugs.length < UNI_COMPARE_MAX && <section className={`lux-container ${styles.suggestions}`} aria-labelledby="compare-similar">
      <h2 id="compare-similar" className="lux-display-3">Add one more</h2>
      <p className={styles.subtle}>Listed in the same state or teaching the same streams as {joinInstitutionNames(board.facts)}. Not a recommendation.</p>
      <ul className={styles.suggestionGrid}>{suggestions.map((row) => <li key={row.id}>
        <button type="button" className={styles.suggestionChip} onClick={() => add(row)}>
          <Icon name="plus" /><span><strong>{row.name}</strong><small>{placeOf(row) || 'Location not listed'}</small></span>
        </button>
      </li>)}</ul>
    </section>}
  </div>;
}
