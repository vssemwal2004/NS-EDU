import Link from 'next/link';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import RegistrationForm, { ClosedNotice } from './RegistrationForm';
import styles from './Registration.module.css';

// Lean page for QR scans: brand, school header and the form. No site header, footer or catalogue.
function Shell({ school, children }) {
  return <div className={styles.page}>
    <header className={styles.top}>
      <Link href="/" className={styles.brand} aria-label="Gyaan Vidhya home"><Brand priority /></Link>
    </header>
    <main id="main" className={styles.main}>
      <div className={styles.card}>
        {school && <div className={styles.school}>
          <p className={styles.eyebrow}><Icon name="cap" />Student registration</p>
          <h1 className={styles.schoolName}>{school.name}</h1>
          <p className={styles.place}><Icon name="location" />{[school.city !== school.district && school.city, school.district, school.state].filter(Boolean).join(', ')}</p>
        </div>}
        {children}
      </div>
      <p className={styles.footnote}>Gyaan Vidhya helps students find the right university and course in India.</p>
    </main>
  </div>;
}

export default function RegistrationPage({ code, result }) {
  if (result.status === 'open') {
    return <Shell school={result.form.school}>
      <p className={styles.intro}>{result.form.title}. It takes about a minute.</p>
      <RegistrationForm code={code} form={result.form} token={result.token} />
    </Shell>;
  }
  if (result.status === 'closed') return <Shell school={result.school}><ClosedNotice school={result.school} /></Shell>;
  if (result.status === 'missing') {
    return <Shell><div className={styles.state} role="status">
      <span className={styles.stateIcon}><Icon name="search" /></span>
      <h1 className={styles.stateTitle}>Form not found</h1>
      <p>Check the link or scan the QR code again. If it still does not open, ask the Gyaan Vidhya team at your school.</p>
    </div></Shell>;
  }
  return <Shell><div className={styles.state} role="alert">
    <span className={styles.stateIcon}><Icon name="refresh" /></span>
    <h1 className={styles.stateTitle}>We could not open the form</h1>
    <p>Gyaan Vidhya is not reachable right now. Check your internet connection and try again in a moment.</p>
    <a className="lux-button lux-button--primary" href={`/r/${code}`}>Try again</a>
  </div></Shell>;
}
