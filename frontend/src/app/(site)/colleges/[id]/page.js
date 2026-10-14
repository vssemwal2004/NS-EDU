import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import CollegeArtwork from '@/features/landing/CollegeArtwork';
import { DestinationArt } from '@/features/landing/LocationArtwork';
import CompareToggle from '@/features/colleges/CompareToggle';
import PairCompare from '@/features/colleges/PairCompare';
import PlacementChart from '@/features/colleges/PlacementChart';
import ProfileNav from '@/features/colleges/ProfileNav';
import ProfileRail from '@/features/colleges/ProfileRail';
import styles from '@/features/colleges/Profile.module.css';
import { getCatalog } from '@/lib/api/catalog';
import { courseBenchmarks, formatSalary, formatTuition, getInstitution, lakhRange, placeName, similarInstitutions, summarize } from '@/lib/college-catalog';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'courses', label: 'Courses & fees' },
  { id: 'placements', label: 'Placements' },
  { id: 'location', label: 'Location' },
  { id: 'similar', label: 'Similar colleges' },
];
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

async function load(id) {
  const catalog = await getCatalog();
  const institution = getInstitution(catalog.colleges, decodeURIComponent(id));
  return institution && { catalog, institution };
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) return { title: 'College not found | NSEDU' };
  const { institution } = data;
  const summary = summarize(institution.rows);
  return {
    title: `${institution.name}: courses, fees & placements | NSEDU`,
    description: `Illustrative profile · ${plural(institution.rows.length, 'programme')} in ${placeName(institution)} · annual tuition ${lakhRange(summary.feeMin, summary.feeMax)} (${summary.tuitionYear}).`,
  };
}

