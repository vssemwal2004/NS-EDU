import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import CompareToggle from '@/features/compare/CompareToggle';
import UniversityCard, { SourceTag, UniversityLogo, applyTarget } from '../UniversityCard';
import { formatInr, formatLpa, hostOf, kindOf, lakhRange, ownershipOf, shortDate, sourceNote } from '../labels';
import Gallery from './Gallery';
import OfferedProgrammes from './OfferedProgrammes';
import { Photo } from './media';
import SectionTabs from './SectionTabs';
import styles from './Profile.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer' };

// Every scraped value carries where it came from; nothing on this page is presented as verified.
function Source({ href, children }) {
  if (!href) return <span className={styles.sourceLine}>{children}</span>;
  return <a className={styles.sourceLine} href={href} target="_blank" rel="noopener noreferrer nofollow">
    {children}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span>
  </a>;
}

function Cover({ model }) {
  const { item, shortName, place, heroImage, chips, chipsNote } = model;
  const directoryLink = item.state ? `/universities?${new URLSearchParams(item.city ? { state: item.state, city: item.city } : { state: item.state })}` : '/universities';
  return <section id="profile-top" className={`lux-surface-dark ${styles.cover}`} data-image={heroImage ? true : undefined} aria-labelledby="page-title">
    {heroImage && <div className={styles.coverMedia} aria-hidden="true"><Photo src={heroImage} sizes="100vw" priority /></div>}
    <div className={styles.coverPattern} aria-hidden="true" />
    <div className={`lux-container ${styles.coverInner}`}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/universities">Universities</Link></li>
          <li><span aria-current="page">{shortName}</span></li>
        </ol>
      </nav>
      <div className={styles.identity}>
        <div className={styles.medallion}><UniversityLogo item={item} size="lg" /></div>
        <div className={styles.identityText}>
          <p className="lux-eyebrow lux-eyebrow--rule">{kindOf(item)}{ownershipOf(item) ? ` · ${ownershipOf(item)}` : ''}</p>
          <h1 id="page-title" className={`lux-display-2 ${styles.title}`}>{item.name}</h1>
          <ul className={styles.coverMeta}>
            {place && <li><Link href={directoryLink}><Icon name="uniMapPin" />{place}</Link></li>}
            {item.establishedYear && <li><Icon name="uniCalendar" />Established {item.establishedYear}</li>}
            <li><SourceTag item={item} className={styles.coverSource} /></li>
          </ul>
          {chips.length > 0 && <>
            <ul className={styles.chips} aria-label="Accreditation and ranking, as reported by the source">
              {chips.map((chip) => <li key={chip.key}><Icon name={chip.icon} /><strong>{chip.label}</strong></li>)}
            </ul>
            <p className={styles.chipsNote}><a href="#accreditation">{chipsNote} — see details</a></p>
          </>}
        </div>
        <div className={styles.coverActions}>
          <ApplyButton university={applyTarget(item)} variant="light" size="lg" />
          <div className={styles.coverSecondary}>
            <CompareToggle slug={item.id} name={item.name} size="md" />
            {item.website && <a className={`lux-button lux-button--outline lux-button--lg ${styles.siteButton}`} href={item.website} {...external}><Icon name="uniGlobe" /><span className={styles.siteLabel}>Official website</span><span className="sr-only"> (opens in a new tab)</span></a>}
          </div>
        </div>
      </div>
    </div>
  </section>;
}

// The four figures a student weighs first — fees, placement, programmes, campus — each only when known.
function Glance({ glance }) {
  return <div className={`lux-container ${styles.ribbonWrap}`}>
    <dl className={styles.ribbon} aria-label="At a glance">
      {glance.map((tile) => <div key={tile.key}>
        <dt><span className={styles.glanceIcon} aria-hidden="true"><Icon name={tile.icon} /></span>{tile.label}</dt>
        <dd>{tile.value}{tile.note && <small>{tile.note}</small>}</dd>
      </div>)}
    </dl>
  </div>;
}

