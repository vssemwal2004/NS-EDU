import PageIntro from '@/components/layout/PageIntro';
import GuidePage from '@/features/guides/GuidePage';
import { ResourceCards } from '@/features/guides/GuideBlocks';
import { guides } from '@/features/guides/data';
import { toolGuides } from '@/data/landing';
import { sitePages } from '@/data/site-pages';
import { getCatalog } from '@/lib/api/catalog';

const page = sitePages.scholarships;
export const metadata = { title: `${page.title} | NSEDU`, description: page.description };

export default async function ScholarshipsPage() {
  const { scholarships } = await getCatalog();
  // Funding links come from the managed scholarship list rather than the static page copy.
  const sections = page.sections.map((section) => section.links?.some((link) => link.href.startsWith('https:'))
    ? { ...section, links: undefined, toc: 'Funding resources', content: <ResourceCards items={scholarships} /> }
    : section);
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Scholarships" icon="cap" title="Scholarships" accent="& funding" description={`${page.description} Check the conditions, prepare documents early and plan without counting an award until it is confirmed.`}
      stats={[{ value: scholarships.length, label: 'Funding portals linked' }, { value: guides.scholarships.checklist.items.length, label: 'Checklist steps' }]}
      statsNote="Amounts and deadlines are set by each provider."
      related={[{ href: '/budget', icon: 'wallet', label: 'Budget check' }, { href: '/admission-checklist', icon: 'guidesChecklist', label: 'Admission checklist' }, { href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }]} />
    <GuidePage guide="scholarships" sections={sections} note={toolGuides.scholarships.note} />
  </main>;
}
