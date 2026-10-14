import AccountView from '@/features/site/AccountView';

export const metadata = { title: 'My account | NSEDU', robots: { index: false, follow: false } };

// The greeting depends on the client-side session, so AccountView renders its own hero.
export default function AccountPage() {
  return <main id="main" tabIndex={-1}>
    <AccountView />
  </main>;
}