export default async function CollegeProfilePage({ params }) {
  const { id } = await params;
  const data = await load(id);
  if (!data) notFound();
  const { catalog, institution } = data;
  const { rows, city, state } = institution;
  const courseById = new Map(catalog.courses.map((course) => [course.id, course]));
  const courseNames = Object.fromEntries(rows.map((row) => [row.courseId, { name: courseById.get(row.courseId)?.name || row.courseId, fullName: courseById.get(row.courseId)?.fullName || '' }]));
  const nameOf = (courseId) => courseNames[courseId]?.name || courseById.get(courseId)?.name || courseId;
  const summary = summarize(rows);
  const fields = [...new Set(rows.map((row) => courseById.get(row.courseId)?.field).filter(Boolean))];
  const best = rows.filter((row) => row.medianSalaryLpa != null).toSorted((a, b) => b.medianSalaryLpa - a.medianSalaryLpa)[0];
  const first = rows[0];
  const benchmarks = Object.fromEntries(courseBenchmarks(catalog.colleges));
  const others = (match) => new Set(catalog.colleges.filter((row) => row.collegeId !== institution.id && match(row)).map((row) => row.collegeId)).size;
  const cityCount = others((row) => row.city === city);
  const stateCount = state ? others((row) => row.state === state) : 0;
  const cityArt = catalog.cities.find((item) => item.name === city && item.crop);
  const similar = similarInstitutions(catalog.colleges, institution.id, 4);
  const pairs = [];
  for (const group of similar) {
    const other = group.shared.find((row) => !pairs.some((pair) => pair.courseId === row.courseId)) || group.shared[0];
    if (other && pairs.length < 3) pairs.push({ courseId: other.courseId, rows: [rows.find((row) => row.courseId === other.courseId), other], group });
  }

  return <main id="main" tabIndex={-1} className={styles.page}>
    <section id="profile-hero" className={styles.hero} aria-labelledby="page-title">
      <svg className={styles.heroLines} viewBox="0 0 600 200" fill="none" aria-hidden="true"><path d="M0 170C120 150 210 60 330 70s200 90 270 60M0 190C140 170 230 90 340 96s190 80 260 52M420 0c10 40 60 70 120 76" /></svg>
      <div className={`container ${styles.heroInner}`}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/">Home</Link><Icon name="chevron" /><Link href="/colleges">Colleges</Link><Icon name="chevron" /><span aria-current="page">{institution.shortName}</span>
        </nav>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span><Icon name="building" /></span>College profile</p>
            <h1 id="page-title">{institution.name}</h1>
            <p className={styles.heroMeta}>
              <Link href={`/colleges?location=${encodeURIComponent(city)}`}><Icon name="location" />{placeName(institution)}</Link>
              <span className={styles.ratingBadge}><Icon name="star" /><strong>{institution.demoRating.toFixed(1)}</strong> / 5 demo rating</span>
              <span className={styles.illustrative}><Icon name="collegesInfo" />Illustrative data</span>
            </p>
            <dl className={styles.facts}>
              <div><dt>Programmes listed</dt><dd>{rows.length}</dd><small>{list(rows.map((row) => nameOf(row.courseId)).slice(0, 4))}{rows.length > 4 ? ` +${rows.length - 4}` : ''}</small></div>
              <div><dt>Annual tuition</dt><dd>{lakhRange(summary.feeMin, summary.feeMax)}</dd><small>{summary.tuitionYear} · tuition only</small></div>
              <div><dt>Best median package</dt><dd data-missing={!best || undefined}>{best ? formatSalary(best.medianSalaryLpa) : 'Not provided'}</dd><small>{best ? `${nameOf(best.courseId)} · ${summary.placementYear}` : `No placement data · ${summary.placementYear}`}</small></div>
              <div><dt>Fields covered</dt><dd>{fields.length}</dd><small>{fields.join(', ')}</small></div>
            </dl>
            <div className={styles.heroActions}>
              <a className="button button--primary" href="#courses"><Icon name="compare" />Compare a course</a>
              <Link className="button button--outline" href={`/eligibility?course=${first.courseId}`}><Icon name="eligibility" />Check eligibility<span className="sr-only"> for {nameOf(first.courseId)}</span></Link>
              <Link className="text-link" href={`/budget?course=${first.courseId}`}><Icon name="wallet" />Estimate cost<Icon name="arrow" /></Link>
            </div>
          </div>
          <figure className={styles.heroArt}>
            <svg className={styles.heroArtLines} viewBox="0 0 400 250" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
              <path d="M0 210h400M0 222h400M30 210V120l50-34 50 34v90M60 210v-46h40v46M180 210V96l60-40 60 40v114M210 210v-58h60v58M330 210v-70l40-26 30 20" />
              <path d="M-20 60C80 30 140 90 240 54S360 10 420 34M-20 80C70 54 150 112 250 74S370 32 420 54" />
            </svg>
            <div className={styles.print}><CollegeArtwork row={institution} className={styles.printArt} detail /></div>
            <figcaption><Icon name="spark" />Illustrative campus artwork, not a photograph</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <ProfileNav sections={SECTIONS} shortName={institution.shortName} heroId="profile-hero" />

    <div className={`container ${styles.body}`}>
      <div className={styles.main}>
        <section id="overview" className={styles.section} aria-labelledby="overview-title">
          <header className={styles.sectionHead}><h2 id="overview-title">Overview</h2><span className={styles.yearTag}>Fees {summary.tuitionYear} · placements {summary.placementYear}</span></header>
          <div className={styles.overviewGrid}>
            <div className={styles.overviewCopy}>
              <p className={styles.lede}>{institution.name} is an illustrative institution in {placeName(institution)}. NSEDU lists {plural(rows.length, 'programme')} here across {list(fields.map((field) => field.toLowerCase()))}, with annual tuition {summary.feeMin === summary.feeMax ? `of ${formatTuition(summary.feeMin)}` : `from ${formatTuition(summary.feeMin)} to ${formatTuition(summary.feeMax)}`} ({summary.tuitionYear}).</p>
              <p>{summary.withPlacements ? `${summary.withPlacements} of ${plural(rows.length, 'programme')} report placement figures for ${summary.placementYear}${summary.medianMin != null ? `, with median packages of ${summary.medianMin === summary.medianMax ? `₹${summary.medianMin} LPA` : `₹${summary.medianMin}–${summary.medianMax} LPA`}` : ''}.` : `None of the listed programmes report placement figures for ${summary.placementYear}.`} The demo rating is a preview score, not a ranking or a review average.</p>
              <ul className={styles.courseChips} aria-label="Programmes at this college">
                {rows.map((row) => <li key={row.id}><a href={`#course-${row.courseId}`}><Icon name={courseById.get(row.courseId)?.icon || 'cap'} />{nameOf(row.courseId)}<span>{formatTuition(row.annualTuitionInr)}/yr</span></a></li>)}
              </ul>
            </div>
            <aside className={styles.verify} aria-labelledby="verify-title">
              <h3 id="verify-title"><Icon name="shield" />Before you apply, verify</h3>
              <ul>
                <li><Icon name="check" />Official eligibility for your course</li>
                <li><Icon name="check" />Entrance exams the college accepts</li>
                <li><Icon name="check" />Full fees, including hostel and exam fees</li>
                <li><Icon name="check" />Refund policy and scholarship rules</li>
                <li><Icon name="check" />Application deadlines on the official site</li>
              </ul>
              <Link className="text-link" href="/admission-checklist">Open the admission checklist<Icon name="arrow" /></Link>
            </aside>
          </div>
        </section>

        <section id="courses" className={styles.section} aria-labelledby="courses-title">
          <header className={styles.sectionHead}><h2 id="courses-title">Courses &amp; fees</h2><span className={styles.yearTag}>{plural(rows.length, 'programme')}</span></header>
          <table className={styles.table}>
            <caption>Annual tuition for {summary.tuitionYear} and placement packages for {summary.placementYear}. Illustrative values; tuition excludes hostel and living costs.</caption>
            <thead><tr><th scope="col">Course</th><th scope="col">Field</th><th scope="col">Annual tuition <small>{summary.tuitionYear}</small></th><th scope="col">Median <small>{summary.placementYear}</small></th><th scope="col">Highest <small>{summary.placementYear}</small></th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{rows.map((row) => {
              const course = courseById.get(row.courseId);
              return <tr key={row.id} id={`course-${row.courseId}`}>
                <th scope="row"><span className={styles.courseCell}><span className={styles.courseIcon}><Icon name={course?.icon || 'cap'} /></span><span><strong>{nameOf(row.courseId)}</strong><small>{course?.fullName}</small></span></span></th>
                <td data-label="Field">{course?.field || '—'}</td>
                <td data-label={`Annual tuition · ${row.tuitionYear}`}><strong>{formatTuition(row.annualTuitionInr)}</strong></td>
                <td data-label={`Median · ${row.placementYear}`} data-missing={row.medianSalaryLpa == null || undefined}>{formatSalary(row.medianSalaryLpa)}</td>
                <td data-label={`Highest · ${row.placementYear}`} data-missing={row.highestSalaryLpa == null || undefined}>{formatSalary(row.highestSalaryLpa)}</td>
                <td className={styles.actionsCell}><div className={styles.rowActions}>
                  <CompareToggle row={row} courseName={nameOf(row.courseId)} compact />
                  <span className={styles.rowLinks}>
                    <Link href={`/eligibility?course=${row.courseId}`}>Eligibility<span className="sr-only"> for {nameOf(row.courseId)}</span></Link>
                    <Link href={`/colleges?course=${row.courseId}`}>Other colleges<span className="sr-only"> for {nameOf(row.courseId)}</span></Link>
                  </span>
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        </section>

        <section id="placements" className={styles.section} aria-labelledby="placements-title">
          <header className={styles.sectionHead}><h2 id="placements-title">Placements</h2><span className={styles.yearTag}>{summary.placementYear}</span></header>
          <p className={styles.sectionIntro}>The <strong>median</strong> package is the middle value: half of placed students earned more and half less. The <strong>highest</strong> is a single offer and says little about a typical outcome.</p>
          <ul className={styles.legend} aria-label="Chart legend">
            <li><span className={styles.swatchMedian} />Median package</li>
            <li><span className={styles.swatchHighest} />Highest package</li>
            {rows.some((row) => benchmarks[row.courseId] && row.medianSalaryLpa != null) && <li><span className={styles.swatchMarker} />Median across listed colleges for the course</li>}
          </ul>
          <PlacementChart rows={rows} courseNames={courseNames} benchmarks={benchmarks} />
          <p className={styles.caption}>Placement year {summary.placementYear} · illustrative values · not verified outcomes. Exact figures are in the Courses &amp; fees table above.</p>
        </section>

        <section id="location" className={styles.section} aria-labelledby="location-title">
          <header className={styles.sectionHead}><h2 id="location-title">Location</h2></header>
          <div className={styles.locationGrid} data-art={cityArt ? true : undefined}>
            {cityArt && <DestinationArt destination={cityArt} className={styles.locationArt} />}
            <div className={styles.locationCopy}>
              <p className={styles.locationPlace}><Icon name="location" /><span><strong>{city}</strong>{state ? `, ${state}` : ''}</span></p>
              <p>NSEDU lists {cityCount ? `${plural(cityCount, 'other college')} in ${city}` : `no other colleges in ${city}`}{state ? ` and ${plural(stateCount, 'other college')} across ${state}` : ''}. Compare living costs and travel before you decide; tuition is only part of the budget.</p>
              <div className={styles.locationLinks}>
                <Link className="button button--outline" href={`/colleges?location=${encodeURIComponent(city)}`}><Icon name="building" />Colleges in {city}</Link>
                {state && <Link className="button button--ghost" href={`/colleges?location=${encodeURIComponent(state)}`}><Icon name="map" />Colleges in {state}</Link>}
                <Link className="text-link" href="/locations">Explore study locations<Icon name="arrow" /></Link>
              </div>
            </div>
          </div>
        </section>

        <section id="similar" className={styles.section} aria-labelledby="similar-title">
          <header className={styles.sectionHead}><h2 id="similar-title">Similar colleges</h2><span className={styles.yearTag}>Shared courses and location</span></header>
          {similar.length ? <ul className={styles.similarGrid}>
            {similar.map((group) => {
              const from = Math.min(...group.rows.map((row) => row.annualTuitionInr));
              return <li key={group.id} className={styles.mini}>
                <CollegeArtwork row={group} className={styles.miniArt} />
                <div>
                  <h3><Link href={`/colleges/${group.id}`}>{group.name}</Link></h3>
                  <p className={styles.miniMeta}><Icon name="location" />{placeName(group)}<span><Icon name="star" />{group.demoRating.toFixed(1)} demo</span></p>
                  {group.shared.length > 0 ? <p className={styles.miniShared}>{group.shared.map((row) => <span key={row.id}>{nameOf(row.courseId)}</span>)}</p>
                    : <p className={styles.miniWhy}>{group.city === city ? `Also in ${city}` : `Also in ${group.state}`}</p>}
                  <p className={styles.miniFee}>From <strong>{formatTuition(from)}</strong>/yr</p>
                </div>
                <Link className="button button--ghost" href={`/colleges/${group.id}`}>View college<span className="sr-only">: {group.name}</span><Icon name="arrow" /></Link>
              </li>;
            })}
          </ul> : <p className={styles.sectionIntro}>No other listed college shares a course or location with {institution.shortName} yet. <Link href="/colleges">Browse all colleges</Link>.</p>}

          {pairs.length > 0 && <div className={styles.pairs}>
            <h3><Icon name="collegesVersus" />Compare head-to-head</h3>
            <ul>{pairs.map((pair) => <li key={`${pair.group.id}-${pair.courseId}`} className={styles.pair}>
              <p className={styles.pairCourse}>{nameOf(pair.courseId)}</p>
              <div className={styles.pairSides}>
                {pair.rows.map((row, index) => <div key={row.id} className={styles.pairSide}>{index > 0 && <em aria-hidden="true">vs</em>}<strong>{row.shortName}</strong><span>{formatTuition(row.annualTuitionInr)}/yr</span><span>Median {formatSalary(row.medianSalaryLpa)}</span></div>)}
              </div>
              <PairCompare rows={pair.rows} courseName={nameOf(pair.courseId)} />
            </li>)}</ul>
          </div>}
        </section>
      </div>

      <ProfileRail rows={rows} courseNames={courseNames} city={city} />
    </div>
  </main>;
}
