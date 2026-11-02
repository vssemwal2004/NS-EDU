import { Suspense } from 'react';
import DrivesManager from '@/features/admin/drives/DrivesManager';

export const metadata = { title: 'School drives' };

// The list reads `?add=1` (the shell's New menu) in the client, so it renders inside Suspense.
export default function DrivesPage() {
  return <Suspense><DrivesManager /></Suspense>;
}
