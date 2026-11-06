import { foldText } from '../universities/normalize.js';

/**
 * In-memory search over a few tens of thousands of short records (institutions, courses, exams,
 * places). Pure: no database access, so it is unit-tested directly and rebuilt by search-store.js.
 *
 * Why in memory: each typeahead keystroke used to be a MongoDB round trip (60–120 ms to Atlas)
 * and a relevance sort over every matching document (which overflowed the 32 MB sort limit for a
 * query like "college"). The whole public directory's searchable text is a few MB, so it is held
 * here and a query is answered in about a millisecond.
 *
 * Structures
 *  - vocabulary: Map word → word id (a hash table: O(1) exact lookups)
 *  - postings:   per word id, the records containing it and in which field (name, alias, place…)
 *  - sorted:     every word in sorted order, so a typed prefix ("petro") is one binary search
 *                followed by a scan of the words that start with it
 *  - trigrams:   Map trigram → word ids, the candidate set for typo correction ("petrolium" →
 *                "petroleum", "grafic" → "graphic"), confirmed with a bounded edit distance
 *  - acronyms:   Map acronym → record ids ("upes", "iitb", "du"), so short forms rank first
 */

export const FIELD = Object.freeze({ PLACE: 0, NAME: 1, ALIAS: 2, ACRONYM: 3 });
const FIELD_WEIGHT = [0.45, 1, 1, 0.95];
const STOP_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'de', 'an', 'to']);
const MAX_QUERY_TERMS = 6;
const MAX_WORD = 32;

// ---------------------------------------------------------------------------------------------
// Tokenising

/**
 * Words of a text, with initials joined: "B.Tech" → "btech", "U.P.E.S." / "u p e s" → "upes",
 * "A.P.J. Abdul Kalam" → "apj abdul kalam". `pieces` are the words before joining, so an index can
 * hold both forms and a query can fall back to the plain words.
 */
export function tokenize(value) {
  const raw = foldText(value).split(' ').filter(Boolean);
  const terms = [];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i].length === 1 && /[a-z]/.test(raw[i])) {
      let end = i;
      while (end + 1 < raw.length && raw[end + 1].length === 1 && /[a-z]/.test(raw[end + 1])) end += 1;
      const run = raw.slice(i, end + 1);
      const next = raw[end + 1];
      // A lone initial glued to a short word is a degree ("b tech", "m sc", "b com"); a longer run is an acronym.
      if (run.length === 1 && next && next.length <= 5 && /^[a-z]+$/.test(next)) {
        terms.push({ text: `${run[0]}${next}`, pieces: [next] });
        i = end + 1;
      } else if (run.length >= 2) {
        terms.push({ text: run.join(''), pieces: [] });
        i = end;
      } else {
        i = end;
      }
      continue;
    }
    if (raw[i].length >= 2 && !STOP_WORDS.has(raw[i])) terms.push({ text: raw[i].slice(0, MAX_WORD), pieces: [] });
  }
  return terms;
}

const indexWords = (value) => [...new Set(tokenize(value).flatMap((term) => [term.text, ...term.pieces]))];

// First letters of the significant words: "University of Petroleum and Energy Studies" → "upes".
const initialsOf = (value) => tokenize(value).filter((term) => !/^\d+$/.test(term.text)).map((term) => term.text[0]).join('');

/**
 * Short forms a student may type for an institution name. "Graphic Era University, Dehradun" gives
 * "geud" and "geu"; "University of Delhi" also gives "du" (the "<Place> University" reading);
 * a bracketed qualifier such as "(Deemed to be University)" is ignored.
 */
export function acronymsOf(name) {
  const plain = String(name ?? '').replace(/\([^)]*\)/g, ' ');
  const head = plain.split(/[,–—-]/)[0];
  const forms = new Set([initialsOf(plain), initialsOf(head)]);
  const reversed = /^\s*university of (.+)$/i.exec(head);
  if (reversed) forms.add(`${initialsOf(reversed[1])}u`);
  return [...forms].filter((form) => form.length >= 2 && form.length <= 10);
}

