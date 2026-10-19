import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ApplyPicker from '@/features/apply/ApplyPicker';
import QuickApplyForm from '@/features/apply/QuickApplyForm';
import UniversityMark from '@/features/apply/UniversityMark';
import { getUniversity } from '@/lib/api/catalog';
import { requireStudentSession } from '@/lib/api/session';
import styles from './apply.module.css';

// URL contract: /apply, /apply?university=<slug>, /apply?university=<slug>&course=<courseSlug>
// (+ optional utm_* parameters, read by the form from the address bar).
const first = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, 120).toLowerCase();
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OWNERSHIP = { public: 'Public', private: 'Private', 'public-private': 'Public–private' };

const steps = [
  { title: 'Send one short form', text: 'Your course, contact details and intake. It takes about a minute.' },
  { title: 'A counsellor calls you', text: 'Gyaan Vidhya’s admissions team checks your fit and answers questions.' },
  { title: 'Apply to the university', text: 'We guide you through the university’s own application. Nothing is sent without you.' },
];

async function loadUniversity(slug) {
  if (!slug) return { state: 'none' };
  if (!SLUG.test(slug)) return { state: 'missing' };
  try {
    const data = await getUniversity(slug);
    if (!data) return { state: 'missing' };
    const { item, courses } = data;
    return { state: 'ready', item, courses: courses.map((course) => ({ id: course.id, name: course.name })) };
  } catch (error) {
    unstable_rethrow(error);
    return { state: 'failed' };
  }
}

export async function generateMetadata({ searchParams }) {
  const { item } = await loadUniversity(first((await searchParams).university));
  return {
    title: item ? `Apply to ${item.name} | Gyaan Vidhya` : 'Quick apply | Gyaan Vidhya',
    description: 'One short form. Gyaan Vidhya’s admissions team contacts you and guides you through the university’s own application.',
    robots: { index: false, follow: false },
  };
}

function Steps() {
  return <ol className={styles.steps}>
    {steps.map((step, index) => <li key={step.title}><span aria-hidden="true">{index + 1}</span><div><strong>{step.title}</strong><small>{step.text}</small></div></li>)}
  </ol>;
}

export default async function ApplyPage({ searchParams }) {
  await requireStudentSession();
  const params = await searchParams;
  const slug = first(params.university);
  const course = first(params.course);
  const result = await loadUniversity(slug);

  if (result.state !== 'ready') {
    return <main id="main" tabIndex={-1} className={styles.pickPage}>
      <div className={styles.pickInner}>
        <p className="lux-eyebrow lux-eyebrow--rule">Quick apply</p>
        <h1 className={styles.pickTitle}>Where would you like <em>to study?</em></h1>
        <p className={styles.pickLead}>Choose a university and send one short form. Gyaan Vidhya’s admissions team takes it from there.</p>
        {result.state === 'missing' && <p className={styles.notice} role="alert"><Icon name="search" />We couldn’t find that university. Search for it below.</p>}
        {result.state === 'failed' && <p className={styles.notice} role="alert"><Icon name="refresh" />That university couldn’t be loaded just now. <Link href={`/apply?university=${encodeURIComponent(slug)}`}>Try again</Link> or search below.</p>}
        <div className={styles.pickCard}><ApplyPicker /></div>
        <Steps />
        <p className={styles.pickFoot}>Not sure yet? <Link href="/universities">Browse the university directory</Link></p>
      </div>
    </main>;
  }

  const { item, courses } = result;
  const university = { id: item.id, name: item.name, city: item.city, state: item.state || '', logoUrl: item.logoUrl };
  const place = [item.city, item.state].filter(Boolean).join(', ');
  const facts = [
    item.establishedYear && ['Established', item.establishedYear],
    OWNERSHIP[item.ownership] && ['Ownership', OWNERSHIP[item.ownership]],
    item.naacGrade && ['NAAC', item.naacGrade],
    courses.length > 0 && ['Courses with us', courses.length],
  ].filter(Boolean);

  return <main id="main" tabIndex={-1} className={styles.page}>
    <div className={styles.frame}>
      <aside className={styles.summary} aria-labelledby="apply-title">
        <Link className={styles.back} href={`/universities/${encodeURIComponent(item.id)}`}><Icon name="arrow" />University profile</Link>
        <div className={styles.ticket}>
          <UniversityMark university={university} size="lg" />
          <p className={styles.ticketEyebrow}>You’re applying to</p>
          <h1 id="apply-title" className={styles.name}>{item.name}</h1>
          {place && <p className={styles.place}><Icon name="location" />{place}</p>}
          {item.isIllustrative && <p className={styles.illustrative}>Illustrative profile · sample data</p>}
          {facts.length > 0 && <dl className={styles.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
        </div>
        <div className={styles.how}>
          <h2 className={styles.howTitle}>What happens next</h2>
          <Steps />
        </div>
      </aside>
      <section className={styles.panel} aria-labelledby="apply-form-title">
        <div className={styles.panelHead}>
          <h2 id="apply-form-title" className={styles.panelTitle}>Your details</h2>
          <p className={styles.panelLead}>One screen. Your verified email is already filled in.</p>
        </div>
        <QuickApplyForm key={item.id} university={university} courseSlug={SLUG.test(course) ? course : ''} courses={courses} variant="page" />
      </section>
    </div>
  </main>;
}
