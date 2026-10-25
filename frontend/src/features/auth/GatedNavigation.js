'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import { isGatedPath, loginReasonFor, safeNext } from './gated-routes';

// Login is always the popup, over the page the student is on. A signed-out click on any link into a
// gated route (or on a /login?next= link) opens it in place and continues to the destination after
// verification, instead of navigating away to a separate login page.
// One capture-phase listener covers every link on the site — header, cards, chips, CMS content —
// and runs before next/link's own handler. Without JS, or while the session is still unknown, the
// link navigates as normal and the proxy's /login?next= redirect applies (see app/(site)/login).
export default function GatedNavigation() {
  const router = useRouter();
  const { status, openLogin } = useStudentAuth();

  useEffect(() => {
    if (status !== 'signed-out') return undefined;
    function onClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof window.Element ? event.target.closest('a[href]') : null;
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const next = url.pathname === '/login' ? safeNext(url.searchParams.get('next'))
        : isGatedPath(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : null;
      if (!next) return;
      event.preventDefault();
      openLogin({ reason: loginReasonFor(next), onSuccess: () => router.push(next) });
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [status, openLogin, router]);

  return null;
}
