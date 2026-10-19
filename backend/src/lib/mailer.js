import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const BRAND = 'Gyaan Vidhya';
const WINE = '#72243B';
const OXBLOOD = '#3D0F1E';
const BLUSH = '#F0CFC8';
const IVORY = '#FFFAF5';
const SAND = '#F4EBE3';
const INK = '#1F1418';
const MUTED = '#6B5A60';

let transport = null;

/** Lazily creates one pooled SMTP transport. Port 465 uses implicit TLS, anything else STARTTLS. */
export function smtpTransport() {
  if (transport) return transport;
  const { host, port, user, pass } = env.smtp;
  if (!host) throw new Error('SMTP_HOST is not set');
  transport = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: user ? { user, pass } : undefined,
    pool: true, maxConnections: 2,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
  });
  return transport;
}

// Tests swap in a jsonTransport/stub; null restores the SMTP transport.
export function setMailTransport(next) {
  transport = next;
}

const sender = () => {
  const from = env.smtp.from;
  if (!from) throw new Error('SMTP_FROM is not set');
  return from.includes('<') ? from : { name: BRAND, address: from };
};

/** Branded OTP email: inline CSS, no remote images, links or tracking. `code` is 6 digits. */
export function buildOtpEmail({ code, ttlMinutes = 5 }) {
  if (!/^\d{6}$/.test(String(code))) throw new Error('OTP code must be 6 digits');
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const subject = `${code} is your ${BRAND} sign-in code`;
  const text = [
    `${BRAND}`,
    '',
    'Your sign-in code is:',
    '',
    `    ${spaced}`,
    '',
    `This code expires in ${ttlMinutes} minutes and can be used once.`,
    'Never share it with anyone. Our team will never ask you for it.',
    '',
    "If you didn't request this, ignore this email. Nobody can sign in without the code.",
    '',
    `${BRAND} - university discovery and admissions guidance`,
  ].join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:${SAND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${SAND};">Your ${BRAND} code is ${code}. It expires in ${ttlMinutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SAND};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${IVORY};border-radius:16px;border:1px solid ${BLUSH};">
<tr><td style="padding:28px 32px 20px;border-bottom:3px solid ${WINE};">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;color:${WINE};letter-spacing:0.3px;">${BRAND}</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:${MUTED};letter-spacing:1.5px;text-transform:uppercase;padding-top:4px;">Sign-in verification</div>
</td></tr>
<tr><td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">
Use this code to sign in to your ${BRAND} account:
</td></tr>
<tr><td align="center" style="padding:12px 32px 20px;">
<div style="display:inline-block;background:${BLUSH};border-radius:12px;padding:16px 28px;font-family:'Courier New',Courier,monospace;font-size:36px;line-height:1;font-weight:700;letter-spacing:8px;color:${OXBLOOD};">${code}</div>
</td></tr>
<tr><td style="padding:0 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:${INK};">
This code expires in <strong>${ttlMinutes} minutes</strong> and can be used once. Never share it with anyone; our team will never ask you for it.
</td></tr>
<tr><td style="padding:12px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:${MUTED};">
If you didn't request this, ignore this email. Nobody can sign in without the code.
</td></tr>
<tr><td style="padding:16px 32px;background:${SAND};border-radius:0 0 16px 16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};">
${BRAND} &middot; University discovery and admissions guidance
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

/** Sends the OTP email and resolves with the provider's message id. Errors propagate to the caller. */
export async function sendOtpEmail({ to, code, ttlMinutes = 5 }) {
  const { subject, text, html } = buildOtpEmail({ code, ttlMinutes });
  const info = await smtpTransport().sendMail({
    from: sender(), to, subject, text, html,
    headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
  });
  if (info.rejected?.length) throw Object.assign(new Error('Recipient rejected'), { code: 'EENVELOPE' });
  return { messageId: info.messageId ?? '', accepted: info.accepted?.length ?? 0, message: info.message };
}

// Safe summary of a nodemailer error for logs: no credentials, addresses or server banners.
export const describeMailError = (error) => [error?.code, error?.responseCode, error?.command].filter(Boolean).join(' ') || error?.name || 'Error';
