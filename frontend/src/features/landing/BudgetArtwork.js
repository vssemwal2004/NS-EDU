'use client';
import Image from 'next/image';
import { optimisable } from '@/lib/hero-image';
import { useContent } from '@/providers/ContentProvider';

export function BudgetDesk({ className }) {
  const desk = useContent('media')?.budgetDesk;
  if (!desk?.src) return null;
  return <Image className={className} src={desk.src} width={400} height={Math.round((400 * desk.height) / desk.width)} unoptimized={!optimisable(desk.src)} sizes="(max-width: 760px) 62px, 100px" loading="lazy" alt="" aria-hidden="true" />;
}
