'use client';
import { useRouter } from 'next/navigation';
import { useStudentAuth } from '@/providers/StudentAuthProvider';
import OtpLoginForm from './OtpLoginForm';

// Copy by destination, so a student sent here from a gated page knows why.
function copyFor(next) {
  if (next.startsWith('/apply')) return { title: 'Log in to apply', lead: 'Verify your email once and your application form opens next.' };
  if (next.startsWith('/compare')) return { title: 'Log in to compare', lead: 'Comparisons use the full university directory, open to signed-in students.' };
  if (next.startsWith('/account')) return { title: 'Your student space', lead: 'Log in to see your applications and saved preferences.' };
  return { title: 'Log in to Gyaan Vidhya', lead: 'The university directory, fee listings, comparisons and applications are open to signed-in students. It takes one email code.' };
}

/** /login form: verifies, then replaces the history entry with `next` (already validated on the server). */
export default function LoginScreen({ next }) {
  const router = useRouter();
  const { signIn } = useStudentAuth();
  const copy = copyFor(next);
  return <OtpLoginForm headingLevel="h1" title={copy.title} lead={copy.lead} autoFocus={false} doneText="Taking you there now…"
    onSuccess={(student) => { signIn(student); router.replace(next); }} />;
}
