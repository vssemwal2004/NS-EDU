'use client';
import { createContext, useCallback, useContext, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { directoryHref } from './directory-url';

// Client glue for the server-rendered directory: one transition for every URL change, so the
// current results stay on screen (dimmed, aria-busy) until the next server render arrives.
const DirectoryContext = createContext(null);

export function DirectoryProvider({ params, children }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = useCallback((href, { push = true, toResults = false } = {}) => {
    if (toResults) {
      const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('directory-results')?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    }
    startTransition(() => (push ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false })));
  }, [router]);
  const value = useMemo(() => ({ params, pending, navigate, go: (patch, options) => navigate(directoryHref(params, patch), options) }), [params, pending, navigate]);
  return <DirectoryContext value={value}>{children}</DirectoryContext>;
}

export const useDirectory = () => useContext(DirectoryContext);

// A real link (works without JS, opens in new tabs) that navigates inside the shared transition.
export function DirLink({ href, toResults = false, children, ...rest }) {
  const { navigate } = useDirectory();
  return <Link href={href} {...rest} onClick={(event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href, { toResults });
  }}>{children}</Link>;
}

export function ResultsRegion({ className, children }) {
  const { pending } = useDirectory();
  return <div className={className} aria-busy={pending} data-pending={pending || undefined}>{children}</div>;
}

export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="lux-button lux-button--primary" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
    <Icon name="refresh" />{pending ? 'Trying again…' : 'Try again'}
  </button>;
}