// ---------------------------------------------------------------------------------------------
// Edit distance (optimal string alignment: insert, delete, substitute, swap two neighbours),
// abandoned as soon as it must exceed `max`.

export function editDistance(a, b, max = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous2 = null;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (previous2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, previous2[j - 2] + 1);
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous2 = previous;
    previous = current;
  }
  return previous[b.length];
}

/**
 * A sound-alike key for the spellings Indian students commonly swap when typing names:
 * "grafic"/"graphic", "vidhya"/"vidya", "shri"/"sri", "univercity"/"university", "kerela"/"kerala"
 * stay apart in edit distance but share (or nearly share) this key.
 */
export function phoneticOf(word) {
  return word
    .replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/q/g, 'k').replace(/x/g, 'ks').replace(/w/g, 'v').replace(/z/g, 'j')
    .replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
    .replace(/([bdgkt])h/g, '$1').replace(/sh/g, 's')
    .replace(/ee|ea|ie/g, 'i').replace(/oo|ou/g, 'u').replace(/y$/g, 'i')
    .replace(/([a-z])\1+/g, '$1');
}

// How many typos a word of this length may carry. Short words must be exact: "mit" is not "iit".
const allowedEdits = (length) => (length < 4 ? 0 : length < 7 ? 1 : 2);

const trigramsOf = (word) => {
  const padded = `^${word}$`;
  const grams = new Set();
  for (let i = 0; i + 3 <= padded.length; i += 1) grams.add(padded.slice(i, i + 3));
  return [...grams];
};

// ---------------------------------------------------------------------------------------------
// Building

/**
 * @param {Array<{ texts: Array<{ text: string, field: number }>, acronyms?: string[], boost?: number }>} records
 *   `boost` (0..~20) is a popularity score added to relevance; everything else on a record is
 *   carried through untouched for the caller.
 */
export function buildSearchIndex(records) {
  const vocabulary = new Map();
  const words = [];
  const postings = []; // per word id: Map recordId → best field
  const acronyms = new Map();

  const wordId = (word) => {
    let id = vocabulary.get(word);
    if (id === undefined) {
      id = words.length;
      vocabulary.set(word, id);
      words.push(word);
      postings.push(new Map());
    }
    return id;
  };
  const post = (word, recordId, field) => {
    const list = postings[wordId(word)];
    const current = list.get(recordId);
    if (current === undefined || FIELD_WEIGHT[field] > FIELD_WEIGHT[current]) list.set(recordId, field);
  };

  records.forEach((record, recordId) => {
    for (const { text, field } of record.texts) {
      if (!text) continue;
      for (const word of indexWords(text)) post(word, recordId, field);
      // The name typed without spaces ("graphicera", "btech") is one more way to find it.
      if (field !== FIELD.PLACE) {
        const compact = foldText(text).replace(/ /g, '');
        if (compact.length >= 3 && compact.length <= MAX_WORD) post(compact, recordId, FIELD.ALIAS);
      }
    }
    for (const acronym of record.acronyms ?? []) {
      post(acronym, recordId, FIELD.ACRONYM);
      acronyms.set(acronym, [...(acronyms.get(acronym) ?? []), recordId]);
    }
  });

  const sorted = words.map((word, id) => [word, id]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const trigrams = new Map();
  const phonetic = new Map();
  const sounds = words.map(phoneticOf);
  words.forEach((word, id) => {
    if (word.length < 4) return;
    for (const gram of trigramsOf(word)) {
      const list = trigrams.get(gram);
      if (list) list.push(id); else trigrams.set(gram, [id]);
    }
    const list = phonetic.get(sounds[id]);
    if (list) list.push(id); else phonetic.set(sounds[id], [id]);
  });
  return { records, vocabulary, words, postings, sorted, sortedWords: sorted.map(([word]) => word), trigrams, phonetic, sounds, acronyms, prefixCache: new Map() };
}

// ---------------------------------------------------------------------------------------------
// Matching one query term

const PREFIX_CACHE_MAX = 2000;

function lowerBound(list, value) {
  let low = 0;
  let high = list.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (list[middle] < value) low = middle + 1; else high = middle;
  }
  return low;
}

