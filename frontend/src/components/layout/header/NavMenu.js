import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './NavMenu.module.css';

// Light desktop dropdown: a short list of links with one-line descriptions and an optional "all" link.
export default function NavMenu({ label, items = [], columns = 1, footer, onNavigate }) {
  return <div className={styles.menu} data-columns={columns}>
    {items.length > 0 && <ul className={styles.list} aria-label={label}>
      {items.map((item) => <li key={item.href}><Link className={styles.item} href={item.href} onClick={onNavigate}>
        <span className={styles.icon}><Icon name={item.icon} /></span>
        <span className={styles.text}><strong>{item.label}</strong>{item.description && <small>{item.description}</small>}</span>
      </Link></li>)}
    </ul>}
    {footer && <Link className={styles.footer} href={footer.href} onClick={onNavigate}>{footer.label}<Icon name="arrow" /></Link>}
  </div>;
}
