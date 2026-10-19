import Link from 'next/link';
import StatusPage from '@/components/layout/StatusPage';
import Icon from '@/components/ui/Icon';

export const metadata = { title: 'Page not found | Gyaan Vidhya' };

export default function NotFound() {
  return <StatusPage mark="404" eyebrow="Page not found" title="Let’s get you back on course."
    actions={<><Link className="lux-button lux-button--primary" href="/">Back to the home page<Icon name="arrow" /></Link><Link className="lux-button lux-button--ghost" href="/universities">Find universities</Link></>}>
    <p>The page you were looking for has moved or does not exist. These are good places to continue.</p>
  </StatusPage>;
}
