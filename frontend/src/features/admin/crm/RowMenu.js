'use client';
// The "⋮" row-action menu used on every admin list (leads, staff, roles, catalogue, drives, students…).
//
//   <RowMenu label={`Actions for ${name}`} items={[
//     { key: 'open', label: 'Open', icon: 'eye', href: `/admin/leads/${id}` },
//     { key: 'edit', label: 'Edit', icon: 'edit', onSelect: () => … },
//     { divider: true },
//     { key: 'delete', label: 'Delete…', icon: 'trash', tone: 'danger', onSelect: () => … },
//   ]} />
//
// Items: { key, label, icon?, onSelect?, href?, tone?: 'danger', disabled?, reason? (why it is disabled),
//          hidden?, hint? (small right-hand text), divider?: true, heading?: 'Group title' }.
// It renders in a portal so scrolling tables never clip it, flips upward near the bottom of the screen,
// and follows the WAI-ARIA menu pattern: ↑ ↓ Home End move, Enter/Space choose, Esc closes and returns focus.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import styles from './RowMenu.module.css';

const GAP = 6;
const isItem = (item) => item && !item.divider && !item.heading && !item.hidden;

export default function RowMenu({ items, label = 'More actions', align = 'end', className, trigger }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState(null);
  const button = useRef(null);
  const menu = useRef(null);
  const id = useId();
  const visible = items.filter((item) => item && !item.hidden);
  // Drop leading/trailing/duplicate separators left behind by hidden items.
  const clean = visible.filter((item, index) => !(item.divider && (index === 0 || index === visible.length - 1 || visible[index - 1]?.divider)));

  const close = useCallback((restoreFocus = true) => { setOpen(false); if (restoreFocus) button.current?.focus(); }, []);

  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    const anchor = button.current.getBoundingClientRect();
    const box = menu.current.getBoundingClientRect();
    const below = window.innerHeight - anchor.bottom - GAP;
    const flip = below < box.height + 8 && anchor.top > below;
    const top = flip ? Math.max(8, anchor.top - box.height - GAP) : anchor.bottom + GAP;
    const left = align === 'start' ? anchor.left : anchor.right - box.width;
    setPlace({ top, left: Math.min(Math.max(8, left), window.innerWidth - box.width - 8), flip, maxHeight: Math.max(160, (flip ? anchor.top : below) - 12) });
  }, [open, align, clean.length]);

  useEffect(() => {
    if (!open) return undefined;
    const first = menu.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
    const away = (event) => { if (!menu.current?.contains(event.target) && !button.current?.contains(event.target)) close(false); };
    const leave = () => close(false);
    document.addEventListener('pointerdown', away);
    window.addEventListener('resize', leave);
    window.addEventListener('scroll', leave, true);
    return () => { document.removeEventListener('pointerdown', away); window.removeEventListener('resize', leave); window.removeEventListener('scroll', leave, true); };
  }, [open, close]);

  const onMenuKey = (event) => {
    const nodes = [...menu.current.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    const index = nodes.indexOf(document.activeElement);
    const go = (next) => { event.preventDefault(); nodes[(next + nodes.length) % nodes.length]?.focus(); };
    if (event.key === 'ArrowDown') go(index + 1);
    else if (event.key === 'ArrowUp') go(index - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(nodes.length - 1);
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'Tab') close(false);
    else if (event.key.length === 1 && /\S/.test(event.key)) { // type a letter to jump
      const hit = nodes.findIndex((node, at) => at > index && node.textContent.trim().toLowerCase().startsWith(event.key.toLowerCase())) ;
      if (hit >= 0) go(hit);
    }
  };

  const choose = (item) => { if (item.disabled) return; close(!item.href); item.onSelect?.(); };
  if (!clean.some(isItem)) return null;

  return <>
    <button ref={button} type="button" className={[styles.trigger, className].filter(Boolean).join(' ')} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={label} title={label}
      onClick={(event) => { event.stopPropagation(); setOpen((current) => !current); }}
      onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); setOpen(true); } }}>
      {trigger ?? <Icon name="more" />}
    </button>
    {open && createPortal(
      <div ref={menu} id={id} role="menu" aria-label={label} className={styles.menu} data-flip={place?.flip || undefined} onKeyDown={onMenuKey} onClick={(event) => event.stopPropagation()}
        style={place ? { top: place.top, left: place.left, maxHeight: place.maxHeight, visibility: 'visible' } : { top: 0, left: 0, visibility: 'hidden' }}>
        {clean.map((item, index) => {
          if (item.divider) return <div key={`d${index}`} className={styles.divider} role="separator" />;
          if (item.heading) return <p key={`h${index}`} className={styles.heading} role="presentation">{item.heading}</p>;
          const content = <><span className={styles.icon}>{item.icon && <Icon name={item.icon} />}</span><span className={styles.text}>{item.label}</span>{item.hint && <small className={styles.hint}>{item.hint}</small>}</>;
          const common = { role: 'menuitem', className: styles.item, 'data-tone': item.tone, 'aria-disabled': item.disabled || undefined, title: item.disabled ? item.reason : undefined, tabIndex: -1 };
          return item.href && !item.disabled
            ? <Link key={item.key ?? index} href={item.href} {...common} onClick={() => close(false)}>{content}</Link>
            : <button key={item.key ?? index} type="button" {...common} onClick={() => choose(item)}>{content}</button>;
        })}
      </div>,
      document.body,
    )}
  </>;
}