// Records whose words start with `prefix` → Map recordId → score (0..1). Exact word beats prefix.
function prefixMatches(index, prefix) {
  const cached = index.prefixCache.get(prefix);
  if (cached) return cached;
  const scores = new Map();
  for (let i = lowerBound(index.sortedWords, prefix); i < index.sorted.length; i += 1) {
    const [word, id] = index.sorted[i];
    if (!word.startsWith(prefix)) break;
    const closeness = word === prefix ? 1 : 0.7 + 0.25 * (prefix.length / word.length);
    for (const [recordId, field] of index.postings[id]) {
      const score = FIELD_WEIGHT[field] * closeness;
      if (score > (scores.get(recordId) ?? 0)) scores.set(recordId, score);
    }
  }
  if (index.prefixCache.size >= PREFIX_CACHE_MAX) index.prefixCache.delete(index.prefixCache.keys().next().value);
  index.prefixCache.set(prefix, scores);
  return scores;
}

// Indexed words within the allowed number of typos of `term`, either as a whole word or as the
// start of a longer one (the student is still typing: "petrolim" → "petroleum").
function fuzzyWords(index, term) {
  const max = allowedEdits(term.length);
  if (!max) return [];
  const grams = trigramsOf(term);
  const shared = new Map();
  for (const gram of grams) for (const id of index.trigrams.get(gram) ?? []) shared.set(id, (shared.get(id) ?? 0) + 1);
  // A word that sounds the same counts as one typo, even when it is spelt quite differently.
  const sound = phoneticOf(term);
  for (const id of index.phonetic.get(sound) ?? []) if (!shared.has(id)) shared.set(id, grams.length);
  const needed = Math.max(1, grams.length - 3 * max);
  const found = [];
  for (const [id, count] of shared) {
    if (count < needed) continue;
    const word = index.words[id];
    let distance = editDistance(term, word, max);
    let partial = false;
    if (distance > max && word.length > term.length) {
      distance = Math.min(...[term.length - 1, term.length, term.length + 1].map((size) => editDistance(term, word.slice(0, size), max)));
      partial = true;
    }
    if (distance > 1) {
      const soundDistance = editDistance(sound, index.sounds[id], max);
      if (soundDistance < max) { distance = Math.max(1, soundDistance + 1); partial = false; }
    }
    if (distance <= max) found.push({ id, word, distance, partial, frequency: index.postings[id].size });
  }
  return found.sort((a, b) => a.distance - b.distance || b.frequency - a.frequency).slice(0, 12);
}

function fuzzyMatches(index, term) {
  const scores = new Map();
  const candidates = fuzzyWords(index, term);
  for (const { id, distance, partial } of candidates) {
    const closeness = (distance === 1 ? 0.62 : 0.48) * (partial ? 0.9 : 1);
    for (const [recordId, field] of index.postings[id]) {
      const score = FIELD_WEIGHT[field] * closeness;
      if (score > (scores.get(recordId) ?? 0)) scores.set(recordId, score);
    }
  }
  return { scores, correction: candidates[0]?.word ?? null };
}

// ---------------------------------------------------------------------------------------------
// Searching

function intersect(maps) {
  if (!maps.length) return new Map();
  const ordered = [...maps].sort((a, b) => a.size - b.size);
  const out = new Map();
  for (const [recordId, score] of ordered[0]) {
    let total = score;
    let everywhere = true;
    for (let i = 1; i < ordered.length; i += 1) {
      const other = ordered[i].get(recordId);
      if (other === undefined) { everywhere = false; break; }
      total += other;
    }
    if (everywhere) out.set(recordId, total);
  }
  return out;
}

/**
 * Parses a query into terms. A joined initial ("b tech" → "btech") keeps its plain word as a
 * fallback in case nothing is indexed under the joined form.
 */
export function queryTerms(query) {
  return tokenize(String(query ?? '').slice(0, 120)).slice(0, MAX_QUERY_TERMS);
}

