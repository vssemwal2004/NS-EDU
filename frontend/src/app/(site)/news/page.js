import NewsDesk from '@/features/newsroom/NewsDesk';
import { loadEducationFeed, mastheadDate } from '@/features/newsroom/news-feed';
import { getContent } from '@/lib/api/content';
import styles from '@/features/newsroom/NewsDesk.module.css';

export const metadata = { title: 'Education news & articles | Gyaan Vidhya', description: 'Dated education updates from Indian publishers, with links to the original stories.' };

export default async function NewsPage() {
  const { news: config } = await getContent(['news']);
  const feed = await loadEducationFeed(config);
  return <main id="main" tabIndex={-1}>
    {config ? <NewsDesk config={config} initialFeed={feed} today={mastheadDate()} />
      : <div className={`lux-state ${styles.empty}`} role="status"><h1 className="lux-display-3">Education news</h1><p>Education updates are temporarily unavailable. Please refresh in a moment.</p></div>}
  </main>;
}
