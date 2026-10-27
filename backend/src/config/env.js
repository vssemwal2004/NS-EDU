import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Load backend/.env and backend/.env.local regardless of the working directory (e.g. `node
// server.js` from src/, or a test helper that imports these modules without node's --env-file).
// Precedence matches the --env-file-if-exists chain in package.json: the real environment wins
// over .env.local, which wins over .env. That keeps throwaway test overrides such as
// MONGODB_DATABASE intact, and stops an entry point without --env-file silently reaching for the
// hosted database when .env.local points at the local one.
for (const name of ['.env.local', '.env']) {
  const file = new URL(`../../${name}`, import.meta.url);
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const port = Number(process.env.PORT ?? 4100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const trustProxy = process.env.TRUST_PROXY ?? 'loopback';
function positiveInt(raw, fallback) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
const smtpPort = Number(process.env.SMTP_PORT || 587);

export const env = {
  port,
  host: process.env.HOST || '127.0.0.1',
  mongodbUri: process.env.MONGODB_URI,
  mongodbDatabase: process.env.MONGODB_DATABASE ?? 'nsedu',
  jwtSecret: process.env.JWT_SECRET,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined,
  adminPassword: process.env.ADMIN_PASSWORD || undefined,
  adminName: process.env.ADMIN_NAME?.trim() || 'Gyaan Vidhya Admin',
  // 'smtp' emails codes; 'console' prints them (development). Unset: smtp when SMTP_HOST is configured.
  otpDelivery: process.env.OTP_DELIVERY?.trim() || (process.env.SMTP_HOST ? 'smtp' : 'console'),
  // Phone sign-in stays hidden until an SMS provider exists: 'msg91' texts the code through a
  // DLT-approved template; 'console' prints SMS codes (development only).
  smsProvider: process.env.SMS_PROVIDER?.trim() || '',
  msg91: {
    authKey: process.env.MSG91_AUTH_KEY?.trim() || '',
    templateId: process.env.MSG91_TEMPLATE_ID?.trim() || '',
    otpVar: process.env.MSG91_OTP_VAR?.trim() || 'otp',
  },
  // Per-process ceiling on phone codes per IST day, so a bot cannot burn the SMS credit.
  smsDailyCap: positiveInt(process.env.SMS_DAILY_CAP, 2000),
  // "Continue with Google" appears only when both are set (Google Cloud OAuth "Web application" client).
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim() || '',
    port: Number.isInteger(smtpPort) && smtpPort > 0 ? smtpPort : 587,
    user: process.env.SMTP_USER?.trim() || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || '',
  },
  // Public origin of the website (QR codes, OAuth redirects, email links), without a trailing slash.
  publicSiteUrl: (process.env.PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, ''),
  isProduction: process.env.NODE_ENV === 'production',
  trustProxy: trustProxy === 'false' ? false : trustProxy === 'true' ? true : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
};

// Fail fast in production instead of starting a half-working API.
export function assertProductionConfig() {
  if (!env.isProduction) return;
  const problems = [];
  if (!env.mongodbUri) problems.push('MONGODB_URI is required');
  if (!env.jwtSecret || env.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  const consoleAllowed = process.env.ALLOW_CONSOLE_OTP === 'true';
  if (!['console', 'smtp'].includes(env.otpDelivery)) problems.push('OTP_DELIVERY must be "smtp" or "console"');
  if (env.otpDelivery === 'console' && !consoleAllowed) problems.push('OTP_DELIVERY=console prints login codes to the log; set OTP_DELIVERY=smtp with SMTP_* settings');
  if (env.otpDelivery === 'smtp' && !(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.from)) problems.push('OTP_DELIVERY=smtp needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM');
  if (env.smsProvider === 'console' && !consoleAllowed) problems.push('SMS_PROVIDER=console prints login codes to the log; unset it to hide phone sign-in');
  else if (env.smsProvider === 'msg91' && !(env.msg91.authKey && env.msg91.templateId)) problems.push('SMS_PROVIDER=msg91 needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID (a DLT-approved OTP template)');
  else if (env.smsProvider && !['console', 'msg91'].includes(env.smsProvider)) problems.push(`SMS_PROVIDER "${env.smsProvider}" is not supported (use "msg91", or unset it to hide phone sign-in)`);
  if (Boolean(env.google.clientId) !== Boolean(env.google.clientSecret)) problems.push('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither (hides "Continue with Google")');
  if (!process.env.PUBLIC_SITE_URL?.startsWith('https://')) problems.push('PUBLIC_SITE_URL must be the https:// address of the website (used in QR codes and sign-in redirects)');
  if (problems.length) throw new Error(`Refusing to start in production:\n - ${problems.join('\n - ')}`);
}

export function requireJwtSecret() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error('Set JWT_SECRET (at least 32 characters) before using authentication.');
  }
  return env.jwtSecret;
}
