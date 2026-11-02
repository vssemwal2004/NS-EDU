'use client';
// Org chart: owners, then each mentor above their reports (a tidy CSS tree), then people with no mentor.
// Cards are neutral; clicking one opens the person.
import { useMemo } from 'react';
import { Avatar } from '@/features/admin/crm/ui';
import { displayName } from '@/features/admin/crm/format';
import styles from './OrgChart.module.css';

const nameOf = (person) => person.name || displayName(person.email);

function PersonCard({ person, onOpen }) {
  const suspended = person.status === 'suspended';
  return <button type="button" className={styles.card} data-suspended={suspended || undefined} onClick={() => onOpen(person)}
    title={`${nameOf(person)} · ${person.roleName}${person.title ? ` · ${person.title}` : ''}${suspended ? ' · suspended' : ''}`}>
    <Avatar name={person.name} email={person.email} size={24} />
    <span className={styles.cardText}>
      <strong>{nameOf(person)}</strong>
      <small>{person.roleName}{suspended ? ' · Suspended' : ''}</small>
    </span>
    {person.directReports > 0 && <span className={styles.count} aria-label={`${person.directReports} reports`}>{person.directReports}</span>}
  </button>;
}

function Branch({ person, reports, onOpen }) {
  const kids = reports.get(person.id) ?? [];
  return <li>
    <PersonCard person={person} onOpen={onOpen} />
    {kids.length > 0 && <ul>{kids.map((kid) => <Branch key={kid.id} person={kid} reports={reports} onOpen={onOpen} />)}</ul>}
  </li>;
}

export default function OrgChart({ staff, onOpen }) {
  const { owners, teams, loose, reports } = useMemo(() => {
    const ids = new Set(staff.map((person) => person.id));
    const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
    const map = new Map();
    for (const person of [...staff].sort(byName)) if (person.managerId && ids.has(person.managerId)) map.set(person.managerId, [...(map.get(person.managerId) ?? []), person]);
    const roots = staff.filter((person) => !person.managerId || !ids.has(person.managerId));
    return {
      reports: map,
      owners: roots.filter((person) => person.roleId === 'owner').sort(byName),
      teams: roots.filter((person) => person.roleId !== 'owner' && map.has(person.id)).sort(byName),
      loose: roots.filter((person) => person.roleId !== 'owner' && !map.has(person.id)).sort(byName),
    };
  }, [staff]);
  if (!staff.length) return <div className={`adm-panel ${styles.empty}`}>No staff yet.</div>;
  const tree = (people) => <ul className={styles.tree}>{people.map((person) => <Branch key={person.id} person={person} reports={reports} onOpen={onOpen} />)}</ul>;
  return <div className={`adm-panel ${styles.chart}`}>
    {owners.length > 0 && <section aria-labelledby="org-owners" className={styles.section}>
      <h3 id="org-owners">Owners</h3>
      <div className={styles.scroller}>{tree(owners)}</div>
    </section>}
    {teams.length > 0 && <section aria-labelledby="org-teams" className={styles.section}>
      <h3 id="org-teams">Mentor teams <small>{teams.length}</small></h3>
      <div className={styles.teamRow}>{teams.map((lead) => <div key={lead.id} className={styles.team}><div className={styles.scroller}>{tree([lead])}</div></div>)}</div>
    </section>}
    {loose.length > 0 && <section aria-labelledby="org-loose" className={styles.section}>
      <h3 id="org-loose">No mentor <small>{loose.length}</small></h3>
      <ul className={styles.loose}>{loose.map((person) => <li key={person.id}><PersonCard person={person} onOpen={onOpen} /></li>)}</ul>
    </section>}
  </div>;
}
