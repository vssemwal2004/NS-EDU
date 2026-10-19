import AdminLogin from '@/features/admin/AdminLogin';

export const metadata = { title: { absolute: 'Admin sign in | Gyaan Vidhya' } };

// Only same-area paths are accepted as a post-login destination (prevents open redirects).
const safeNext = (value) => typeof value === 'string' && /^\/admin\/[\w\-/]*$/.test(value) ? value : '/admin/dashboard';

export default async function AdminLoginPage({ searchParams }) {
  const { next } = await searchParams;
  return <AdminLogin next={safeNext(next)} />;
}
