import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { footerGroups, site } from '@/data/site';
import styles from './SiteFooter.module.css';

export default function SiteFooter() {
  return <footer id="site-footer" className={styles.footer} aria-label="NSEDU site footer">
    <div className={styles.art} aria-hidden="true"><svg viewBox="0 0 450 300" fill="none"><path d="M25 230h390M60 230V120h110v110m-97-87h20v27H73zm48 0h20v27h-20zM82 230v-34h38v34M170 230V85h170v145M184 85l71-47 71 47M225 230v-55h60v55M190 108h26v33h-26zm51 0h26v33h-26zm51 0h26v33h-26zM340 230V120h60v110M360 140h20v30h-20zM55 247h345M205 66V45m100 21V45" /><circle cx="255" cy="75" r="8" /><path d="M35 200c-22-23-18-60 3-66 29 6 25 46-3 66Zm0-7v37M415 207c-24-26-19-58 0-68 24 9 29 44 0 68Zm0-6v29" /></svg></div>
    <div className={`container ${styles.container}`}>
      <div className={styles.invitation}>
        <div><p className={styles.eyebrow}><Icon name="compass" />YOUR NEXT CHAPTER</p><h2>A clearer path to <span>your future.</span></h2><p>Explore your options. Understand the details. Choose with confidence.</p></div>
        <div className={styles.actions}><Link prefetch={false} className={styles.primary} href="/#course-colleges">Explore colleges<Icon name="arrow" /></Link><Link prefetch={false} className={styles.secondary} href="/help"><Icon name="support" />Get help</Link></div>
      </div>
      <div className={styles.directory}>
        <div className={styles.brand}>
          <Link href="/" className={styles.wordmark} aria-label="NSEDU home">{site.name}</Link>
          <p className={styles.tagline}>{site.tagline}</p>
          <p className={styles.intro}>Thoughtful college choices begin with clear information. Find your course, compare your options and plan what comes next.</p>
          <Link prefetch={false} href="/contact" className={styles.contact}><Icon name="mail" /><span><strong>Contact & support</strong><span>{site.supportEmail}</span></span></Link>
          {site.contactIsTemporary && <p className={styles.previewNote}>Temporary email · preview only</p>}
          <nav className={styles.socials} aria-label="NSEDU social profiles">{site.socials.map((social) => <Link prefetch={false} key={social.name} href={social.href || '/contact#social-profiles'} aria-label={`${social.name}${social.href ? ' (opens in a new tab)' : ' — profile coming soon'}`} title={social.href ? social.name : `${social.name} · coming soon`} target={social.href ? '_blank' : undefined} rel={social.href ? 'noopener noreferrer' : undefined}><Icon name={social.icon} /></Link>)}</nav>
          {site.socials.some((social) => !social.href) && <p className={styles.previewNote}>Official social profiles coming soon.</p>}
        </div>
        {footerGroups.map((group) => <nav key={group.title} className={styles.group} aria-label={`${group.title} footer links`}><h3>{group.title}</h3><ul>{group.links.map((link) => <li key={link.label}><Link prefetch={false} href={link.href}>{link.label}</Link></li>)}</ul></nav>)}
      </div>
      <div className={styles.trust}><Icon name="book" /><p>Clear information. Thoughtful choices.<span>Confirm admission requirements and fees with the institution before applying.</span></p><Link prefetch={false} href="/sources-and-editorial">How we use sources<Icon name="arrow" /></Link></div>
      <div className={styles.bottom}><p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p><p className={styles.signature}>Discover possibilities. Build your tomorrow.</p><a href="#top" className={styles.backTop}>Back to top<Icon name="arrowUp" /></a></div>
    </div>
  </footer>;
}
