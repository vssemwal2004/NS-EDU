/* global navigator */
// Small helpers for the Call / WhatsApp / Copy actions used by the board, My day and the bin.
//
// Phone and email are masked by the API ("+91 98XXXXXX10", "a***@gmail.com") on leads not assigned to the viewer
// (see backend contact-mask.js); anonymised leads carry "anon-…". Neither can be called, messaged or copied: the
// helpers below return '' / false for them, and Lead 360 offers "Reveal" instead.
export const isMaskedContact = (value) => typeof value === 'string' && (/X{2,}|^anon-/.test(value) || value.includes('***'));
/** A real, dialable number (digits, spaces, dashes, brackets and a leading +). */
export const isDialable = (phone) => typeof phone === 'string' && !isMaskedContact(phone) && /^\+?[\d\s()-]{6,}$/.test(phone.trim());
export const telHref = (phone = '') => (isDialable(phone) ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : '');
export const whatsappHref = (phone = '') => {
  if (!isDialable(phone)) return '';
  const digits = String(phone).replace(/\D/g, '');
  // Indian mobile numbers stored without a country code get +91.
  return digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : '';
};
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch { return false; }
  }
}
