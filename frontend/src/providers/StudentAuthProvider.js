'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isGatedPath } from '@/features/auth/gated-routes';
import { api, ApiError, SESSION_EXPIRED_EVENT } from '@/lib/api/client';

const StudentAuthContext = createContext(null);

// Resolves to the signed-in student, or null.
function loadSession(signal, setStudent, setStatus) {
  return api('/auth/me', { signal })
    .then((data) => { setStudent(data.student); setStatus('signed-in'); return data.student; })
    .catch((error) => { if (error.name !== 'AbortError') setStatus(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'unavailable'); return null; });
}

// A Google sign-in for an account with no name comes back with ?welcome=name. One-shot: dropped
// from the address as soon as it is read.
function takeWelcomeFlag() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('welcome') !== 'name') return false;
  url.searchParams.delete('welcome');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

/**
 * Student session for the public site.
 * openLogin({ reason?, onSuccess?(student), returnTo?, notice? }) opens the login popup; onSuccess
 * runs once after a successful verification (it is dropped if the popup is closed without logging
 * in). "Continue with Google" leaves the page, so onSuccess cannot survive it: `returnTo` is the
 * same-site URL that carries the caller's intent instead (default: the current page). `notice`
 * is shown above the form, e.g. why a previous Google attempt failed. `askName` opens the popup
 * on its "What should we call you?" step for a signed-in student who has no name yet.
 */
export function StudentAuthProvider({ children }) {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [login, setLogin] = useState({ open: false, reason: '', returnTo: '', notice: '', askName: false });
  const pending = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal, setStudent, setStatus).then((loaded) => {
      if (loaded && takeWelcomeFlag() && !loaded.name) setLogin({ open: true, reason: '', returnTo: '', notice: '', askName: true });
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const expire = () => { setStudent(null); setStatus('signed-out'); };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  // Server components (gated pages, the header's view of the session) re-render with the new cookie.
  const signIn = useCallback((nextStudent) => {
    setStudent(nextStudent); setStatus('signed-in');
    router.refresh();
  }, [router]);
  const signOut = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally {
      setStudent(null); setStatus('signed-out');
      if (isGatedPath(window.location.pathname)) router.replace('/'); else router.refresh();
    }
  }, [router]);
  // Re-checks the session, e.g. after the API was unreachable.
  const refresh = useCallback(() => { setStatus('loading'); return loadSession(undefined, setStudent, setStatus); }, []);

  // Event handlers may pass a click event straight through (onClick={openLogin}); only plain options count.
  const openLogin = useCallback((options) => {
    const plain = options && typeof options === 'object' && !('nativeEvent' in options) ? options : {};
    pending.current = typeof plain.onSuccess === 'function' ? plain.onSuccess : null;
    const text = (key) => (typeof plain[key] === 'string' ? plain[key] : '');
    setLogin({ open: true, reason: text('reason'), returnTo: text('returnTo'), notice: text('notice'), askName: plain.askName === true });
  }, []);
  const closeLogin = useCallback(() => { pending.current = null; setLogin((current) => ({ ...current, open: false })); }, []);
  // Called by the login popup after verification: closes it and continues the caller's flow.
  const completeLogin = useCallback((nextStudent) => {
    const next = pending.current;
    pending.current = null;
    setLogin((current) => ({ ...current, open: false }));
    signIn(nextStudent);
    if (next) window.setTimeout(() => next(nextStudent), 0);
  }, [signIn]);

  const value = useMemo(() => ({
    student, status, signIn, signOut, setStudent, refresh,
    loginOpen: login.open, loginReason: login.reason, loginReturnTo: login.returnTo, loginNotice: login.notice, loginAskName: login.askName, openLogin, closeLogin, completeLogin,
  }), [student, status, signIn, signOut, refresh, login, openLogin, closeLogin, completeLogin]);
  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>;
}

export function useStudentAuth() {
  const value = useContext(StudentAuthContext);
  if (!value) throw new Error('useStudentAuth must be used inside StudentAuthProvider');
  return value;
}
