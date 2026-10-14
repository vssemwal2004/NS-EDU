import Header from '@/components/layout/Header';
import SiteFooter from '@/components/layout/SiteFooter';
import LoginDrawer from '@/features/auth/LoginDrawer';
import { getCatalog } from '@/lib/api/catalog';
import { CatalogProvider } from '@/providers/CatalogProvider';
import { PreferencesProvider } from '@/providers/PreferencesProvider';
import { StudentAuthProvider } from '@/providers/StudentAuthProvider';

export default async function SiteLayout({ children }) {
  const catalog = await getCatalog();
  return <CatalogProvider catalog={catalog}>
    <PreferencesProvider>
      <StudentAuthProvider>
        <Header />
        {children}
        <SiteFooter />
        <LoginDrawer />
      </StudentAuthProvider>
    </PreferencesProvider>
  </CatalogProvider>;
}
