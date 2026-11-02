/* global navigator */
// Small helpers for the Call / WhatsApp / Copy actions used by the board, My day and the bin.
export const telHref = (phone = '') => (phone ? `tel:${String(phone).replace(/[^\d+]/g, '')}` : '');
export const whatsappHref = (phone = '') => {
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
