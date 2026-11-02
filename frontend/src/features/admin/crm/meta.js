// One place for how CRM concepts look: label, colour tone (see crm-tokens.css) and icon.
// Every chip pairs its colour with an icon or word so nothing relies on colour alone.

export const STAGES = {
  new: { label: 'New', tone: 'info', icon: 'inbox' },
  contacted: { label: 'Contacted', tone: 'purple', icon: 'phone' },
  'in-progress': { label: 'In progress', tone: 'warn', icon: 'trend' },
  'applied-to-university': { label: 'Applied', tone: 'teal', icon: 'document' },
  admitted: { label: 'Admitted', tone: 'good', icon: 'check' },
  'not-interested': { label: 'Not interested', tone: 'neutral', icon: 'close' },
  closed: { label: 'Closed', tone: 'neutral', icon: 'lock' },
};
export const STAGE_ORDER = ['new', 'contacted', 'in-progress', 'applied-to-university', 'admitted', 'not-interested', 'closed'];
export const OPEN_STAGES = ['new', 'contacted', 'in-progress', 'applied-to-university'];

export const HEATS = {
  hot: { label: 'Hot', tone: 'bad', icon: 'flame', hint: 'Very likely to convert. Call today.' },
  warm: { label: 'Warm', tone: 'warn', icon: 'thermo', hint: 'Interested. Keep the follow-ups on time.' },
  cold: { label: 'Cold', tone: 'info', icon: 'snow', hint: 'Low engagement. Try a different channel.' },
};
export const HEAT_ORDER = ['hot', 'warm', 'cold'];

export const PRIORITIES = {
  urgent: { label: 'Urgent', tone: 'bad', icon: 'alert' },
  high: { label: 'High', tone: 'orange', icon: 'arrowUp' },
  normal: { label: 'Normal', tone: 'neutral', icon: null },
  low: { label: 'Low', tone: 'info', icon: null },
};
export const PRIORITY_ORDER = ['urgent', 'high', 'normal', 'low'];

export const ACTIVITY = {
  call: { label: 'Call', icon: 'phone', tone: 'purple' },
  whatsapp: { label: 'WhatsApp', icon: 'chat', tone: 'good' },
  email: { label: 'Email', icon: 'mail', tone: 'info' },
  meeting: { label: 'Meeting', icon: 'people', tone: 'teal' },
  visit: { label: 'Campus visit', icon: 'building', tone: 'orange' },
  note: { label: 'Note', icon: 'note', tone: 'neutral' },
};
export const OUTCOMES = {
  connected: { label: 'Connected', tone: 'good' },
  interested: { label: 'Interested', tone: 'good' },
  'callback-requested': { label: 'Asked for a callback', tone: 'warn' },
  'no-answer': { label: 'No answer', tone: 'neutral' },
  busy: { label: 'Busy', tone: 'neutral' },
  'wrong-number': { label: 'Wrong number', tone: 'bad' },
  'not-interested': { label: 'Not interested', tone: 'bad' },
};
export const TASK_KINDS = {
  call: 'Call', whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', visit: 'Campus visit', document: 'Collect documents', other: 'Other',
};

// Role colours chosen on the access screen map onto the same tones.
export const ROLE_TONES = { wine: 'wine', blue: 'info', green: 'good', amber: 'warn', red: 'bad', purple: 'purple', teal: 'teal', slate: 'neutral' };

export const CHANNELS = {
  'web-apply': { label: 'Website apply', tone: 'wine' },
  'school-drive': { label: 'School drive', tone: 'teal' },
  callback: { label: 'Counsellor callback', tone: 'purple' },
  manual: { label: 'Added by staff', tone: 'orange' },
};

/** Client-side permission check; the server is the real gate, this only hides what would be refused. */
export const can = (admin, key) => Boolean(admin?.isOwner || admin?.permissions?.includes(key));
export const canAny = (admin, keys) => keys.some((key) => can(admin, key));
