'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';

/**
 * The visitor's cookie choice: 'all' (essential + personalisation), 'essential', or null while
 * they have not chosen. It lives in the `gv_consent` cookie, which the server also reads and
 * enforces (backend/src/modules/consent). `open` drives the banner: shown on a first visit and
 * again whenever the visitor picks "Cookie settings" in the footer.
 */
export const CONSENT_COOKIE = 'gv_consent';
const MAX_AGE = 180 * 24 * 60 * 60;
const CHOICES = ['all', 'essential'];
const ConsentContext = createContext(null);

function readChoice() {
  try {
    const value = document.cookie.split('; ').find((part) => part.startsWith(`${CONSENT_COOKIE}=`))?.split('=')[1];
    return CHOICES.includes(value) ? value : null;
  } catch { return null; }
}

/**
 * The live answer, read from the cookie at the moment of asking. Tracking uses this rather than the
 * context value: a page records its search as it mounts, a tick before the provider has read the
 * cookie, and a consenting visitor's first event would otherwise be lost.
 */
export const hasPersonalisationConsent = () => typeof document !== 'undefined' && readChoice() === 'all';

export function ConsentProvider({ children }) {
  // Unknown on the server and in the first client render, so markup matches; read after mount.
  const [state, setState] = useState({ ready: false, consent: null, open: false });

  useEffect(() => {
    const consent = readChoice();
    const timer = window.setTimeout(() => setState({ ready: true, consent, open: consent === null }), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const choose = useCallback((choice) => {
    if (!CHOICES.includes(choice)) return;
    // Written here first so the choice holds even if the request fails; the server then confirms
    // it, logs the decision anonymously and, for "essential", removes the personalisation id.
    try { document.cookie = `${CONSENT_COOKIE}=${choice}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`; } catch { /* cookies blocked */ }
    setState({ ready: true, consent: choice, open: false });
    api('/consent', { method: 'POST', body: { choice } }).catch(() => {});
  }, []);
  const reopen = useCallback(() => setState((current) => ({ ...current, open: true })), []);
  const dismiss = useCallback(() => setState((current) => ({ ...current, open: current.consent === null })), []);

  const value = useMemo(() => ({ ...state, personalisation: state.consent === 'all', choose, reopen, dismiss }), [state, choose, reopen, dismiss]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

const OUTSIDE = Object.freeze({ ready: true, consent: null, open: false, personalisation: false, choose: () => {}, reopen: () => {}, dismiss: () => {} });
export const useConsent = () => useContext(ConsentContext) ?? OUTSIDE;