function Awards({ model }) {
  const { item, awards } = model;
  return <section id="awards" className={styles.section} aria-labelledby="awards-title">
    <SectionHead id="awards" eyebrow="Recognition" title="Awards & recognitions" aside={`${awards.length} listed by the institution`} />
    <ol className={styles.timeline}>
      {awards.map((award) => <li key={award.title}>
        <span className={styles.timelineYear}>{award.year ?? '—'}</span>
        <p>{award.title}</p>
      </li>)}
    </ol>
    <p className={styles.sourceRow}><Source href={item.website}>As stated by {item.name} on its own website</Source></p>
  </section>;
}

function SectionHead({ id, eyebrow, title, aside }) {
  return <header className={styles.sectionHead}>
    <div><p className="lux-eyebrow">{eyebrow}</p><h2 id={`${id}-title`} className="lux-display-3">{title}</h2></div>
    {aside && <p className={styles.sectionAside}>{aside}</p>}
  </header>;
}

function Overview({ model }) {
  const { item, shortName, about, aboutSource, highlights, gaps } = model;
  return <section id="overview" className={styles.section} aria-labelledby="overview-title">
    <SectionHead id="overview" eyebrow="About" title={`${shortName} overview`} aside={item.source?.fetchedAt && !item.isIllustrative ? `Updated ${shortDate(item.source.fetchedAt)}` : ''} />
    {about.split(/\n{2,}/).map((paragraph, index) => <p key={index} className={index ? styles.aboutMore : styles.about}>{paragraph}</p>)}
    {aboutSource ? <p className={styles.sourceRow}><Source href={aboutSource}>From the institution’s website</Source></p>
      : <p className={styles.footnote}>Written from the directory record: name, type, location and year of establishment.</p>}
    {item.isIllustrative && <p className={styles.notice}><Icon name="uniInfo" />This is an illustrative profile used to demonstrate the platform. Its fees and packages are sample values, not verified figures.</p>}
    {highlights.length > 0 && <>
      <h3 className={styles.subhead}>Highlights</h3>
      <ul className={styles.highlights}>
        {highlights.map((row) => <li key={row.key}><span className={styles.highlightIcon}><Icon name={row.icon} /></span><div><strong>{row.title}</strong><p>{row.text}</p></div></li>)}
      </ul>
    </>}
    {item.streams.length > 0 && <>
      <h3 className={styles.subhead}>Streams</h3>
      <ul className={styles.streamLinks}>
        {item.streams.map((stream) => <li key={stream}><Link className="lux-chip" href={`/universities?${new URLSearchParams({ stream, ...(item.state ? { state: item.state } : {}) })}`}>{stream}</Link></li>)}
      </ul>
    </>}
    {gaps.length > 0 && <p className={styles.notice}><Icon name="uniInfo" />
      <span>We do not have {gaps.length === 1 ? gaps[0] : `${gaps.slice(0, -1).join(', ')} or ${gaps.at(-1)}`} for this institution yet. Check its {item.website ? <a href={item.website} {...external}>official website</a> : 'official website'}, or <Link href="/report-correction">send us what you know</Link>.</span>
    </p>}
  </section>;
}

