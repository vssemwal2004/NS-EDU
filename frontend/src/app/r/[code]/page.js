import RegistrationPage from '@/features/registration/RegistrationPage';
import { loadRegistrationForm } from '@/features/registration/load-form';

// Every view needs a fresh form token, so this page is always rendered on request.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const result = await loadRegistrationForm((await params).code);
  const school = result.form?.school?.name ?? result.school?.name;
  return { title: school ? `Register — ${school} | Gyaan Vidhya` : 'Student registration | Gyaan Vidhya', robots: { index: false, follow: false } };
}

export default async function RegistrationRoute({ params }) {
  const { code } = await params;
  return <RegistrationPage code={code.toLowerCase()} result={await loadRegistrationForm(code)} />;
}
