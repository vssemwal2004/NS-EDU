import RecommendedUniversities from '@/features/recommendations/RecommendedUniversities';
import AccountView from '@/features/site/AccountView';
import { requireStudentSession } from '@/lib/api/session';
import styles from './account.module.css';

export const metadata = { title: 'My account | Gyaan Vidhya', robots: { index: false, follow: false } };

export default async function AccountPage() {
  const student = await requireStudentSession('/account');
  return <main id="main" tabIndex={-1} className={styles.page}>
    <AccountView initialStudent={student} />
    <div className={`lux-container ${styles.recommended}`}>
      <RecommendedUniversities limit={6} />
    </div>
  </main>;
}
