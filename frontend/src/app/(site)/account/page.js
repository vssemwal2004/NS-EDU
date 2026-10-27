import RecommendedUniversities from '@/features/recommendations/RecommendedUniversities';
import AccountView from '@/features/site/AccountView';
import { getContent } from '@/lib/api/content';
import { requireStudentSession } from '@/lib/api/session';
import { ContentProvider } from '@/providers/ContentProvider';
import styles from './account.module.css';

export const metadata = { title: 'My account | Gyaan Vidhya', robots: { index: false, follow: false } };

const flag = (value) => (typeof value === 'string' ? value.slice(0, 40) : '');

export default async function AccountPage({ searchParams }) {
  // `news` holds the topic list that a saved story is validated against; without it nothing saved shows.
  const [student, content, params] = await Promise.all([requireStudentSession('/account'), getContent(['news']), searchParams]);
  // Set by the API after "Connect Google": ?linked=google or ?error=<code>.
  const authNotice = { linked: flag(params.linked), error: flag(params.error) };
  return <main id="main" tabIndex={-1} className={styles.page}>
    <ContentProvider content={content}>
      <AccountView initialStudent={student} authNotice={authNotice} />
    </ContentProvider>
    <div className={`lux-container ${styles.recommended}`}>
      <RecommendedUniversities limit={6} />
    </div>
  </main>;
}
