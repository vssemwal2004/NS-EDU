import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import Icon from '@/components/ui/Icon';
import LoginDrawer from '@/features/auth/LoginDrawer';
import { getCatalog } from '@/lib/api/catalog';
import { getSharedContent } from '@/lib/api/content';
import { CatalogProvider } from '@/providers/CatalogProvider';
import { ContentProvider } from '@/providers/ContentProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { QuickApplyProvider } from '@/providers/QuickApplyProvider';
import { StudentAuthProvider } from '@/providers/StudentAuthProvider';
import { TrackingProvider } from '@/providers/TrackingProvider';
import styles from './layout.module.css';

export default async function SiteLayout({ children }) {
  const [catalog, content] = await Promise.all([getCatalog(), getSharedContent()]);
  // No bundled fallbacks: if the API is down, sections render empty states and this notice explains why.
  const unavailable = !catalog.live || Object.values(content).includes(null);
  return <CatalogProvider catalog={catalog}>
    <ContentProvider content={content}>
      <PreferencesProvider>
        <StudentAuthProvider>
          <QuickApplyProvider>
            <TrackingProvider>
              <Header />
              {children}
              <SiteFooter />
              <LoginDrawer />
              {unavailable && <p className={styles.notice} role="status"><Icon name="coursesInfo" />Some information is temporarily unavailable. Please refresh in a moment.</p>}
            </TrackingProvider>
          </QuickApplyProvider>
        </StudentAuthProvider>
      </PreferencesProvider>
    </ContentProvider>
  </CatalogProvider>;
}
