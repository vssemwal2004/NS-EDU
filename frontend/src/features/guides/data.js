// Pure helpers shared by the guide pages. Guide copy, checklists, FAQs and tool cards are
// admin-edited content (key `guides`, loaded with lib/api/content.js).

export const slugify = (text) => String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const hostname = (href) => { try { return new URL(href).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const plural = (count, word, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
