'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import { loginReasonFor } from './gated-routes';
import { googleErrorMessage } from './google-login';

// /login renders the homepage and this opens the login popup over it — the same popup used
// everywhere else — so login never looks like a separate page. After verification the student goes
// on to `next` (validated on the server); closing the popup leaves them on the homepage underneath.
// A failed Google attempt lands here as /login?error=<code>&next=…, shown above the form.
export default function LoginRoute({ next, error = '' }) {
  const router = useRouter();
  const { status, loginOpen, openLogin } = useStudentAuth();
  const opened = useRef(false);
  const shown = useRef(false);

  useEffect(() => {
    if (opened.current || status === 'loading') return;
    if (status === 'signed-in') { router.replace(next); return; }
    opened.current = true;
    openLogin({ reason: loginReasonFor(next), onSuccess: () => router.replace(next), returnTo: next, notice: googleErrorMessage(error) });
  }, [status, next, error, openLogin, router]);

  // Closed without logging in: drop /login from the address so a refresh shows the plain homepage.
  // Only once the popup has actually been open — the request to open it lands a render later.
  useEffect(() => {
    if (loginOpen) { shown.current = true; return; }
    if (shown.current && status !== 'signed-in') router.replace('/');
  }, [loginOpen, status, router]);

  return null;
}
