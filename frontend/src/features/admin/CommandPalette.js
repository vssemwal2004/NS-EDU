'use client';
// Ctrl+K (or "/") search: jump to any screen this person may open, find a lead by ref, name, mobile or
// email (live, first 6 matches), or carry the text into the universities or leads search.
// Keyboard: ↑ ↓ move, Enter opens, Esc closes.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { adminPages, canOpen } from '@/data/admin-navigation';
import { HeatChip, StageChip } from './crm/ui';
import styles from './CommandPalette.module.css';

const holds = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));
const LEADS = ['leads.view_own', 'leads.view_team', 'leads.view_all'];
const fold = (text) => String(text ?? '').toLowerCase();

export default function CommandPalette({ admin, request, onClose }) {
  const router = useRouter();
  const input = useRef(null);
  const list = useRef(null);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [leads, setLeads] = useState({ for: '', items: [], loading: false });
  const canLeads = LEADS.some((key) => holds(admin, key));
  const query = text.trim();

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    if (!canLeads || query.length < 2) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLeads((current) => ({ ...current, loading: true }));
      request(`/leads?${new URLSearchParams({ q: query, limit: '25' })}`, { signal: controller.signal })
        .then((data) => setLeads({ for: query, items: data.items.slice(0, 6), loading: false }))
        .catch((error) => { if (error.name !== 'AbortError') setLeads({ for: query, items: [], loading: false }); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, canLeads, request]);

  const results = useMemo(() => {
    const pages = adminPages.filter((page) => canOpen(admin, page))
      .filter((page) => !query || fold(`${page.label} ${page.section.label} ${page.group} ${page.description}`).includes(fold(query)))
      .slice(0, query ? 6 : 10)
      .map((page) => ({ key: `page:${page.href}`, kind: 'Go to', icon: page.icon, title: page.label, detail: page.label === page.section.label ? page.group : `${page.section.label} · ${page.group}`, href: page.href }));
    const found = query.length >= 2 && leads.for === query ? leads.items.map((lead) => ({
      key: `lead:${lead.id}`, kind: 'Lead', icon: 'user', title: lead.applicant?.fullName || lead.ref,
      detail: [lead.ref, lead.applicant?.phone, lead.applicant?.city].filter(Boolean).join(' · '), href: `/admin/leads/${lead.id}`, lead,
    })) : [];
    const searches = query ? [
      canLeads && { key: 'search:leads', kind: 'Search', icon: 'search', title: `Search all leads for “${query}”`, detail: 'Leads list', href: `/admin/leads?${new URLSearchParams({ q: query })}` },
      holds(admin, 'catalogue.edit') && { key: 'search:universities', kind: 'Search', icon: 'building', title: `Search universities for “${query}”`, detail: 'Universities & courses', href: `/admin/institutions?${new URLSearchParams({ q: query })}` },
    ].filter(Boolean) : [];
    return [...found, ...searches, ...pages];
  }, [admin, query, leads, canLeads]);

  const choose = (item) => { if (!item) return; onClose(); router.push(item.href); };
  const onKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(results.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(results[active]); }
  };
  useEffect(() => { list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  let lastKind = '';
  return <div className={styles.backdrop} onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Search the admin console" onKeyDown={onKey}>
      <label className={styles.field}>
        <Icon name="search" />
        <input ref={input} value={text} onChange={(event) => { setText(event.target.value); setActive(0); }} placeholder="Type a lead name, mobile, GV- ref or a page…"
          role="combobox" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={results[active] ? `palette-${active}` : undefined} autoComplete="off" spellCheck={false} />
        {leads.loading && query.length >= 2 && <span className={styles.spinner} aria-label="Searching leads" />}
        <kbd>Esc</kbd>
      </label>
      <ul id="palette-results" ref={list} className={styles.results} role="listbox" aria-label="Results">
        {results.map((item, index) => {
          const heading = item.kind !== lastKind ? (lastKind = item.kind) : null;
          return [
            heading && <li key={`h-${item.kind}`} className={styles.heading} role="presentation">{heading === 'Go to' ? 'Pages' : heading === 'Lead' ? 'Leads' : 'Search'}</li>,
            <li key={item.key} id={`palette-${index}`} role="option" aria-selected={index === active} data-active={index === active}
              className={styles.result} onPointerMove={() => setActive(index)} onClick={() => choose(item)}>
              <span className={styles.resultIcon}><Icon name={item.icon} /></span>
              <span className={styles.resultText}><strong>{item.title}</strong><small>{item.detail}</small></span>
              {item.lead && <span className={styles.resultChips}><StageChip status={item.lead.status} size="sm" /><HeatChip heat={item.lead.crm?.heat} size="sm" /></span>}
              {index === active && <Icon name="arrow" />}
            </li>,
          ];
        })}
        {!results.length && <li className={styles.empty} role="presentation">{leads.loading ? 'Searching…' : `Nothing matches “${query}”.`}</li>}
      </ul>
      <p className={styles.footer}><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></p>
    </div>
  </div>;
}
