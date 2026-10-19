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
import own from '@/features/universities/Universities.module.css';
import UniversityCard, { UniversityLogo } from '@/features/universities/UniversityCard';
import { CATEGORY_LABELS, OWNERSHIP_LABELS, TYPE_LABELS, labelOf, placeOf, sourceNote } from '@/features/universities/labels';
import { getCatalog, getUniversity } from '@/lib/api/catalog';
import { courseBenchmarks, formatSalary, formatTuition, lakhRange, similarInstitutions, summarize } from '@/lib/college-catalog';

const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;
const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

async function load(slug) {
  const [detail, catalog] = await Promise.all([getUniversity(decodeURIComponent(slug)), getCatalog()]);
  if (!detail) return null;
  const { item } = detail;
  // Curated programme rows in the shape the compare/placement components already use.
  const rows = detail.programmes.map((row) => ({ ...row, collegeId: item.id, name: item.name, shortName: item.shortName || item.name, city: item.city, state: item.state, demoRating: item.demoRating, art: item.art, isIllustrative: item.isIllustrative }));
  return { ...detail, rows, catalog };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: 'University not found | Gyaan Vidhya' };
  const { item, rows } = data;
  const summary = rows.length ? summarize(rows) : null;
  const facts = [labelOf(TYPE_LABELS, item.type), placeOf(item), item.establishedYear && `established ${item.establishedYear}`, item.naacGrade && `NAAC ${item.naacGrade}`].filter(Boolean).join(' · ');
  return {
    title: `${item.name}${item.city ? `, ${item.city}` : ''}: courses, admission & contact | Gyaan Vidhya`,
    description: `${facts}.${summary ? ` Annual tuition ${lakhRange(summary.feeMin, summary.feeMax)} (${summary.tuitionYear}).` : ''} Apply to ${item.shortName || item.name} through Gyaan Vidhya.`.slice(0, 300),
    alternates: { canonical: `/universities/${item.id}` },
  };
}

function Fact({ label, children }) {
  return children ? <div><dt>{label}</dt><dd>{children}</dd></div> : null;
}

