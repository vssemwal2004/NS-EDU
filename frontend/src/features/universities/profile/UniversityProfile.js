import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ApplyButton from '@/features/apply/ApplyButton';
import UniversityCard, { SourceTag, UniversityLogo, applyTarget } from '../UniversityCard';
import { formatCount, formatInr, formatLpa, hostOf, kindOf, lakhRange, ownershipOf, shortDate, sourceNote } from '../labels';
import SectionTabs from './SectionTabs';
import styles from './Profile.module.css';

const external = { target: '_blank', rel: 'noopener noreferrer' };
const isCloudinary = (url) => { try { return new URL(url).hostname === 'res.cloudinary.com'; } catch { return false; } };

function Cover({ model }) {
  const { item, shortName, place } = model;
  const directoryLink = item.state ? `/universities?${new URLSearchParams(item.city ? { state: item.state, city: item.city } : { state: item.state })}` : '/universities';
  return <section id="profile-top" className={`lux-surface-dark ${styles.cover}`} data-image={item.coverUrl ? true : undefined} aria-labelledby="page-title">
    {item.coverUrl && (isCloudinary(item.coverUrl)
      ? <Image className={styles.coverImage} src={item.coverUrl} alt="" fill priority sizes="100vw" />
      : <img className={styles.coverImage} src={item.coverUrl} alt="" decoding="async" fetchPriority="high" referrerPolicy="no-referrer" />)}
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
        </div>
        <div className={styles.coverActions}>
          <ApplyButton university={applyTarget(item)} variant="light" size="lg" />
          {item.website && <a className="lux-button lux-button--outline lux-button--lg" href={item.website} {...external}><Icon name="uniGlobe" />Official website<span className="sr-only"> (opens in a new tab)</span></a>}
        </div>
      </div>
    </div>
  </section>;
}

function Ribbon({ ribbon }) {
  return <div className={`lux-container ${styles.ribbonWrap}`}>
    <dl className={styles.ribbon} aria-label="Key facts">
      {ribbon.map((fact) => <div key={fact.label}>
        <dt>{fact.label}</dt>
        <dd>{fact.href ? <a href={fact.href} {...external}>{fact.value}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a> : fact.value}</dd>
      </div>)}
    </dl>
  </div>;
}

function SectionHead({ id, eyebrow, title, aside }) {
  return <header className={styles.sectionHead}>
    <div><p className="lux-eyebrow">{eyebrow}</p><h2 id={`${id}-title`} className="lux-display-3">{title}</h2></div>
    {aside && <p className={styles.sectionAside}>{aside}</p>}
  </header>;
}

function Overview({ model }) {
  const { item, about, highlights } = model;
  return <section id="overview" className={styles.section} aria-labelledby="overview-title">
    <SectionHead id="overview" eyebrow="About" title="Overview" aside={item.source?.fetchedAt && !item.isIllustrative ? `Updated ${shortDate(item.source.fetchedAt)}` : ''} />
    <p className={styles.about}>{about}</p>
    {item.isIllustrative && <p className={styles.notice}><Icon name="uniInfo" />This is an illustrative profile used to demonstrate the platform. Its fees and packages are sample values, not verified figures.</p>}
    {highlights.length > 0 && <>
      <h3 className={styles.subhead}>Highlights</h3>
      <ul className={styles.highlights}>
        {highlights.map((row) => <li key={row.title}><span className={styles.highlightIcon}><Icon name={row.icon} /></span><div><strong>{row.title}</strong><p>{row.text}</p></div></li>)}
      </ul>
    </>}
    {item.streams.length > 0 && <>
      <h3 className={styles.subhead}>Streams</h3>
      <ul className={styles.streamLinks}>
        {item.streams.map((stream) => <li key={stream}><Link className="lux-chip" href={`/universities?${new URLSearchParams({ stream, ...(item.state ? { state: item.state } : {}) })}`}>{stream}</Link></li>)}
      </ul>
    </>}
  </section>;
}

