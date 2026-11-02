'use client';
// Small visual building blocks shared by every CRM screen: chips, badges, avatars and meters.
import Icon from '@/components/ui/Icon';
import { CHANNELS, HEATS, PRIORITIES, ROLE_TONES, STAGES } from './meta';
import { followUpState, initialsOf } from './format';
import styles from './ui.module.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** The base pill. `tone` is one of the tones in crm-tokens.css. */
export function Chip({ tone = 'neutral', icon, children, solid = false, size = 'md', title, className }) {
  return <span className={cx('crm-tone', styles.chip, solid && styles.solid, size === 'sm' && styles.small, className)} data-tone={tone} title={title}>
    {icon && <Icon name={icon} />}{children}
  </span>;
}

/** Lead temperature. Shows the reason list as a tooltip so staff can see why a lead is hot. */
export function HeatChip({ heat, source, score, size = 'md' }) {
  const config = HEATS[heat];
  if (!config) return <Chip tone="neutral" size={size} title="Not scored yet">Not scored</Chip>;
  const title = `${config.label} lead${typeof score === 'number' ? ` · score ${score}/100` : ''}${source === 'manual' ? ' · set by hand' : ' · scored automatically'}. ${config.hint}`;
  return <Chip tone={config.tone} icon={config.icon} size={size} title={title}>{config.label}{source === 'manual' && <span className={styles.pin} aria-label="set by hand" title="Set by hand">●</span>}</Chip>;
}

export function PriorityChip({ priority, always = false, size = 'md' }) {
  const config = PRIORITIES[priority];
  if (!config || (priority === 'normal' && !always)) return null;
  return <Chip tone={config.tone} icon={config.icon} size={size}>{config.label}</Chip>;
}

export function StageChip({ status, size = 'md' }) {
  const config = STAGES[status] ?? { label: status, tone: 'neutral' };
  return <span className={cx('crm-tone', styles.stage, size === 'sm' && styles.small)} data-tone={config.tone}><span className={styles.dot} aria-hidden="true" />{config.label}</span>;
}

export function ChannelChip({ channel, size = 'sm' }) {
  const config = CHANNELS[channel] ?? { label: channel, tone: 'neutral' };
  return <Chip tone={config.tone} size={size}>{config.label}</Chip>;
}

/** When the next follow-up is due, coloured by urgency, with an icon so it is not colour only. */
export function FollowUpBadge({ at, compact = false }) {
  const info = followUpState(at);
  return <span className={cx('crm-tone', styles.followUp)} data-tone={info.tone} data-state={info.state} title={info.label}>
    <Icon name={info.state === 'overdue' ? 'alert' : info.state === 'none' ? 'calendar' : 'clock'} />{compact ? info.short : info.label}
  </span>;
}

const AVATAR_TONES = ['wine', 'info', 'good', 'warn', 'purple', 'teal', 'orange'];
const toneFor = (text) => AVATAR_TONES[[...String(text)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TONES.length];
export function Avatar({ name, email, size = 32 }) {
  const label = name || email || '?';
  return <span className={cx('crm-tone', styles.avatar)} data-tone={toneFor(email || name || '')} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.38) }} title={label} aria-hidden="true">{initialsOf(label)}</span>;
}

export function RoleBadge({ name, color = 'slate', size = 'md' }) {
  return <Chip tone={ROLE_TONES[color] ?? 'neutral'} size={size}>{name}</Chip>;
}

/** 0–100 score as a small bar. Green ≥ 65, amber ≥ 35, otherwise blue (matches Hot / Warm / Cold). */
export function ScoreMeter({ score }) {
  if (typeof score !== 'number') return <span className="crm-muted">—</span>;
  const tone = score >= 65 ? 'bad' : score >= 35 ? 'warn' : 'info';
  return <span className={cx('crm-tone', styles.meter)} data-tone={tone} role="img" aria-label={`Score ${score} out of 100`} title={`Score ${score}/100`}>
    <span className={styles.meterTrack}><span className={styles.meterFill} style={{ width: `${Math.max(4, score)}%` }} /></span>
    <span className={cx('crm-tabnum', styles.meterValue)}>{score}</span>
  </span>;
}

/** A coloured count for dashboards: "12" with a label, used inside cards and lists. */
export function CountPill({ tone = 'neutral', children }) {
  return <span className={cx('crm-tone', styles.count)} data-tone={tone}>{children}</span>;
}

export function EmptyNote({ icon = 'inbox', title, children }) {
  return <div className={styles.empty}><span className={styles.emptyIcon}><Icon name={icon} /></span><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
