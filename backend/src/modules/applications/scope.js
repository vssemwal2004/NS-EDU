// How much of the lead base a staff member sees: 'all' | 'team' | 'own' | 'none'.
// Loaded staff carry `leadScope` from their role (see modules/access). A bare staff object without it
// (scripts, tests, older callers) falls back to the original two roles: administrators see all, anyone else their own.
export const leadScopeOf = (staff) => staff?.leadScope ?? (staff?.role === 'admin' ? 'all' : 'own');
export const isOwnerStaff = (staff) => staff?.isOwner ?? staff?.role === 'admin';