/**
 * @param {ReturnType<typeof buildSearchIndex>} index
 * @param {string} query
 * @param {{ filter?: (record) => boolean, rank?: (record, base: number, context) => number }} [options]
 * @returns {{ hits: Array<{ recordId: number, record: object, score: number, fuzzy: boolean, acronym: string }>,
 *   corrected: string, mode: 'exact'|'fuzzy'|'partial'|'none' }}
 *   `corrected` is the query as it was understood when a typo was fixed ("" otherwise).
 */
export function search(index, query, { filter, rank } = {}) {
  const terms = queryTerms(query);
  if (!terms.length) return { hits: [], corrected: '', mode: 'none' };
  const folded = foldText(query);
  const compact = folded.replace(/ /g, '');

  // Pass 1: every term as a prefix (a joined initial falls back to its plain word).
  const exact = terms.map((term) => {
    const direct = prefixMatches(index, term.text);
    if (direct.size || !term.pieces.length) return { term, scores: direct, word: term.text, fuzzy: false };
    const fallback = intersect(term.pieces.map((piece) => prefixMatches(index, piece)));
    return { term, scores: fallback, word: term.pieces.join(' '), fuzzy: false };
  });
  let matched = exact;
  let found = intersect(matched.map((item) => item.scores));
  let mode = 'exact';

  // Pass 2: correct typos in the terms that need it (no matches, or no common record with the rest).
  if (!found.size) {
    matched = exact.map((item) => {
      if (item.term.text.length < 4) return item;
      const { scores, correction } = fuzzyMatches(index, item.term.text);
      if (!scores.size) return item;
      if (!item.scores.size) return { term: item.term, scores, word: correction ?? item.word, fuzzy: true };
      // Both readings stay possible ("delhi" the word and "delhi" mistyped); the better score wins per record.
      const merged = new Map(item.scores);
      for (const [recordId, score] of scores) if (score > (merged.get(recordId) ?? 0)) merged.set(recordId, score);
      return { term: item.term, scores: merged, word: item.word, fuzzy: false };
    });
    found = intersect(matched.map((item) => item.scores));
    mode = 'fuzzy';
  }

  // Pass 3: drop words that match nothing at all, but only while a distinctive word remains —
  // "graphic era xyz" still finds Graphic Era, while "xyz university" does not list every university.
  if (!found.size && matched.length > 1) {
    const total = index.records.length || 1;
    const useful = matched.filter((item) => item.scores.size);
    const distinctive = useful.some((item) => item.scores.size <= Math.max(3, total * 0.05));
    if (useful.length && useful.length < matched.length && distinctive) {
      matched = useful;
      found = intersect(matched.map((item) => item.scores));
      mode = 'partial';
    }
  }
  if (!found.size) return { hits: [], corrected: '', mode: 'none' };

  const hits = [];
  for (const [recordId, base] of found) {
    const record = index.records[recordId];
    if (filter && !filter(record)) continue;
    const acronym = (record.acronyms ?? []).find((form) => form === compact) ?? '';
    const context = { folded, compact, acronym, termCount: matched.length };
    const score = rank ? rank(record, base, context) : base;
    hits.push({ recordId, record, score, fuzzy: mode !== 'exact', acronym });
  }
  hits.sort((a, b) => b.score - a.score || a.recordId - b.recordId);
  const fixed = matched.some((item) => item.fuzzy) || mode === 'partial';
  return { hits, corrected: fixed ? matched.map((item) => item.word).join(' ') : '', mode };
}

/**
 * The usual relevance on top of the term scores: an exact name or short form first, then names that
 * start with the query, then popularity. Shared by every record kind (they all carry `nameKey`).
 */
export function defaultRank(record, base, { folded, compact, acronym, termCount }) {
  const name = record.nameKey ?? '';
  let score = (base / termCount) * 40;
  if (name === folded || record.shortKey === compact) score += 60;
  else if (acronym) score += 50;
  else if (name.startsWith(folded)) score += 25;
  else if (folded && name.includes(folded)) score += 10;
  return score + (record.boost ?? 0);
}