function Photos({ model }) {
  const { item, photos, shortName } = model;
  return <section id="photos" className={styles.section} aria-labelledby="photos-title">
    <SectionHead id="photos" eyebrow="Campus" title="Photos" aside={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} from the institution’s own website`} />
    <Gallery photos={photos} name={shortName} />
    <p className={styles.footnote}>Photos are published by {item.name} on its website and are shown here with their source page. They are not Gyaan Vidhya’s own photography.</p>
  </section>;
}

function Courses({ model }) {
  const { item, rows, summary, moreCourses, offeredRows, offeredWithFees, offeredSource } = model;
  const target = applyTarget(item);
  return <section id="courses" className={styles.section} aria-labelledby="courses-title">
    <SectionHead id="courses" eyebrow="Academics" title={rows.length || offeredWithFees ? 'Courses & fees' : 'Courses'}
      aside={rows.length ? `${rows.length === 1 ? '1 programme' : `${rows.length} programmes`} with published fees` : ''} />
    {rows.length > 0 && <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>Annual tuition for {summary.tuitionYear}{summary.placementYear ? ` and placement packages for ${summary.placementYear}` : ''}. Tuition excludes hostel and living costs{item.isIllustrative ? '. Illustrative values' : ''}.</caption>
        <thead><tr>
          <th scope="col">Course</th>
          <th scope="col">Annual tuition</th>
          <th scope="col">Median package</th>
          <th scope="col">Highest package</th>
          <th scope="col"><span className="sr-only">Apply</span></th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          <th scope="row"><strong>{row.course.name}</strong>{row.course.fullName && <small>{row.course.fullName}</small>}</th>
          <td data-label={`Annual tuition · ${row.tuitionYear}`}><span className={styles.money}>{formatInr(row.annualTuitionInr)}</span></td>
          <td data-label={`Median · ${row.placementYear}`} data-missing={row.medianSalaryLpa == null || undefined}>{formatLpa(row.medianSalaryLpa) || 'Not published'}</td>
          <td data-label={`Highest · ${row.placementYear}`} data-missing={row.highestSalaryLpa == null || undefined}>{formatLpa(row.highestSalaryLpa) || 'Not published'}</td>
          <td className={styles.rowAction}>
            <ApplyButton university={target} courseSlug={row.courseId} variant="outline" className="lux-button--sm">Apply<span className="sr-only"> for {row.course.name} at {item.name}</span></ApplyButton>
          </td>
        </tr>)}</tbody>
      </table>
    </div>}
    {moreCourses.length > 0 && <>
      <h3 className={styles.subhead}>{rows.length ? 'Also offered' : 'Courses offered'}</h3>
      <ul className={styles.courseTiles}>
        {moreCourses.map((course) => <li key={course.id}>
          <div><strong>{course.name}</strong>{course.fullName && <small>{course.fullName}</small>}</div>
          <ApplyButton university={target} courseSlug={course.id} variant="outline" className="lux-button--sm">Apply<span className="sr-only"> for {course.name} at {item.name}</span></ApplyButton>
        </li>)}
      </ul>
    </>}
    {offeredRows.length > 0 && <>
      <h3 className={styles.subhead}>Programmes listed by the institution
        <small>{offeredWithFees ? `${offeredWithFees} with a published fee` : 'fees not published'}</small>
      </h3>
      <OfferedProgrammes rows={offeredRows} withFees={offeredWithFees > 0} />
      {(offeredSource || item.website) && <p className={styles.sourceRow}><Source href={offeredSource || item.website}>From the institution’s website</Source></p>}
    </>}
  </section>;
}

function Placements({ model }) {
  const { item, placementStats, recruiters, placementYear, placementNote, placementSource, summary, placementHistory, historyColumns } = model;
  return <section id="placements" className={styles.section} aria-labelledby="placements-title">
    <SectionHead id="placements" eyebrow="Outcomes" title="Placements" aside={placementYear ? `Reported for ${placementYear}` : ''} />
    {placementStats.length > 0 ? <ul className={styles.stats}>
      {placementStats.map((stat) => <li key={stat.key}><span>{stat.label}</span><strong>{stat.value}</strong></li>)}
    </ul> : !historyColumns.length && <p className={styles.notice}><Icon name="uniInfo" />The institution does not publish overall placement figures{placementYear ? ` for ${placementYear}` : ''}. Only the course-level packages below are known.</p>}
    {historyColumns.length > 0 && <>
      <h3 className={styles.subhead}>Season by season <small>{placementHistory.length} {placementHistory.length === 1 ? 'season' : 'seasons'} reported</small></h3>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.history}`}>
          <caption>Placement record as the institution reports it, newest season first. A dash means that season’s figure was not published.</caption>
          <thead><tr><th scope="col">Season</th>{historyColumns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}</tr></thead>
          <tbody>{placementHistory.map((row) => <tr key={row.year}>
            <th scope="row"><strong>{row.session}{row.counted && ' *'}</strong>{row.sourcePage && <small><a href={row.sourcePage} {...external}>Source</a></small>}</th>
            {historyColumns.map(([key, label, format]) => <td key={key} data-label={label} data-missing={row[key] == null || undefined}>{row[key] == null ? '—' : format(row[key])}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {placementHistory.some((row) => row.counted) && <p className={styles.footnote}>* Counted from the institution’s published list of placed students (students, distinct employers and the highest package printed). The list may not name every student placed.</p>}
    </>}
    {placementNote && <p className={styles.footnote}>{placementNote}</p>}
    {summary?.medianMax != null && <p className={styles.footnote}>Course-level packages for {summary.placementYear} are in the courses table above{item.isIllustrative ? ' (illustrative values)' : ''}.</p>}
    {recruiters.length > 0 && <>
      <h3 className={styles.subhead}>Recruiters listed <small>{recruiters.length}</small></h3>
      <ul className={styles.tagList}>{recruiters.map((name) => <li key={name} className="lux-chip lux-chip--static">{name}</li>)}</ul>
    </>}
    <p className={styles.sourceRow}><Source href={placementSource || item.website}>
      {placementSource || item.website ? 'Reported by the institution — open the source page' : 'Reported by the institution'}
    </Source></p>
    <p className={styles.footnote}>Packages are what the institution reports; Gyaan Vidhya has not audited them. Ask for the detailed placement report before you decide.</p>
  </section>;
}

function Campus({ model }) {
  const { item, campusFacts, facilities, activities, campusSource } = model;
  return <section id="campus" className={styles.section} aria-labelledby="campus-title">
    <SectionHead id="campus" eyebrow="Student life" title="Campus & activities" />
    {campusFacts.length > 0 && <dl className={styles.statusList}>
      {campusFacts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
    </dl>}
    {facilities.length > 0 && <>
      <h3 className={styles.subhead}>Facilities <small>{facilities.length}</small></h3>
      <ul className={styles.tagList}>{facilities.map((name) => <li key={name} className="lux-chip lux-chip--static"><Icon name="uniCampus" />{name}</li>)}</ul>
    </>}
    {activities.length > 0 && <>
      <h3 className={styles.subhead}>Clubs & activities <small>{activities.length}</small></h3>
      <ul className={styles.tagList}>{activities.map((name) => <li key={name} className="lux-chip lux-chip--static"><Icon name="uniSpark" />{name}</li>)}</ul>
    </>}
    {(campusSource || item.website) && <p className={styles.sourceRow}><Source href={campusSource || item.website}>From the institution’s website</Source></p>}
  </section>;
}

function Admissions({ model }) {
  const { item, shortName, entranceExams, admissionNote } = model;
  const official = item.admissionUrl || item.website;
  return <section id="admissions" className={styles.section} aria-labelledby="admissions-title">
    <SectionHead id="admissions" eyebrow="How to apply" title="Admissions" />
    <ol className={styles.steps}>
      <li><span aria-hidden="true">01</span><div><strong>Send a quick application</strong><p>One short form: your name, mobile number, course and intake year.</p></div></li>
      <li><span aria-hidden="true">02</span><div><strong>Talk to our admissions team</strong><p>Gyaan Vidhya’s team contacts you by phone or email to understand your choices.</p></div></li>
      <li><span aria-hidden="true">03</span><div><strong>Complete {shortName}’s own process</strong><p>The team helps with the institution’s application. Track every update in My applications.</p></div></li>
    </ol>
    <div className={styles.admissionsGrid}>
      <div className={`lux-surface-dark ${styles.applyPanel}`}>
        <p className="lux-eyebrow">Gyaan Vidhya quick apply</p>
        <h3 className="lux-title">Apply to {shortName}</h3>
        <p>Your details go to Gyaan Vidhya’s admissions team, who help you with the institution’s own application.</p>
        <ApplyButton university={applyTarget(item)} variant="light" size="lg" />
      </div>
      <div className={styles.officialPanel}>
        <h3 className="lux-title">Official admissions</h3>
        {official ? <p>Deadlines, eligibility and entrance requirements are set by the institution. Check them on its {item.admissionUrl ? 'admissions page' : 'website'}.</p>
          : <p>The institution’s admissions page is not listed yet. Our team can confirm deadlines and eligibility when you apply.</p>}
        {admissionNote && <p className={styles.quote}>{admissionNote}</p>}
        {official && <a className="lux-link" href={official} {...external}>{item.admissionUrl ? 'Official admissions page' : hostOf(official)}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
        {entranceExams.length > 0 && <>
          <h4>Entrance exams listed</h4>
          <ul className={styles.tagList}>{entranceExams.map((exam) => <li key={exam} className="lux-chip lux-chip--static">{exam}</li>)}</ul>
        </>}
        <h4>Before you apply, verify</h4>
        <ul className={styles.checklist}>
          <li><Icon name="check" />Eligibility for your course</li>
          <li><Icon name="check" />Entrance exams the institution accepts</li>
          <li><Icon name="check" />Full fees, including hostel and exam fees</li>
          <li><Icon name="check" />Refund and scholarship rules</li>
        </ul>
        <Link className="lux-link" href="/admission-checklist">Open the admission checklist<Icon name="arrow" /></Link>
      </div>
    </div>
  </section>;
}

function Accreditation({ model }) {
  const { accreditation, status, snapshotOn, directorySources, item } = model;
  return <section id="accreditation" className={styles.section} aria-labelledby="accreditation-title">
    <SectionHead id="accreditation" eyebrow="Quality & recognition" title="Accreditation & approvals"
      aside={snapshotOn ? `Source snapshot · ${snapshotOn}` : ''} />
    <p className={styles.notice}><Icon name="uniInfo" /><span><strong>Read these as source-reported, not verified.</strong> They are the values our directory source recorded{snapshotOn ? ` on ${snapshotOn}` : ''}, not a current certificate and not a Gyaan Vidhya rating. Confirm the live status on the regulator’s own website before you apply.</span></p>
    {accreditation.length > 0 ? <ul className={styles.seals}>
      {accreditation.map((row) => <li key={row.key}>
        <Icon name={row.icon} />
        <span>{row.label}</span>
        <strong>{row.value}</strong>
        {row.facts?.length > 0 && <dl>{row.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl>}
        {row.note && <p className={styles.quote}>{row.note}</p>}
        {row.href && <a className={styles.sourceLine} href={row.href} {...external}>Check on {hostOf(row.href)}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
      </li>)}
    </ul> : <p className={styles.notice}><Icon name="uniInfo" /><span>No accreditation, ranking or approval details are recorded for this institution. You can check its status on the official <a href="https://www.naac.gov.in/" {...external}>NAAC</a>, <a href="https://www.nirfindia.org/" {...external}>NIRF</a> and <a href="https://www.ugc.gov.in/" {...external}>UGC</a> websites.</span></p>}
    <h3 className={styles.subhead}>Directory record</h3>
    <dl className={styles.statusList}>
      {status.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
    <div className={styles.attribution}>
      <SourceTag item={item} />
      <p>{sourceNote(item)}{snapshotOn ? `. Snapshot compiled ${snapshotOn}` : ''}.
        {directorySources.length > 0 && <> Sources: {directorySources.map((source, index) => <span key={source.label}>{index > 0 && ', '}{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer nofollow">{source.label}</a> : source.label}</span>)}.</>}
      </p>
      <Link className="lux-link" href="/report-correction"><Icon name="uniFlag" />Report a correction</Link>
    </div>
  </section>;
}

function Contact({ model }) {
  const { item, contacts, address, mapQuery, place, sourceUrl } = model;
  return <section id="contact" className={styles.section} aria-labelledby="contact-title">
    <SectionHead id="contact" eyebrow="Get in touch" title="Contact & location" />
    <div className={styles.contactGrid}>
      <div className={styles.placeCard}>
        <div className={styles.placeArt} aria-hidden="true"><span><Icon name="uniMapPin" /></span></div>
        <div className={styles.placeBody}>
          <h3 className="lux-title">{place || 'Location not listed'}</h3>
          {address && address !== place && <p>{address}</p>}
          <div className={styles.placeLinks}>
            {mapQuery && place && <a className="lux-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} {...external}>Open in Google Maps<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
            {item.state && <Link className="lux-link" href={`/universities?${new URLSearchParams({ state: item.state })}`}>More in {item.state}<Icon name="arrow" /></Link>}
          </div>
        </div>
      </div>
      {contacts.length > 0 ? <ul className={styles.contactList}>
        {contacts.map((row) => <li key={row.key}>
          <span className={styles.contactIcon}><Icon name={row.icon} /></span>
          <div><span>{row.label}</span><a href={row.href} {...(row.external ? external : {})}>{row.value}{row.external && <span className="sr-only"> (opens in a new tab)</span>}</a></div>
        </li>)}
      </ul> : <p className={styles.notice}><Icon name="uniInfo" />Contact details for this institution are not listed yet. Apply through Gyaan Vidhya and our team will connect you.</p>}
    </div>
    <div className={styles.attribution}>
      <p>{item.isIllustrative ? 'This profile is illustrative and is not about a real institution.'
        : <>{sourceNote(item)}{sourceUrl && <>. Source: <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{hostOf(sourceUrl)}</a></>}{item.updatedAt && <>. Last updated {shortDate(item.updatedAt)}</>}.</>}</p>
      <Link className="lux-link" href="/report-correction"><Icon name="uniFlag" />Report a correction</Link>
    </div>
  </section>;
}

function Similar({ model, courseNames }) {
  const { item, similar } = model;
  return <section id="similar" className={styles.section} aria-labelledby="similar-title">
    <SectionHead id="similar" eyebrow="Keep exploring" title="Similar universities" aside="Same region and streams" />
    {similar.length ? <ul className={styles.similar}>{similar.map((other) => <li key={other.id}><UniversityCard item={other} courseNames={courseNames} /></li>)}</ul>
      : <p className={styles.notice}><Icon name="uniInfo" /><span>No similar institutions are listed yet. <Link href={item.state ? `/universities?${new URLSearchParams({ state: item.state })}` : '/universities'}>Browse the directory</Link>.</span></p>}
  </section>;
}

// Contacts live in the Contact section only; the rail keeps to the decision: fee and Apply.
function Rail({ model }) {
  const { item, summary, shortName } = model;
  return <aside className={styles.rail} aria-labelledby="rail-title">
    <div className={`lux-surface-dark ${styles.railCard}`}>
      <div className={styles.railHead}><UniversityLogo item={item} size="sm" /><p>{shortName}</p></div>
      <h2 id="rail-title" className={styles.railTitle}>Apply in one short form</h2>
      {summary?.feeMin != null && <p className={styles.railFee}><span>Annual tuition · {summary.tuitionYear}</span><strong>{lakhRange(summary.feeMin, summary.feeMax)}</strong></p>}
      <ApplyButton university={applyTarget(item)} variant="light" size="lg" block />
      {item.website && <a className={`lux-button lux-button--outline lux-button--block ${styles.railSite}`} href={item.website} {...external}><Icon name="uniGlobe" />Official website<span className="sr-only"> (opens in a new tab)</span></a>}
      <p className={styles.railNote}>Gyaan Vidhya’s admissions team then contacts you to help with the institution’s own application.</p>
    </div>
    <div className={styles.railCompare}><CompareToggle slug={item.id} name={item.name} size="md" /></div>
  </aside>;
}

export default function UniversityProfile({ model, courseNames }) {
  const { item, summary, shortName } = model;
  return <>
    <Cover model={model} />
    <Glance glance={model.glance} />
    <SectionTabs sections={model.sections} />
    <div className={`lux-container ${styles.body}`}>
      <div className={styles.main}>
        <Overview model={model} />
        {model.photos.length > 0 && <Photos model={model} />}
        {model.hasCourses && <Courses model={model} />}
        {model.hasPlacements && <Placements model={model} />}
        {model.hasCampus && <Campus model={model} />}
        {model.awards.length > 0 && <Awards model={model} />}
        <Admissions model={model} />
        <Accreditation model={model} />
        <Contact model={model} />
        {model.similar.length > 0 && <Similar model={model} courseNames={courseNames} />}
      </div>
      <Rail model={model} />
    </div>
    <div className={styles.bottomBar}>
      <p><strong>{shortName}</strong><span>{summary?.feeMin != null ? `${lakhRange(summary.feeMin, summary.feeMax)} a year` : kindOf(item)}</span></p>
      <div className={styles.bottomActions}>
        {item.website && <a className="lux-button lux-button--outline lux-button--icon" href={item.website} {...external} aria-label={`Official website of ${item.name} (opens in a new tab)`}><Icon name="uniGlobe" /></a>}
        <ApplyButton university={applyTarget(item)} />
      </div>
    </div>
  </>;
}
