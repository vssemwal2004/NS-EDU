// Pure helpers shared by the guide pages (and imported elsewhere: keep slugify, hostname, plural). Guide copy,
// checklists, FAQs and tool cards are admin-edited content (key `guides`, loaded with lib/api/content.js).

export const slugify = (text) => String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const hostname = (href) => { try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;

export const isExternal = (href = '') => href.startsWith('https:');
export const pad = (index) => String(index + 1).padStart(2, '0');
export const withIds = (sections = []) => sections.map((section) => ({ ...section, id: section.id || slugify(section.title) }));

export const loadGuides = async (getContent) => (await getContent(['guides'])).guides;
export const guideMetadata = (guides, slug, fallback) => {
  const page = guides?.guides[slug]?.page;
  return page ? { title: `${page.title} | Gyaan Vidhya`, description: page.description } : { title: `${fallback} | Gyaan Vidhya` };
};
