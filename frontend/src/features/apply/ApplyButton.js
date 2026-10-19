'use client';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { useQuickApply } from '@/providers/QuickApplyProvider';
import { useTracking } from '@/providers/TrackingProvider';

const VARIANTS = new Set(['primary', 'outline', 'light']);

/**
 * The Apply CTA for every page (server components can render it). Opens quick apply; before
 * hydration, or with a modifier key, it is a plain link to /apply?university=<id>.
 * @param {{ university: { id: string, name: string, city?: string, state?: string, logoUrl?: string },
 *   courseSlug?: string, variant?: 'primary'|'outline'|'light', size?: 'md'|'lg', block?: boolean,
 *   children?: React.ReactNode, className?: string }} props
 */
export default function ApplyButton({ university, courseSlug = '', variant = 'primary', size = 'md', block = false, children, className = '' }) {
  const { open } = useQuickApply();
  const { trackApplyOpen } = useTracking();
  const href = `/apply?university=${encodeURIComponent(university.id)}${courseSlug ? `&course=${encodeURIComponent(courseSlug)}` : ''}`;
  const classes = ['lux-button', `lux-button--${VARIANTS.has(variant) ? variant : 'primary'}`, size === 'lg' && 'lux-button--lg', block && 'lux-button--block', className].filter(Boolean).join(' ');
  return <Link className={classes} href={href} prefetch={false} aria-haspopup="dialog"
    onClick={(event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      trackApplyOpen(university.id, { city: university.city, state: university.state, courseSlug });
      open({ university, courseSlug });
    }}>
    {children ?? <>Apply now<span className="sr-only"> to {university.name}</span><Icon name="arrow" /></>}
  </Link>;
}
