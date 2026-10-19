import { redirect } from 'next/navigation';
import LoginBrand from '@/features/auth/LoginBrand';
import LoginScreen from '@/features/auth/LoginScreen';
import { safeNext } from '@/features/auth/gated-routes';
import { getStudentSession } from '@/lib/api/session';
import styles from './login.module.css';

export const metadata = {
  title: 'Log in | Gyaan Vidhya',
  description: 'Log in to Gyaan Vidhya with a one-time code sent to your email.',
  robots: { index: false, follow: false },
};

// /login?next=<same-origin path>. Already signed in → straight to `next`.
export default async function LoginPage({ searchParams }) {
  const next = safeNext((await searchParams).next);
  if (await getStudentSession()) redirect(next);
  return <main id="main" tabIndex={-1} className={styles.page}>
    <div className={styles.frame}>
      <LoginBrand variant="page" />
      <section className={styles.panel} aria-label="Log in">
        <div className={styles.formWrap}><LoginScreen next={next} /></div>
      </section>
    </div>
  </main>;
}
