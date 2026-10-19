import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { env, requireJwtSecret } from '../../config/env.js';
import { sendOtpEmail } from '../../lib/mailer.js';
import { isEmail } from '../../lib/validation.js';

export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_SECONDS = 30;
export const OTP_MAX_ATTEMPTS = 5;
export const CHANNELS = ['email', 'phone'];

export function normalizeIdentifier(channel, raw) {
  if (typeof raw !== 'string' || raw.length > 320) return { error: channel === 'phone' ? 'Enter a valid 10-digit mobile number' : 'Enter a valid email address' };
  if (channel === 'email') {
    const email = raw.trim().toLowerCase();
    return isEmail(email) ? { value: email } : { error: 'Enter a valid email address' };
  }
  const digits = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(raw.trim().replace(/[\s-]/g, ''))?.[1];
  return digits ? { value: `+91${digits}` } : { error: 'Enter a valid 10-digit Indian mobile number' };
}

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashCode = (channel, identifier, code) => createHmac('sha256', requireJwtSecret())
  .update(`${channel}:${identifier}:${code}`).digest('hex');

export function codeMatches(storedHash, channel, identifier, code) {
  const expected = Buffer.from(String(storedHash ?? ''), 'hex');
  const actual = Buffer.from(hashCode(channel, identifier, code), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function maskIdentifier(channel, identifier) {
  if (channel === 'phone') return `${identifier.slice(0, 3)}******${identifier.slice(-4)}`;
  const [local, domain] = identifier.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

// Phone sign-in exists only once an SMS provider is configured (SMS_PROVIDER); none is wired yet.
export const phoneEnabled = () => Boolean(env.smsProvider);
export const enabledChannels = () => (phoneEnabled() ? ['email', 'phone'] : ['email']);
const deliveryOf = (channel) => (channel === 'phone' ? env.smsProvider : env.otpDelivery);

export const exposesDevCode = (channel = 'email') => !env.isProduction && deliveryOf(channel) === 'console';

// Single delivery seam: email goes through SMTP (or the dev console); plug an SMS provider in here.
export async function deliverOtp({ channel, identifier, code }) {
  const delivery = deliveryOf(channel);
  if (delivery === 'console') {
    console.log(`[OTP] ${channel} ${maskIdentifier(channel, identifier)} code=${code}`);
    return { delivery };
  }
  if (channel === 'email' && delivery === 'smtp') {
    const { messageId } = await sendOtpEmail({ to: identifier, code, ttlMinutes: OTP_TTL_SECONDS / 60 });
    console.log(`[OTP] email sent to ${maskIdentifier(channel, identifier)} messageId=${messageId}`);
    return { delivery, messageId };
  }
  throw new Error(`OTP delivery "${delivery || 'none'}" is not configured for ${channel}.`);
}
