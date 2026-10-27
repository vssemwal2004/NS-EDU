'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import QuickApplyDialog from '@/features/apply/QuickApplyDialog';
import { currentReturnTo } from '@/features/auth/google-login';
import { api } from '@/lib/api/client';
import { useStudentAuth } from '@/providers/StudentAuthProvider';

const QuickApplyContext = createContext(null);

const applyHref = ({ university, courseSlug }) => `/apply?university=${encodeURIComponent(university.id)}${courseSlug ? `&course=${encodeURIComponent(courseSlug)}` : ''}`;

// Google sign-in leaves the page, so the popup's onSuccess cannot survive it. It comes back to this
// page with ?apply=<university>[&applyCourse=<course>] instead, and the dialog reopens from that.
function returnHref(request) {
  const url = new URL(currentReturnTo(), window.location.origin);
  if (/^\/login(\/|$)/.test(url.pathname)) return applyHref(request);
  url.searchParams.set('apply', request.university.id);
  if (request.courseSlug) url.searchParams.set('applyCourse', request.courseSlug); else url.searchParams.delete('applyCourse');
  return `${url.pathname}${url.search}`;
}

const clean = (university) => ({
  id: String(university.id), name: String(university.name),
  city: university.city || '', state: university.state || '', logoUrl: university.logoUrl || '',
});

/**
 * Quick apply from anywhere on the public site. Must sit inside StudentAuthProvider.
 * open({ university: { id: slug, name, city?, state?, logoUrl? }, courseSlug? }): signed out → the login
 * popup first, then the quick-apply popup continues straight after verification.
 */
export function QuickApplyProvider({ children }) {
  const { status, loginOpen, openLogin } = useStudentAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [current, setCurrent] = useState(null);
  const count = useRef(0);

  const show = useCallback((request) => { count.current += 1; setCurrent({ ...request, key: count.current }); }, []);

  // Reopen after a Google round trip. Runs again on client navigation (pathname), e.g. /login →
  // the page, and waits while the login popup (or its one-time name prompt) is still up.
  useEffect(() => {
    if (status !== 'signed-in' || loginOpen) return;
    const url = new URL(window.location.href);
    const slug = url.searchParams.get('apply');
    if (!slug) return;
    const courseSlug = url.searchParams.get('applyCourse') || '';
    url.searchParams.delete('apply');
    url.searchParams.delete('applyCourse');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    // Not aborted on re-render: the flag is already gone from the address, so this is the only try.
    api(`/universities/${encodeURIComponent(slug)}`)
      .then(({ item }) => show({ university: clean(item), courseSlug }))
      .catch(() => router.push(applyHref({ university: { id: slug }, courseSlug })));
  }, [status, loginOpen, pathname, show, router]);

  const open = useCallback((options) => {
    const university = options?.university;
    if (!university?.id || !university?.name) return;
    const request = { university: clean(university), courseSlug: typeof options.courseSlug === 'string' ? options.courseSlug : '' };
    // While the session is still loading the form itself checks it and offers login on a 401.
    if (status === 'signed-out') openLogin({ reason: 'apply', onSuccess: () => show(request), returnTo: returnHref(request) });
    else show(request);
  }, [status, openLogin, show]);
  const close = useCallback(() => setCurrent(null), []);

  const value = useMemo(() => ({ open, close, isOpen: Boolean(current) }), [open, close, current]);
  return <QuickApplyContext.Provider value={value}>
    {children}
    {current && <QuickApplyDialog key={current.key} university={current.university} courseSlug={current.courseSlug} onClosed={close} />}
  </QuickApplyContext.Provider>;
}

export function useQuickApply() {
  const value = useContext(QuickApplyContext);
  if (!value) throw new Error('useQuickApply must be used inside QuickApplyProvider');
  return value;
}
