'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/providers/StudentAuthProvider';

// Link into a login-gated route. Signed out, it opens the login popup and continues after
// verification; without JS (or while the session is unknown) the proxy's /login?next= redirect applies.
export default function GatedLink({ href, reason = 'directory', className, children }) {
  const router = useRouter();
  const { status, openLogin } = useStudentAuth();
  function onClick(event) {
    if (status !== 'signed-out' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    openLogin({ reason, onSuccess: () => router.push(href), returnTo: href });
  }
  return <Link href={href} className={className} prefetch={false} onClick={onClick}>{children}</Link>;
}
