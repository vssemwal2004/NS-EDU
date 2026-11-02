import '@/features/admin/crm/crm-tokens.css';
import AdminShell from '@/features/admin/AdminShell';

export default function AdminPanelLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