export default async function UniversityProfilePage({ params }) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { item, rows, courses, similar, catalog } = data;
  const hasRows = rows.length > 0;
  const courseById = new Map(catalog.courses.map((course) => [course.id, course]));
  const courseNames = Object.fromEntries(rows.map((row) => [row.courseId, { name: courseById.get(row.courseId)?.name || row.courseId, fullName: courseById.get(row.courseId)?.fullName || '' }]));
  const nameOf = (courseId) => courseNames[courseId]?.name || courseById.get(courseId)?.name || courseId;
  const summary = hasRows ? summarize(rows) : null;
  const benchmarks = hasRows ? Object.fromEntries(courseBenchmarks(catalog.colleges)) : {};
  const pairs = [];
  if (hasRows) {
    for (const group of similarInstitutions(catalog.colleges, item.id, 4)) {
      const other = group.shared.find((row) => !pairs.some((pair) => pair.courseId === row.courseId)) || group.shared[0];
      if (other && pairs.length < 3) pairs.push({ courseId: other.courseId, rows: [rows.find((row) => row.courseId === other.courseId), other], group });
    }
  }
  const cityArt = catalog.cities.find((city) => city.name === item.city && city.crop);
  const applyHref = `/apply?university=${encodeURIComponent(item.id)}`;
  const sections = [
    { id: 'overview', label: 'Overview' },
    (hasRows || courses.length || item.coursesOffered.length) && { id: 'courses', label: hasRows ? 'Courses & fees' : 'Courses' },
    hasRows && { id: 'placements', label: 'Placements' },
    { id: 'admissions', label: 'Admissions & contact' },
    { id: 'similar', label: 'Similar' },
  ].filter(Boolean);
  const facts = [
    { label: 'Type', value: item.category !== 'other' ? labelOf(CATEGORY_LABELS, item.category) : labelOf(TYPE_LABELS, item.type) },
    { label: 'Established', value: item.establishedYear },
    { label: 'Ownership', value: item.ownership !== 'unknown' ? labelOf(OWNERSHIP_LABELS, item.ownership) : '' },
    { label: 'NAAC grade', value: item.naacGrade },
    { label: 'NIRF rank', value: item.nirfRank ? `#${item.nirfRank}${item.nirfYear ? ` (${item.nirfYear})` : ''}` : '' },
    { label: 'Approvals', value: item.approvals.join(', ') },
    { label: 'Affiliated to', value: item.affiliatedTo },
  ].filter((fact) => fact.value);

  return <main id="main" tabIndex={-1} className={styles.page}>
    <section id="profile-hero" className={styles.hero} aria-labelledby="page-title">
      <svg className={styles.heroLines} viewBox="0 0 600 200" fill="none" aria-hidden="true"><path d="M0 170C120 150 210 60 330 70s200 90 270 60M0 190C140 170 230 90 340 96s190 80 260 52M420 0c10 40 60 70 120 76" /></svg>
      <div className={`container ${styles.heroInner}`}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/">Home</Link><Icon name="chevron" /><Link href="/universities">Universities</Link><Icon name="chevron" /><span aria-current="page">{item.shortName || item.name}</span>
        </nav>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}><span><Icon name="building" /></span>{labelOf(TYPE_LABELS, item.type)} profile</p>
            <h1 id="page-title">{item.name}</h1>
            <p className={styles.heroMeta}>
              {item.city && <Link href={`/universities?${new URLSearchParams(item.state ? { state: item.state, city: item.city } : { q: item.city })}`}><Icon name="location" />{placeOf(item)}</Link>}
              {item.demoRating != null && item.isIllustrative && <span className={styles.ratingBadge}><Icon name="star" /><strong>{item.demoRating.toFixed(1)}</strong> / 5 demo rating</span>}
              <span className={styles.illustrative}><Icon name={item.verification === 'verified' ? 'shield' : 'collegesInfo'} />{item.isIllustrative ? 'Illustrative data' : sourceNote(item)}</span>
            </p>
            {hasRows ? <dl className={styles.facts}>
              <div><dt>Programmes listed</dt><dd>{rows.length}</dd><small>{rows.slice(0, 4).map((row) => nameOf(row.courseId)).join(', ')}{rows.length > 4 ? ` +${rows.length - 4}` : ''}</small></div>
              <div><dt>Annual tuition</dt><dd>{lakhRange(summary.feeMin, summary.feeMax)}</dd><small>{summary.tuitionYear} · tuition only</small></div>
              <div><dt>Established</dt><dd data-missing={!item.establishedYear || undefined}>{item.establishedYear || 'Not listed'}</dd><small>{labelOf(TYPE_LABELS, item.type)}</small></div>
              <div><dt>Streams</dt><dd>{item.streams.length || '—'}</dd><small>{item.streams.slice(0, 3).join(', ')}</small></div>
            </dl> : facts.length > 0 && <dl className={styles.facts}>{facts.slice(0, 4).map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd className={own.factValue}>{fact.value}</dd></div>)}</dl>}
            <div className={styles.heroActions}>
              <Link className="button button--primary" href={applyHref}><Icon name="document" />Apply now</Link>
              {item.website && <a className="button button--outline" href={item.website} target="_blank" rel="noopener noreferrer"><Icon name="external" />Official website<span className="sr-only"> (opens in a new tab)</span></a>}
              {hasRows && <a className="text-link" href="#courses"><Icon name="compare" />Compare a course<Icon name="arrow" /></a>}
            </div>
          </div>
          <figure className={styles.heroArt}>
            {item.art && item.isIllustrative ? <>
              <div className={styles.print}><CollegeArtwork row={item} className={styles.printArt} detail /></div>
              <figcaption><Icon name="spark" />Illustrative campus artwork, not a photograph</figcaption>
            </> : <div className={own.heroLogo}><UniversityLogo item={item} size="lg" /><p>{item.shortName || item.name}</p></div>}
          </figure>
        </div>
      </div>
    </section>

    <ProfileNav sections={sections} shortName={item.shortName || item.name} heroId="profile-hero" />

    <div className={`container ${styles.body}`} data-no-rail={!hasRows || undefined}>
      <div className={styles.main}>
        <section id="overview" className={styles.section} aria-labelledby="overview-title">
          <header className={styles.sectionHead}><h2 id="overview-title">Overview</h2>{item.source?.fetchedAt && !item.isIllustrative && <span className={styles.yearTag}>Updated {new Date(item.source.fetchedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</header>
          <div className={styles.overviewGrid}>
            <div className={styles.overviewCopy}>
              <p className={styles.lede}>{item.about || `${item.name} is a ${labelOf(TYPE_LABELS, item.type).toLowerCase()} in ${placeOf(item) || 'India'}.${item.streams.length ? ` It offers programmes in ${item.streams.slice(0, 4).join(', ').toLowerCase()}.` : ''}`}</p>
              {facts.length > 0 && <dl className={own.factList}>{facts.map((fact) => <Fact key={fact.label} label={fact.label}>{fact.value}</Fact>)}</dl>}
              {item.streams.length > 0 && <ul className={styles.courseChips} aria-label="Streams">{item.streams.map((stream) => <li key={stream}><Link href={`/universities?stream=${encodeURIComponent(stream)}${item.state ? `&state=${encodeURIComponent(item.state)}` : ''}`}><Icon name="book" />{stream}</Link></li>)}</ul>}
            </div>
            <aside className={styles.verify} aria-labelledby="verify-title">
              <h3 id="verify-title"><Icon name="shield" />Before you apply, verify</h3>
              <ul>
                <li><Icon name="check" />Official eligibility for your course</li>
                <li><Icon name="check" />Entrance exams the institution accepts</li>
                <li><Icon name="check" />Full fees, including hostel and exam fees</li>
                <li><Icon name="check" />Refund policy and scholarship rules</li>
                <li><Icon name="check" />Application deadlines on the official site</li>
              </ul>
              <Link className="text-link" href="/admission-checklist">Open the admission checklist<Icon name="arrow" /></Link>
            </aside>
          </div>
        </section>

        {sections.some((section) => section.id === 'courses') && <section id="courses" className={styles.section} aria-labelledby="courses-title">
          <header className={styles.sectionHead}><h2 id="courses-title">{hasRows ? 'Courses & fees' : 'Courses'}</h2><span className={styles.yearTag}>{hasRows ? plural(rows.length, 'programme') : plural(item.coursesOffered.length || courses.length, 'listing')}</span></header>
          {hasRows && <table className={styles.table}>
            <caption>Annual tuition for {summary.tuitionYear} and placement packages for {summary.placementYear}. Tuition excludes hostel and living costs.</caption>
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
                    <Link href={`${applyHref}&course=${row.courseId}`}>Apply<span className="sr-only"> for {nameOf(row.courseId)}</span></Link>
                    <Link href={`/colleges?course=${row.courseId}`}>Other colleges<span className="sr-only"> for {nameOf(row.courseId)}</span></Link>
                  </span>
                </div></td>
              </tr>;
            })}</tbody>
          </table>}
          {!hasRows && courses.length > 0 && <ul className={styles.courseChips} aria-label="Catalogue courses">{courses.map((course) => <li key={course.id}><Link href={`${applyHref}&course=${course.id}`}><Icon name="cap" />{course.name}<span>Apply</span></Link></li>)}</ul>}
          {item.coursesOffered.length > 0 && <div className={own.offered}>
            <h3>Programmes listed by the institution</h3>
            <ul>{item.coursesOffered.slice(0, 60).map((name) => <li key={name}>{name}</li>)}</ul>
            {item.coursesOffered.length > 60 && <p>+{item.coursesOffered.length - 60} more on the official website.</p>}
          </div>}
        </section>}

        {hasRows && <section id="placements" className={styles.section} aria-labelledby="placements-title">
          <header className={styles.sectionHead}><h2 id="placements-title">Placements</h2><span className={styles.yearTag}>{summary.placementYear}</span></header>
          <p className={styles.sectionIntro}>The <strong>median</strong> package is the middle value: half of placed students earned more and half less. The <strong>highest</strong> is a single offer and says little about a typical outcome.</p>
          <ul className={styles.legend} aria-label="Chart legend">
            <li><span className={styles.swatchMedian} />Median package</li>
            <li><span className={styles.swatchHighest} />Highest package</li>
            {rows.some((row) => benchmarks[row.courseId] && row.medianSalaryLpa != null) && <li><span className={styles.swatchMarker} />Median across listed colleges for the course</li>}
          </ul>
          <PlacementChart rows={rows} courseNames={courseNames} benchmarks={benchmarks} />
          <p className={styles.caption}>Placement year {summary.placementYear}{item.isIllustrative ? ' · illustrative values · not verified outcomes' : ''}. Exact figures are in the Courses &amp; fees table above.</p>
        </section>}

        <section id="admissions" className={styles.section} aria-labelledby="admissions-title">
          <header className={styles.sectionHead}><h2 id="admissions-title">Admissions &amp; contact</h2></header>
          <div className={styles.locationGrid} data-art={cityArt ? true : undefined}>
            {cityArt && <DestinationArt destination={cityArt} className={styles.locationArt} />}
            <div className={styles.locationCopy}>
              <dl className={own.contact}>
                <Fact label="Address">{[item.address, item.pincode].filter(Boolean).join(' – ') || placeOf(item)}</Fact>
                <Fact label="Website">{item.website && <a href={item.website} target="_blank" rel="noopener noreferrer">{hostOf(item.website)}<Icon name="external" /></a>}</Fact>
                <Fact label="Admissions">{item.admissionUrl && <a href={item.admissionUrl} target="_blank" rel="noopener noreferrer">Official admissions page<Icon name="external" /></a>}</Fact>
                <Fact label="Email">{item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}</Fact>
                <Fact label="Phone">{item.phone && <a href={`tel:${item.phone.replace(/[^\d+]/g, '')}`}>{item.phone}</a>}</Fact>
              </dl>
              <div className={styles.locationLinks}>
                <Link className="button button--primary" href={applyHref}><Icon name="document" />Apply through Gyaan Vidhya</Link>
                {item.state && <Link className="button button--ghost" href={`/universities?state=${encodeURIComponent(item.state)}`}><Icon name="map" />More in {item.state}</Link>}
              </div>
              <p className={own.sourceLine}><Icon name="collegesInfo" />{item.isIllustrative ? 'This is an illustrative profile used to demonstrate the platform.'
                : <>{sourceNote(item)}.{item.source?.url && <> Source: <a href={item.source.url} target="_blank" rel="noopener noreferrer nofollow">{hostOf(item.source.url)}</a>.</>} Spotted an error? <Link href="/report-correction">Report a correction</Link>.</>}</p>
            </div>
          </div>
        </section>

        <section id="similar" className={styles.section} aria-labelledby="similar-title">
          <header className={styles.sectionHead}><h2 id="similar-title">Similar institutions</h2><span className={styles.yearTag}>Same region and streams</span></header>
          {similar.length ? <ul className={own.list}>{similar.map((other) => <li key={other.id}><UniversityCard item={other} /></li>)}</ul>
            : <p className={styles.sectionIntro}>No similar institutions are listed yet. <Link href="/universities">Browse all universities</Link>.</p>}
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

      {hasRows ? <ProfileRail rows={rows} courseNames={courseNames} city={item.city} /> : <aside className={own.applyRail} aria-labelledby="apply-rail-title">
        <p className={own.railEyebrow}>Ready to apply?</p>
        <h2 id="apply-rail-title">Apply to {item.shortName || item.name}</h2>
        <p>Share your details once. Our admissions team checks eligibility and guides you through the institution&rsquo;s process.</p>
        <Link className="button button--primary" href={applyHref}>Start application<Icon name="arrow" /></Link>
        <Link className="text-link" href="/admission-checklist">What you&rsquo;ll need<Icon name="arrow" /></Link>
      </aside>}
    </div>
  </main>;
}
