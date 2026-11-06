'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useStudentAuth } from '@/providers/StudentAuthProvider';

/**
 * Soft login prompt for signed-out visitors: after a few explorations (university profiles,
 * searches, compare, news, course and exam pages…) the login popup opens with reason 'nudge'.
 * It always has a close button, so the visitor can carry on; each dismissal pushes the next prompt
 * further away, and after MAX_PER_DAY prompts it stays quiet until tomorrow.
 *
 * This is a nudge, not access control. What must stay behind a login is enforced by the API
 * (free-preview limit on profiles and results, gated compare/apply/account routes). The counter
 * holds no personal data — only numbers and a date in this browser's localStorage.
 */
const FIRST_AFTER = (() => {
  const value = Number.parseInt(process.env.NEXT_PUBLIC_LOGIN_NUDGE_AFTER ?? '', 10);
  return Number.isInteger(value) && value >= 0 && value <= 50 ? value : 3; // 0 turns the nudge off
})();
const THEN_EVERY = 4;
const MAX_PER_DAY = 3;
const SHOW_DELAY_MS = 1200; // let the page the visitor asked for render first
const SEARCH_SETTLE_MS = 1500; // a search counts once the query stops changing
const STORAGE_KEY = 'gv_login_nudge';

// Exploration areas whose page views count. Login, apply, account and legal pages never do.
const COUNTED = /^\/(universities|search|compare|news|courses|exams|colleges|locations|career-guidance|scholarships|budget|eligibility|admission-checklist)(\/|$)/;
const QUIET = /^\/(login|apply|account|privacy-policy|terms-and-conditions|contact|r)(\/|$)/;

const today = () => new Date().toISOString().slice(0, 10);
const fresh = () => ({ day: today(), actions: 0, shown: 0, nextAt: FIRST_AFTER });
let memory = null; // used when storage is blocked (private mode, disabled site data)

function read() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
    const valid = stored && stored.day === today() && [stored.actions, stored.shown, stored.nextAt].every(Number.isInteger);
    return valid ? stored : fresh();
  } catch {
    return memory?.day === today() ? memory : fresh();
  }
}
function write(state) {
  memory = state;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* memory copy only */ }
  return state;
}

export default function LoginNudge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim().toLowerCase();
  const { status, loginOpen, openLogin } = useStudentAuth();
  const lastPath = useRef('');
  const lastQuery = useRef('');
  const showTimer = useRef(0);
  const live = useRef({ status, loginOpen, pathname });
  useEffect(() => { live.current = { status, loginOpen, pathname }; });

  useEffect(() => () => window.clearTimeout(showTimer.current), []);

  useEffect(() => {
    if (!FIRST_AFTER || status !== 'signed-out') return undefined;

    function maybeShow() {
      const state = read();
      if (state.shown >= MAX_PER_DAY || state.actions < state.nextAt) return;
      window.clearTimeout(showTimer.current);
      showTimer.current = window.setTimeout(() => {
        const now = live.current;
        // Re-checked at the last moment: the visitor may have logged in, moved on, or opened another dialog.
        if (now.status !== 'signed-out' || now.loginOpen || QUIET.test(now.pathname)) return;
        if (document.visibilityState !== 'visible' || document.querySelector('dialog[open], [aria-modal="true"]')) return;
        // Counted as soon as it is shown, so closing it (X, Escape, "Maybe later") moves the next one on.
        const latest = read();
        write({ ...latest, shown: latest.shown + 1, nextAt: latest.actions + THEN_EVERY });
        openLogin({ reason: 'nudge', returnTo: `${window.location.pathname}${window.location.search}` });
      }, SHOW_DELAY_MS);
    }
    function count() {
      const state = read();
      write({ ...state, actions: state.actions + 1 });
      maybeShow();
    }

    let settle = 0;
    if (COUNTED.test(pathname) && pathname !== lastPath.current) {
      lastPath.current = pathname;
      lastQuery.current = query;
      count();
    } else if (query && query !== lastQuery.current && COUNTED.test(pathname)) {
      // A new search on the same page (the /search palette, the directory search box).
      settle = window.setTimeout(() => { lastQuery.current = query; count(); }, SEARCH_SETTLE_MS);
    }
    if (!COUNTED.test(pathname)) lastPath.current = pathname;
    return () => window.clearTimeout(settle);
  }, [pathname, query, status, openLogin]);

  return null;
}
