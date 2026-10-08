import Link from 'next/link';
import { notFound } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { site } from '@/data/site';
import { sitePages } from '@/data/site-pages';
import styles from './page.module.css';

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(sitePages).map((slug) => ({ slug })); }
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const page = Object.hasOwn(sitePages, slug) ? sitePages[slug] : null;
  if (!page) notFound();
  return { title: `${page.title} | NSEDU`, description: page.description, ...(page.draft || (slug === 'contact' && site.contactIsTemporary) ? { robots: { index: false, follow: true } } : {}) };
}

export default async function InformationPage({ params }) {
  const { slug } = await params;
  const page = Object.hasOwn(sitePages, slug) ? sitePages[slug] : null;
  if (!page) notFound();
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className={styles.header}><Link href="/" className={styles.logo} aria-label="NSEDU home">NSEDU<span>Discover · Learn · Belong</span></Link><nav aria-label="Page navigation"><Link href="/">Explore NSEDU<Icon name="arrow" /></Link><Link href="/help">Help centre</Link></nav></header>
    <main id="main" tabIndex={-1} className={styles.main}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{page.title}</span></nav>
      <div className={styles.heading}><p className="eyebrow">{page.category}</p><h1>{page.title}</h1><p>{page.description}</p></div>
      {page.draft && <p className={styles.notice}><Icon name="document" /><span><strong>Policy preview</strong>Draft content for this preview. Final company and service policies are still being prepared.</span></p>}
      <article className={styles.article}>{page.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.text}</p>{section.links && <ul className={styles.links}>{section.links.map((link) => <li key={link.href}><Link prefetch={false} href={link.href} target={link.href.startsWith('https:') ? '_blank' : undefined} rel={link.href.startsWith('https:') ? 'noopener noreferrer' : undefined}>{link.label}<Icon name={link.href.startsWith('https:') ? 'external' : 'arrow'} />{link.href.startsWith('https:') && <span className="sr-only"> (opens in a new tab)</span>}</Link></li>)}</ul>}</section>)}</article>
      {slug === 'contact' && <>
        <section className={styles.contact}><Icon name="mail" /><div><h2>Email support</h2>{site.contactIsTemporary ? <p>{site.supportEmail}</p> : <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>}<p className={styles.small}>{site.contactIsTemporary ? 'Temporary address for the design preview. Email support is not active yet.' : 'Include the relevant page and a short description of your question.'}</p></div></section>
        <section id="social-profiles" className={styles.contact}><Icon name="people" /><div><h2>Official social profiles</h2><p className={styles.small}>Follow our education updates when the official profiles are available.</p><ul className={styles.profiles}>{site.socials.map((social) => <li key={social.name}><Icon name={social.icon} />{social.href ? <a href={social.href} target="_blank" rel="noopener noreferrer">{social.name}<span className="sr-only"> (opens in a new tab)</span></a> : <span>{social.name}<small>Coming soon</small></span>}</li>)}</ul></div></section>
      </>}
      <div className={styles.return}><Link href="/"><Icon name="arrow" />Return to the student platform</Link></div>
    </main>
  </>;
}
