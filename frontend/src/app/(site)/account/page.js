import RecommendedUniversities from '@/features/recommendations/RecommendedUniversities';
import AccountView from '@/features/site/AccountView';
import { getContent } from '@/lib/api/content';
import { requireStudentSession } from '@/lib/api/session';
import { ContentProvider } from '@/providers/ContentProvider';
import styles from './account.module.css';

export const metadata = { title: 'My account | Gyaan Vidhya', robots: { index: false, follow: false } };

export default async function AccountPage() {
  // `news` holds the topic list that a saved story is validated against; without it nothing saved shows.
  const [student, content] = await Promise.all([requireStudentSession('/account'), getContent(['news'])]);
  return <main id="main" tabIndex={-1} className={styles.page}>
    <ContentProvider content={content}>
      <AccountView initialStudent={student} />
    </ContentProvider>
    <div className={`lux-container ${styles.recommended}`}>
      <RecommendedUniversities limit={6} />
    </div>
  </main>;
}
