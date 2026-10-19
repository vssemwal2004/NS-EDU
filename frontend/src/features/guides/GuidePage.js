import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { isExternal } from './data';

// Shared link helper for the guide pages: internal links get an arrow, external ones open in a new tab.
export function LuxLink({ href, label, className = '' }) {
  if (!isExternal(href)) return <Link className={`lux-link ${className}`} href={href}>{label}<Icon name="arrow" /></Link>;
  return <a className={`lux-link ${className}`} href={href} target="_blank" rel="noopener noreferrer">{label}<Icon name="external" /><span className="sr-only"> (opens in a new tab)</span></a>;
}

// Shown when the guide content cannot be loaded (API unavailable); no bundled copy is used.
export function GuideUnavailable() {
  return <div className="lux-state" role="status">
    <Icon name="refresh" />
    <h2 className="lux-title">This guide is temporarily unavailable</h2>
    <p className="lux-lead">Please refresh in a moment.</p>
  </div>;
}
