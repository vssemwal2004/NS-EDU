import { redirect } from 'next/navigation';
import LoginRoute from '@/features/auth/LoginRoute';
import { safeNext } from '@/features/auth/gated-routes';
import HomePage from '@/features/home/HomePage';
import { getStudentSession } from '@/lib/api/session';

export const metadata = {
  title: 'Log in | Gyaan Vidhya',
  description: 'Log in to Gyaan Vidhya with a one-time code sent to your email.',
  robots: { index: false, follow: false },
};

// /login?next=<same-origin path>. Login is always the popup: this route shows the homepage with the
// popup open on top of it. Already signed in → straight to `next`.
export default async function LoginPage({ searchParams }) {
  const next = safeNext((await searchParams).next);
  if (await getStudentSession()) redirect(next);
  return <>
    <HomePage />
    <LoginRoute next={next} />
  </>;
}
