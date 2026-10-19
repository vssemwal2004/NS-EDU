import { getContent } from '@/lib/api/content';
import { ContentProvider } from '@/providers/ContentProvider';
import HomeSections from './HomeSections';

// Server entry for `/`: loads the homepage's admin-edited content once, then renders the client sections.
export default async function HomePage() {
  const content = await getContent(['landing', 'explorer', 'eligibility', 'budget', 'news']);
  return <ContentProvider content={content}><HomeSections /></ContentProvider>;
}
