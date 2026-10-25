// The AISHE-derived directory publishes a clean institution-type vocabulary. Deriving our own
// type / category / ownership from it beats keyword-matching the free-text management column,
// which classified every Delhi University constituent college as a "central university" and every
// state private university as a "state university".
//
// Used by the importer (src/scripts/import-directory.js) and by the re-derivation in
// src/scripts/curate-institutions.js, so both always agree.

// directory.institutionType -> { type, category }
const TYPES = {
  'affiliated college': { type: 'college', category: 'affiliated-college' },
  'autonomous college': { type: 'college', category: 'autonomous-college' },
  // A constituent college belongs to a university; it is not itself one.
  'constituent / university college': { type: 'college', category: 'affiliated-college' },
  'central university': { type: 'university', category: 'central-university' },
  'central open university': { type: 'university', category: 'central-university' },
  'state public university': { type: 'university', category: 'state-university' },
  'state open university': { type: 'university', category: 'state-university' },
  'state private university': { type: 'university', category: 'private-university' },
  'state private open university': { type: 'university', category: 'private-university' },
  'deemed university-government': { type: 'university', category: 'deemed-university' },
  'deemed university-government aided': { type: 'university', category: 'deemed-university' },
  'deemed university-private': { type: 'university', category: 'deemed-university' },
  'institute of national importance': { type: 'institute', category: 'institute-of-national-importance' },
  'institute under state legislature act': { type: 'institute', category: 'standalone-institution' },
  'institutes under ministries': { type: 'institute', category: 'standalone-institution' },
  'pgdm institutes': { type: 'institute', category: 'standalone-institution' },
  'recognized center': { type: 'college', category: 'other' },
  'pg center / off-campus center': { type: 'college', category: 'other' },
};

// directory.managementLabel -> ownership. "(derived from institution type)" markers are the
// source's own wording for a value it inferred rather than recorded; they still state which it is.
const OWNERSHIP = [
  [/private\s*un-?aided/, 'private'],
  [/aided/, 'public-private'],
  [/^private/, 'private'],
  [/government|^public|local body/, 'public'],
  [/^university$/, 'public'],
];

// Falls back to the pre-existing keyword rules when the source row has no institution type.
function guess(institutionType, management) {
  const text = `${institutionType} ${management}`.toLowerCase();
  if (text.includes('national importance')) return { type: 'institute', category: 'institute-of-national-importance' };
  if (text.includes('deemed')) return { type: 'university', category: 'deemed-university' };
  if (text.includes('univ')) return { type: 'university', category: text.includes('central') ? 'central-university' : text.includes('private') ? 'private-university' : 'state-university' };
  if (text.includes('standalone') || text.includes('institute')) return { type: 'institute', category: 'standalone-institution' };
  if (text.includes('autonomous')) return { type: 'college', category: 'autonomous-college' };
  if (text.includes('affiliated') || text.includes('constituent')) return { type: 'college', category: 'affiliated-college' };
  return { type: 'college', category: 'other' };
}

export function classify(institutionType, managementLabel) {
  const key = String(institutionType ?? '').trim().toLowerCase();
  const management = String(managementLabel ?? '').trim().toLowerCase();
  const { type, category } = TYPES[key] ?? guess(key, management);
  const ownership = OWNERSHIP.find(([pattern]) => pattern.test(management))?.[1] ?? 'unknown';
  return { type, category, ownership };
}
