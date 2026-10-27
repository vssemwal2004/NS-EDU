'use client';
import { useEffect, useRef } from 'react';

const GUARD_STATE = 'gvUnsavedGuard';

/**
 * While `dirty`, asks before the page is left: closing or reloading the tab (beforeunload), clicks on
 * in-app links, and browser Back. Link clicks and Back are client-side navigations that never fire
 * beforeunload: the capture-phase click listener runs before next/link's handler, and a same-URL guard
 * history entry absorbs the first Back press so we can ask (and push it again on "stay").
 */
export function useUnsavedGuard(dirty, message = 'You have unsaved changes. Leave without saving?') {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    const click = (event) => {
      const link = typeof event.target?.closest === 'function' ? event.target.closest('a[href]') : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/') || url.pathname === window.location.pathname) return;
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation(); }
    };
    const guarded = window.location.href;
    const pushGuard = () => window.history.pushState({ [GUARD_STATE]: true }, '');
    let leaving = false;
    const popState = (event) => {
      // Only a Back press from the guard entry onto this same page can still be stopped.
      if (leaving || event.state?.[GUARD_STATE] || window.location.href !== guarded) return;
      if (!window.confirm(message)) { pushGuard(); return; }
      leaving = true;
      window.history.back();
    };
    pushGuard();
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', popState);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', popState);
      document.removeEventListener('click', click, true);
      // Saved or discarded while staying here: drop the guard entry so one Back press still leaves.
      // Deferred, because on unmount the router may be mid-navigation and must not be undone.
      if (!leaving) setTimeout(() => { if (mounted.current && window.history.state?.[GUARD_STATE]) window.history.back(); }, 0);
    };
  }, [dirty, message]);
}
