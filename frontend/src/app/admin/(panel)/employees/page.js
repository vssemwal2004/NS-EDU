import { redirect } from 'next/navigation';

// Employee creation lives in the Employees screen.
export default function EmployeesPage() {
  redirect('/admin/access');
}
