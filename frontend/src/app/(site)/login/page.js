import { redirect } from 'next/navigation';
import LoginRoute from '@/features/auth/LoginRoute';
import { safeNext } from '@/features/auth/gated-routes';
import HomePage from '@/features/home/HomePage';
import { getStudentSession } from '@/lib/api/session';

export const metadata = {
  title: 'Log in | Gyaan Vidhya',
  description: 'Log in to Gyaan Vidhya with Google or a one-time code sent to your email or mobile.',
  robots: { index: false, follow: false },
};

// /login?next=<same-origin path>[&error=<google error code>]. Login is always the popup: this route
// shows the homepage with the popup open on top of it. Already signed in → straight to `next`.
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getStudentSession()) redirect(next);
  const error = typeof params.error === 'string' ? params.error.slice(0, 40) : '';
  return <>
    <HomePage />
    <LoginRoute next={next} error={error} />
  </>;
}
