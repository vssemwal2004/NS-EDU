'use client';
import { useEffect, useRef } from 'react';
import { useTracking } from '@/providers/TrackingProvider';

/**
 * Fires one event when it mounts, so a server component can record a view or a search without
 * becoming a client component itself. Renders nothing.
 * `key` it (or change `event`) when the same page should record again, e.g. a new slug.
 * @param {{ event: { type: 'search'|'view'|'filter'|'apply-open'|'compare', query?: string,
 *   institutionSlug?: string, state?: string, city?: string, stream?: string, courseSlug?: string, results?: number } }} props
 */
export default function TrackEvent({ event }) {
  const { track } = useTracking();
  const signature = JSON.stringify(event ?? null);
  const sent = useRef('');
  useEffect(() => {
    if (!event || sent.current === signature) return;
    sent.current = signature;
    track(event);
    // `signature` is the stable identity of `event`; tracking the object itself would re-fire on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, track]);
  return null;
}
