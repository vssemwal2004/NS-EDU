'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { dateTimeOf, timeOf } from '@/features/admin/crm/format';
import { Panel } from '@/features/admin/ui/Page';
import styles from './MyDay.module.css';

const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short' });
const fullDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const rangeEnd = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dateKey = (date) => date.toDateString();

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export default function WeekAgenda({ now, today, upcoming, onTask, busy }) {
  const [offset, setOffset] = useState(0);
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const groups = new Map();
  for (const [section, tasks] of [['today', today], ['upcoming', upcoming]]) {
    for (const task of tasks) {
      const key = dateKey(new Date(task.dueAt));
      const entries = groups.get(key) ?? [];
      entries.push({ task, section });
      groups.set(key, entries);
    }
  }
  const start = addDays(monday, offset * 7);
  const after = addDays(start, 7);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const hasLater = upcoming.some((task) => new Date(task.dueAt) >= after);
  const hasEvents = days.some((date) => groups.has(dateKey(date)));

  return <Panel className={styles.agenda} title="Weekly agenda" meta={`${rangeEnd.format(start)} – ${rangeEnd.format(days[6])}`}
    actions={<div className={styles.weekActions}>
      {offset > 0 && <button type="button" className="adm-btn adm-btn--sm" onClick={() => setOffset(0)}>This week</button>}
      <button type="button" className="adm-btn adm-btn--icon adm-btn--sm" aria-label="Previous week" title="Previous week" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>
        <Icon name="chevron" className={styles.previous} />
      </button>
      <button type="button" className="adm-btn adm-btn--icon adm-btn--sm" aria-label="Next week" title="Next week" disabled={!hasLater} onClick={() => setOffset(offset + 1)}>
        <Icon name="chevron" className={styles.next} />
      </button>
    </div>}>
    <ul className={styles.week} aria-label="Scheduled follow-ups this week" aria-busy={busy || undefined}>
      {days.map((date) => {
        const key = dateKey(date);
        const items = groups.get(key) ?? [];
        const current = dateKey(now) === key;
        return <li className={styles.day} key={key} data-today={current || undefined}>
          <div className={styles.dayHead} aria-label={fullDate.format(date)} aria-current={current ? 'date' : undefined}>
            <span>{weekday.format(date)}</span><strong>{date.getDate()}</strong>
          </div>
          <ul className={styles.events}>
            {items.slice(0, 2).map(({ task, section }) => <li key={task.id}>
              <button type="button" className={styles.event} title={`${task.title} · ${dateTimeOf(task.dueAt)}`} onClick={() => onTask(section, task.id)}>
                <span>{timeOf(task.dueAt)}</span><strong>{task.title}</strong>
              </button>
            </li>)}
          </ul>
          {items.length > 2 && <button type="button" className={styles.moreEvents} onClick={() => onTask(items[2].section, items[2].task.id)}>+{items.length - 2} more</button>}
        </li>;
      })}
    </ul>
    {!hasEvents && <p className={styles.weekNote}>No scheduled follow-ups loaded for this week.</p>}
  </Panel>;
}
