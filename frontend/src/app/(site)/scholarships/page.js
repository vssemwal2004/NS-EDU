import PageIntro from '@/components/layout/PageIntro';
import GuidePage, { GuideUnavailable } from '@/features/guides/GuidePage';
import { ResourceCards } from '@/features/guides/GuideBlocks';
import { getCatalog } from '@/lib/api/catalog';
import { getContent } from '@/lib/api/content';

const SLUG = 'scholarships';
const loadGuide = async () => (await getContent(['guides'])).guides;

export async function generateMetadata() {
  const page = (await loadGuide())?.guides[SLUG]?.page;
  return page ? { title: `${page.title} | Gyaan Vidhya`, description: page.description } : { title: 'Scholarships & funding | Gyaan Vidhya' };
}

export default async function ScholarshipsPage() {
  const [{ scholarships }, guides] = await Promise.all([getCatalog(), loadGuide()]);
  const guide = guides?.guides[SLUG];
  // Funding links come from the managed scholarship list rather than the page copy.
  const sections = guide?.page.sections.map((section) => section.links?.some((link) => link.href.startsWith('https:'))
    ? { ...section, links: undefined, toc: 'Funding resources', content: <ResourceCards items={scholarships} /> }
    : section);
  return <main id="main" tabIndex={-1}>
    <PageIntro eyebrow="Scholarships" icon="cap" title="Scholarships" accent="& funding" description={`${guide?.page.description ?? ''} Check the conditions, prepare documents early and plan without counting an award until it is confirmed.`.trim()}
      stats={[{ value: scholarships.length, label: 'Funding portals linked' }, ...(guide ? [{ value: guide.checklist.items.length, label: 'Checklist steps' }] : [])]}
      statsNote="Amounts and deadlines are set by each provider."
      related={[{ href: '/budget', icon: 'wallet', label: 'Budget check' }, { href: '/admission-checklist', icon: 'guidesChecklist', label: 'Admission checklist' }, { href: '/eligibility', icon: 'eligibility', label: 'Check eligibility' }]} />
    {guide ? <GuidePage guide={SLUG} content={guides} sections={sections} /> : <GuideUnavailable />}
  </main>;
}
