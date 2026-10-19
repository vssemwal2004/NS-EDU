'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import QuickApplyDialog from '@/features/apply/QuickApplyDialog';
import { useStudentAuth } from '@/providers/StudentAuthProvider';

const QuickApplyContext = createContext(null);

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
  const { status, openLogin } = useStudentAuth();
  const [current, setCurrent] = useState(null);
  const count = useRef(0);

  const show = useCallback((request) => { count.current += 1; setCurrent({ ...request, key: count.current }); }, []);
  const open = useCallback((options) => {
    const university = options?.university;
    if (!university?.id || !university?.name) return;
    const request = { university: clean(university), courseSlug: typeof options.courseSlug === 'string' ? options.courseSlug : '' };
    // While the session is still loading the form itself checks it and offers login on a 401.
    if (status === 'signed-out') openLogin({ reason: 'apply', onSuccess: () => show(request) });
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
