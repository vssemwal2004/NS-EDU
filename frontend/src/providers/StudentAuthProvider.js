'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';

const StudentAuthContext = createContext(null);

function loadSession(signal, setStudent, setStatus) {
  return api('/auth/me', { signal })
    .then((data) => { setStudent(data.student); setStatus('signed-in'); })
    .catch((error) => { if (error.name !== 'AbortError') setStatus(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'unavailable'); });
}

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [status, setStatus] = useState('loading');
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadSession(controller.signal, setStudent, setStatus);
    return () => controller.abort();
  }, []);

  const signIn = useCallback((nextStudent) => { setStudent(nextStudent); setStatus('signed-in'); }, []);
  const signOut = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } finally { setStudent(null); setStatus('signed-out'); }
  }, []);
  // Re-checks the session, e.g. after the API was unreachable.
  const refresh = useCallback(() => { setStatus('loading'); return loadSession(undefined, setStudent, setStatus); }, []);
  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);
  const value = useMemo(() => ({
    student, status, signIn, signOut, setStudent, refresh,
    loginOpen, openLogin, closeLogin,
  }), [student, status, signIn, signOut, refresh, loginOpen, openLogin, closeLogin]);
  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>;
}

export function useStudentAuth() {
  const value = useContext(StudentAuthContext);
  if (!value) throw new Error('useStudentAuth must be used inside StudentAuthProvider');
  return value;
}
