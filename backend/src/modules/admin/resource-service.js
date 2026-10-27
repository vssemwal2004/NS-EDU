import { collection, COLLECTIONS, toObjectId } from '../../db/collections.js';
import { HttpError } from '../../lib/http-error.js';
import { pagination, queryString } from '../../lib/query.js';
import { assertValid, escapeRegex } from '../../lib/validation.js';
import { invalidateCareerCache } from '../career/career-service.js';
import { invalidateCatalogCache } from '../catalog/catalog-service.js';
import { queryKeys } from '../universities/normalize.js';
import { invalidateUniversityCaches } from '../universities/university-service.js';
import { generateSlug, resources } from './resources.js';

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

// Public catalogue and university reads are cached in memory; every admin write clears them.
export const invalidatePublicCaches = () => { invalidateCatalogCache(); invalidateUniversityCaches(); invalidateCareerCache(); };

// Derived search keys are internal; they never leave the API.
export const serializeItem = ({ _id, searchPrefixes: _keys, ...rest }) => ({ id: _id.toString(), ...rest });

export function getResource(name) {
  if (!Object.hasOwn(resources, name)) throw new HttpError(404, 'Unknown resource');
  return resources[name];
}

function sortSpec(resource, sort) {
  const title = resource.sortField ?? resource.titleField;
  const specs = {
    order: { order: 1, [title]: 1 },
    name: { [title]: 1 },
    '-name': { [title]: -1 },
    createdAt: { createdAt: 1 },
    '-createdAt': { createdAt: -1 },
    updatedAt: { updatedAt: 1 },
    '-updatedAt': { updatedAt: -1 },
  };
  return { ...(specs[sort] ?? specs.order), _id: 1 };
}

async function findExisting(resource, name, id) {
  const _id = toObjectId(id);
  const existing = _id && await (await collection(name)).findOne({ _id });
  if (!existing) throw new HttpError(404, `${capitalize(resource.singular)} not found`);
  return existing;
}

async function checkReferences(resource, data) {
  const errors = {};
  for (const field of resource.fields.filter((item) => item.type === 'reference' && data[item.name] !== undefined)) {
    const exists = await (await collection(field.ref)).countDocuments({ slug: data[field.name] }, { limit: 1 });
    if (!exists) errors[field.name] = `No ${resources[field.ref].singular} with this slug exists`;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: errors });
}

// Records that point at this one by slug: programmes (`referencedBy`) or the resource's own `references`.
async function countReferences(resource, slug) {
  const refs = resource.references ?? (resource.referencedBy ? [{ collection: COLLECTIONS.programmes, field: resource.referencedBy, noun: 'programme' }] : []);
  for (const ref of slug ? refs : []) {
    const count = await (await collection(ref.collection)).countDocuments({ [ref.field]: slug });
    if (count) return plural(count, ref.noun);
  }
  return '';
}

function conflict(resource, error) {
  if (error?.code !== 11000) return error;
  const field = Object.keys(error.keyValue ?? error.keyPattern ?? {})[0] ?? resource.uniqueField;
  const label = resource.fields.find((item) => item.name === field)?.label.toLowerCase() ?? field;
  return new HttpError(409, `A ${resource.singular} with this ${label} already exists`, { fields: { [field]: 'Already in use' } });
}

// Equality filters declared on the resource: an option list, 'boolean' or free 'string'.
function listFilter(resource, query) {
  const filter = {};
  for (const [key, kind] of Object.entries(resource.filters ?? {})) {
    const raw = queryString(query[key], 80);
    if (!raw) continue;
    if (kind === 'boolean') { if (raw === 'true' || raw === 'false') filter[key] = raw === 'true' ? { $ne: false } : false; }
    else if (Array.isArray(kind)) { if (kind.includes(raw)) filter[key] = raw; }
    else filter[key] = raw;
  }
  return filter;
}

function searchFilter(resource, q) {
  if (!q) return {};
  if (resource.searchMode === 'prefixes') {
    const keys = queryKeys(q);
    // Slugs and exact ids are matched too, so a pasted slug always finds its record.
    return keys.length ? { $or: [{ searchPrefixes: { $all: keys } }, { slug: q.toLowerCase() }] } : {};
  }
  return { $or: resource.searchFields.map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) };
}

export async function listItems(name, query) {
  const resource = getResource(name);
  const { page, limit, skip } = pagination(query);
  const q = queryString(query.q);
  const filter = { ...listFilter(resource, query), ...searchFilter(resource, q) };
  const items = await collection(name);
  const [docs, total] = await Promise.all([
    items.find(filter, { projection: resource.listProjection }).sort(sortSpec(resource, queryString(query.sort, 20))).skip(skip).limit(limit).toArray(),
    items.countDocuments(filter),
  ]);
  return { items: (resource.decorate ? await resource.decorate(docs) : docs).map(serializeItem), total, page, limit };
}

export async function getItem(name, id) {
  return serializeItem(await findExisting(getResource(name), name, id));
}

export async function createItem(name, body) {
  const resource = getResource(name);
  const data = assertValid(resource.fields, body);
  if (resource.slugFrom && !data.slug) {
    data.slug = generateSlug(resource, data);
    if (!data.slug) throw new HttpError(400, 'Please correct the highlighted fields.', { fields: { slug: 'Enter a slug' } });
  }
  await checkReferences(resource, data);
  const now = new Date();
  const doc = { ...data, ...resource.beforeWrite?.(data, null), createdAt: now, updatedAt: now };
  try {
    await (await collection(name)).insertOne(doc);
  } catch (error) { throw conflict(resource, error); }
  invalidatePublicCaches();
  return serializeItem(doc);
}

// Slugs of referenced records (institutions, courses) are frozen while programmes use them,
// so public programme ids and saved comparisons never silently change.
export async function updateItem(name, id, body) {
  const resource = getResource(name);
  const existing = await findExisting(resource, name, id);
  const data = assertValid(resource.fields, body, { partial: true });
  if (resource.slugFrom && Object.hasOwn(data, 'slug') && !data.slug) data.slug = generateSlug(resource, { ...existing, ...data }) || existing.slug;
  if (data.slug && data.slug !== existing.slug) {
    const users = await countReferences(resource, existing.slug);
    if (users) {
      const message = `This ${resource.singular} is used by ${users}, so its slug cannot be changed`;
      throw new HttpError(400, message, { fields: { slug: message } });
    }
  }
  await checkReferences(resource, data);
  if (!Object.keys(data).length) return serializeItem(existing);
  const changed = Object.keys(data).filter((key) => JSON.stringify(existing[key]) !== JSON.stringify(data[key]));
  const lock = (resource.lockOnEdit ?? []).filter((key) => changed.includes(key));
  const update = { $set: { ...data, ...resource.beforeWrite?.(data, existing), updatedAt: new Date() } };
  if (lock.length) update.$addToSet = { lockedFields: { $each: lock } };
  let updated;
  try {
    updated = await (await collection(name)).findOneAndUpdate({ _id: existing._id }, update, { returnDocument: 'after' });
  } catch (error) { throw conflict(resource, error); }
  if (!updated) throw new HttpError(404, `${capitalize(resource.singular)} not found`);
  invalidatePublicCaches();
  return serializeItem(updated);
}

export async function deleteItem(name, id) {
  const resource = getResource(name);
  const existing = await findExisting(resource, name, id);
  const users = await countReferences(resource, existing.slug);
  if (users) throw new HttpError(409, `Remove its ${users} first`);
  await (await collection(name)).deleteOne({ _id: existing._id });
  invalidatePublicCaches();
}
