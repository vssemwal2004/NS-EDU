import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Load backend/.env regardless of the working directory (e.g. `node server.js` from src/).
// Only missing keys are filled: values already in the environment always win, which keeps
// test overrides such as a throwaway MONGODB_DATABASE intact.
const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const port = Number(process.env.PORT ?? 4100);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const trustProxy = process.env.TRUST_PROXY ?? 'loopback';

export const env = {
  port,
  mongodbUri: process.env.MONGODB_URI,
  mongodbDatabase: process.env.MONGODB_DATABASE ?? 'nsedu',
  jwtSecret: process.env.JWT_SECRET,
  adminEmail: process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined,
  adminPassword: process.env.ADMIN_PASSWORD || undefined,
  adminName: process.env.ADMIN_NAME?.trim() || 'NSEDU Admin',
  otpDelivery: process.env.OTP_DELIVERY ?? 'console',
  isProduction: process.env.NODE_ENV === 'production',
  trustProxy: trustProxy === 'false' ? false : trustProxy === 'true' ? true : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
};

export function requireJwtSecret() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error('Set JWT_SECRET (at least 32 characters) before using authentication.');
  }
  return env.jwtSecret;
}
