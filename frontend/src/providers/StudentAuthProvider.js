'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isGatedPath } from '@/features/auth/gated-routes';
import { api, ApiError, SESSION_EXPIRED_EVENT } from '@/lib/api/client';

const StudentAuthContext = createContext(null);

function loadSession(signal, setStudent, setStatus) {
  return api('/auth/me', { signal })
    .then((data) => { setStudent(data.student); setStatus('signed-in'); })
    .catch((error) => { if (error.name !== 'AbortError') setStatus(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'unavailable'); });
}

/**
 * Student session for the public site.
 * openLogin({ reason?, onSuccess?(student) }) opens the login popup; onSuccess runs once after a
 * successful verification (it is dropped if the popup is closed without logging in).
 */
export function StudentAuthProvider({ children }) {
  const router = useRouter();
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [login, setLogin] = useState({ open: false, reason: '' });
  const pending = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal, setStudent, setStatus);
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
    setLogin({ open: true, reason: typeof plain.reason === 'string' ? plain.reason : '' });
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
    loginOpen: login.open, loginReason: login.reason, openLogin, closeLogin, completeLogin,
  }), [student, status, signIn, signOut, refresh, login, openLogin, closeLogin, completeLogin]);
  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>;
}

export function useStudentAuth() {
  const value = useContext(StudentAuthContext);
  if (!value) throw new Error('useStudentAuth must be used inside StudentAuthProvider');
  return value;
}
