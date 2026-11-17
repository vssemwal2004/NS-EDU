import { getContent } from '@/lib/api/content';
import { getReviewHighlights, getReviewSummary } from '@/lib/api/reviews';
import { ContentProvider } from '@/providers/ContentProvider';
import HomeSections from './HomeSections';

// Server entry for `/`: loads the homepage's admin-edited content and the student-review strip once,
// then renders the client sections.
export default async function HomePage() {
  const [content, summary, highlights] = await Promise.all([
    getContent(['landing', 'explorer', 'eligibility', 'budget', 'news']),
    getReviewSummary(),
    getReviewHighlights(24),
  ]);
  const reviews = summary && highlights ? { summary, items: highlights.items } : null;
  return <ContentProvider content={content}><HomeSections reviews={reviews} /></ContentProvider>;
}
