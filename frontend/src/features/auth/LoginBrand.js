import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { COMPARE_MAX } from './login-helpers';
import styles from './LoginBrand.module.css';

// Only claims that are true today. Shared by /login (variant "page") and the login popup ("dialog").
const points = [
  { icon: 'lock', title: 'No password, no sign-up form', text: 'A 6-digit code to your email. Your first code creates the account.' },
  { icon: 'building', title: 'The full university directory', text: 'Search and filter universities, their courses and curated fee rows.' },
  { icon: 'scales', title: 'Compare side by side', text: `Line up to ${COMPARE_MAX} colleges for the same course.` },
  { icon: 'eligibility', title: 'Quick apply, one screen', text: 'Our admissions team follows up, and you track each application.' },
];

export default function LoginBrand({ variant = 'page', minutes = 5, headingLevel: Heading = 'p' }) {
  return <aside className={styles.brand} data-variant={variant} aria-label="Why log in">
    <svg className={styles.ornament} viewBox="0 0 400 400" fill="none" aria-hidden="true">
      <path d="M60 400V210a140 140 0 0 1 280 0v190" /><path d="M100 400V214a100 100 0 0 1 200 0v186" /><circle cx="200" cy="214" r="6" />
    </svg>
    <Brand tone="light" className={styles.logo} />
    <div className={styles.copy}>
      <p className={styles.eyebrow}><span aria-hidden="true" />Student access</p>
      <Heading className={styles.title}>Find, compare and apply, <em>with one code.</em></Heading>
    </div>
    <ul className={styles.points}>
      {points.map((point) => <li key={point.title}>
        <span className={styles.pointIcon}><Icon name={point.icon} /></span>
        <span><strong>{point.title}</strong><small>{point.text}</small></span>
      </li>)}
    </ul>
    <p className={styles.foot}><Icon name="shield" />Codes expire in {minutes} minutes and work once.</p>
  </aside>;
}