function Courses({ model }) {
  const { item, rows, summary, moreCourses } = model;
  const offered = item.coursesOffered;
  const target = applyTarget(item);
  return <section id="courses" className={styles.section} aria-labelledby="courses-title">
    <SectionHead id="courses" eyebrow="Programmes" title={rows.length ? 'Courses & fees' : 'Courses'}
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
    {offered.length > 0 && <div className={styles.offered}>
      <h3 className={styles.subhead}>Programmes listed by the institution <small>{formatCount(offered.length)}</small></h3>
      <ul>{offered.slice(0, 24).map((name) => <li key={name}>{name}</li>)}</ul>
      {offered.length > 24 && <details>
        <summary>Show all {formatCount(offered.length)} programmes</summary>
        <ul>{offered.slice(24).map((name) => <li key={name}>{name}</li>)}</ul>
      </details>}
    </div>}
  </section>;
}

function Admissions({ model }) {
  const { item, shortName } = model;
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
        {official && <a className="lux-link" href={official} {...external}>{item.admissionUrl ? 'Official admissions page' : hostOf(official)}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>}
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
  const { accreditation, status } = model;
  return <section id="accreditation" className={styles.section} aria-labelledby="accreditation-title">
    <SectionHead id="accreditation" eyebrow="Quality & recognition" title="Accreditation & approvals" />
    {accreditation.length > 0 ? <ul className={styles.seals}>
      {accreditation.map((row) => <li key={row.key}><Icon name={row.icon} /><span>{row.label}</span><strong>{row.value}</strong></li>)}
    </ul> : <p className={styles.notice}><Icon name="uniInfo" /><span>No accreditation, ranking or approval details are listed for this institution yet. You can check its status on the official <a href="https://www.naac.gov.in/" {...external}>NAAC</a>, <a href="https://www.nirfindia.org/" {...external}>NIRF</a> and <a href="https://www.ugc.gov.in/" {...external}>UGC</a> websites.</span></p>}
    <dl className={styles.statusList}>
      {status.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
    </dl>
  </section>;
}

function Contact({ model }) {
  const { item, contacts, address, mapQuery, place } = model;
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
      <SourceTag item={item} />
      <p>{item.isIllustrative ? 'This profile is illustrative and is not about a real institution.'
        : <>{sourceNote(item)}{item.source?.url && <>. Source: <a href={item.source.url} target="_blank" rel="noopener noreferrer nofollow">{hostOf(item.source.url)}</a></>}{item.updatedAt && <>. Last updated {shortDate(item.updatedAt)}</>}.</>}</p>
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

function Rail({ model }) {
  const { item, summary, contacts, shortName } = model;
  return <aside className={styles.rail} aria-labelledby="rail-title">
    <div className={`lux-surface-dark ${styles.railCard}`}>
      <div className={styles.railHead}><UniversityLogo item={item} size="sm" /><p>{shortName}</p></div>
      <h2 id="rail-title" className={styles.railTitle}>Apply in one short form</h2>
      {summary?.feeMin != null && <p className={styles.railFee}><span>Annual tuition · {summary.tuitionYear}</span><strong>{lakhRange(summary.feeMin, summary.feeMax)}</strong></p>}
      <ApplyButton university={applyTarget(item)} variant="light" size="lg" block />
      <p className={styles.railNote}>Gyaan Vidhya’s admissions team then contacts you to help with the institution’s own application.</p>
    </div>
    {contacts.length > 0 && <div className={styles.railContacts}>
      <h3>Key contacts</h3>
      <ul>{contacts.map((row) => <li key={row.key}><a href={row.href} {...(row.external ? external : {})}><Icon name={row.icon} /><span><small>{row.label}</small>{row.value}</span>{row.external && <span className="sr-only"> (opens in a new tab)</span>}</a></li>)}</ul>
    </div>}
  </aside>;
}

export default function UniversityProfile({ model, courseNames }) {
  const { item, summary, shortName } = model;
  return <>
    <Cover model={model} />
    <Ribbon ribbon={model.ribbon} />
    <SectionTabs sections={model.sections} />
    <div className={`lux-container ${styles.body}`}>
      <div className={styles.main}>
        <Overview model={model} />
        {model.hasCourses && <Courses model={model} />}
        <Admissions model={model} />
        <Accreditation model={model} />
        <Contact model={model} />
        <Similar model={model} courseNames={courseNames} />
      </div>
      <Rail model={model} />
    </div>
    <div className={styles.bottomBar}>
      <p><strong>{shortName}</strong><span>{summary?.feeMin != null ? `${lakhRange(summary.feeMin, summary.feeMax)} a year` : kindOf(item)}</span></p>
      <ApplyButton university={applyTarget(item)} />
    </div>
  </>;
}
