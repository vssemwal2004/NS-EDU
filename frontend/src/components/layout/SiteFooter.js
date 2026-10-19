import Link from 'next/link';
import Brand from '@/components/ui/Brand';
import Icon from '@/components/ui/Icon';
import { getSharedContent } from '@/lib/api/content';
import styles from './SiteFooter.module.css';

// Dark oxblood footer. Every word and link comes from the admin-edited `site` content entry;
// when it is unavailable only the logo and the legal line render. Social icons show only for
// profiles that have a real URL.
export default async function SiteFooter() {
  const { site } = await getSharedContent();
  const copy = site?.footer;
  const name = site?.name || 'Gyaan Vidhya';
  const socials = (site?.socials || []).filter((social) => social.href);

  return <footer id="site-footer" className={`lux-surface-dark ${styles.footer}`}>
    <div className={`lux-container lux-container--wide ${styles.inner}`}>
      <div className={styles.top}>
        <div className={styles.identity}>
          <Link href="/" className={styles.brand} aria-label={`${name} home`}><Brand tone="light" /></Link>
          {copy?.title && <p className={styles.statement}>{copy.title} <span>{copy.titleAccent}</span></p>}
          {copy?.lead && <p className={styles.lead}>{copy.lead}</p>}
          {site?.supportEmail && <Link prefetch={false} href="/contact" className={styles.contact}>
            <Icon name="mail" /><span><strong>Contact &amp; support</strong><small>{site.supportEmail}{site.contactIsTemporary ? ' · preview address' : ''}</small></span>
          </Link>}
          {socials.length > 0 && <ul className={styles.socials} aria-label={`${name} on social media`}>
            {socials.map((social) => <li key={social.name}><a href={social.href} target="_blank" rel="noopener noreferrer" aria-label={`${social.name} (opens in a new tab)`}><Icon name={social.icon} /></a></li>)}
          </ul>}
        </div>
        {site?.footerGroups?.length > 0 && <div className={styles.groups}>
          {site.footerGroups.map((group) => <nav key={group.title} className={styles.group} aria-label={group.title}>
            <h2>{group.title}</h2>
            <ul>{group.links.map((link) => <li key={link.href + link.label}><Link prefetch={false} href={link.href}>{link.label}</Link></li>)}</ul>
          </nav>)}
        </div>}
      </div>
      <div className="lux-rule" aria-hidden="true" />
      <div className={styles.bottom}>
        <p>© {new Date().getFullYear()} {name}. All rights reserved.</p>
        {copy?.trustNote && <p className={styles.note}>{copy.trustNote}</p>}
        <a href="#top" className={styles.backTop}>Back to top<Icon name="arrowUp" /></a>
      </div>
    </div>
  </footer>;
}
