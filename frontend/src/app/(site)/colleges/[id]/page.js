import { permanentRedirect } from 'next/navigation';

// College profiles moved to the university directory; old links keep working.
export default async function CollegeProfileRedirect({ params }) {
  const { id } = await params;
  permanentRedirect(`/universities/${encodeURIComponent(decodeURIComponent(id))}`);
}
