import Image from 'next/image';

export function BudgetDesk({ className }) {
  return <Image className={className} src="/images/budget/desk.webp" width={400} height={400} sizes="(max-width: 760px) 62px, 100px" loading="lazy" alt="" aria-hidden="true" />;
}
