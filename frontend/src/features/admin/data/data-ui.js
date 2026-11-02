'use client';
// Status marks shared by the data-pipeline screens (colour + word, never colour alone). In tables a status is a
// dot and a word; only a failed job gets a pill, because it is the one state that needs someone to act.
import { Chip } from '../crm/ui';
import { StatusDot } from '../catalogue/CatalogueParts';

export const JOB_STATUS = {
  queued: ['info', 'Queued', 'clock'], running: ['purple', 'Running', 'refresh'], done: ['good', 'Done', 'check'],
  failed: ['bad', 'Failed', 'alert'], skipped: ['warn', 'Skipped', 'ban'], cancelled: ['neutral', 'Cancelled', 'close'],
};
export const JOB_ORDER = ['queued', 'running', 'done', 'failed', 'skipped', 'cancelled'];
export const SOURCE_STATUS = { active: ['good', 'Active'], paused: ['neutral', 'Paused'], blocked: ['bad', 'Blocked'] };

export function JobChip({ status, pill = status === 'failed' }) {
  const [tone, label, icon] = JOB_STATUS[status] ?? ['neutral', status, null];
  return pill ? <Chip size="sm" tone={tone} icon={icon}>{label}</Chip> : <StatusDot tone={tone}>{label}</StatusDot>;
}

export function SourceChip({ status }) {
  const [tone, label] = SOURCE_STATUS[status] ?? ['neutral', status];
  return <StatusDot tone={tone}>{label}</StatusDot>;
}
