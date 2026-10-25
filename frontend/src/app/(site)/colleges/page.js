import { redirect } from 'next/navigation';

// The fee ledger listed a curated sample of 11 institutions — a demonstration catalogue from before
// the directory existed. Students reading "11 institutions" next to a directory of 9,861 had no way
// to tell the two apart, so this page now hands its filters to the real directory. Profile links
// already redirect the same way (see colleges/[id]/page.js).
const text = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim().slice(0, 120);

export default async function CollegesRedirect({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  // The ledger's course ids are the directory's course slugs. Its "location" was a free-text place,
  // which the directory matches through its search index rather than an exact city facet.
  if (text(params.course)) query.set('course', text(params.course));
  const place = text(params.location) || text(params.q);
  if (place) query.set('q', place);
  const target = query.toString();
  redirect(target ? `/universities?${target}` : '/universities');
}
