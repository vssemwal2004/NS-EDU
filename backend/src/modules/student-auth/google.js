import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { env, requireJwtSecret } from '../../config/env.js';
import { isEmail } from '../../lib/validation.js';

// "Continue with Google" as a server-side authorization-code flow with PKCE: the browser only ever
// navigates (no Google script on our pages, so the CSP stays as it is) and the id_token is checked
// here against Google's published keys.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const FLOW_AUDIENCE = 'nsedu-google-flow';
const TIMEOUT_MS = 8000;

export const FLOW_COOKIE = 'nsedu_oauth';
export const FLOW_COOKIE_PATH = '/api/auth/google';
export const FLOW_SECONDS = 10 * 60;

// Tests run a fake Google on localhost; every other environment talks to Google itself.
const endpoint = (name, fallback) => (process.env.NODE_ENV === 'test' && process.env[name]) || fallback;

export const googleEnabled = () => Boolean(env.google.clientId && env.google.clientSecret);
export const googleRedirectUri = () => `${env.publicSiteUrl}/api/auth/google/callback`;

// `code` is what the site shows (/login?error=<code>); the message is for the server log only.
export class GoogleError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'GoogleError';
    this.code = code;
  }
}

const random = (bytes) => randomBytes(bytes).toString('base64url');
const flowKey = () => new TextEncoder().encode(requireJwtSecret());

/** The Google URL to send the browser to, plus the signed cookie that remembers this attempt. */
export async function beginGoogleFlow({ returnTo, studentId = null }) {
  const flow = { state: random(24), nonce: random(24), verifier: random(48), returnTo, studentId };
  const cookie = await new SignJWT(flow).setProtectedHeader({ alg: 'HS256' })
    .setAudience(FLOW_AUDIENCE).setIssuedAt().setExpirationTime(`${FLOW_SECONDS}s`).sign(flowKey());
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return { url: url.toString(), cookie };
}

export async function readGoogleFlow(token) {
  if (typeof token !== 'string' || !token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, flowKey(), { algorithms: ['HS256'], audience: FLOW_AUDIENCE });
    return typeof payload.state === 'string' && typeof payload.verifier === 'string' ? payload : null;
  } catch {
    return null;
  }
}

const keySets = new Map();
function googleKeys() {
  const url = endpoint('GOOGLE_JWKS_URL', JWKS_URL);
  if (!keySets.has(url)) keySets.set(url, createRemoteJWKSet(new URL(url), { timeoutDuration: TIMEOUT_MS }));
  return keySets.get(url);
}

const cleanName = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 80) : '');
const cleanPicture = (value) => (typeof value === 'string' && value.length <= 1000 && /^https:\/\/[^\s"'<>]+$/.test(value) ? value : '');

/** Exchanges the authorization code and returns the verified Google identity. */
export async function completeGoogleFlow({ code, flow }) {
  let response;
  try {
    response = await fetch(endpoint('GOOGLE_TOKEN_URL', TOKEN_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        code, client_id: env.google.clientId, client_secret: env.google.clientSecret,
        redirect_uri: googleRedirectUri(), grant_type: 'authorization_code', code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new GoogleError('google-unavailable', `token request failed: ${error?.name}`);
  }
  const tokens = await response.json().catch(() => null);
  if (!response.ok || typeof tokens?.id_token !== 'string') {
    throw new GoogleError('google-unavailable', `token endpoint answered ${response.status} ${typeof tokens?.error === 'string' ? tokens.error : ''}`.trim());
  }
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(tokens.id_token, googleKeys(), { issuer: ISSUERS, audience: env.google.clientId, algorithms: ['RS256'] }));
  } catch (error) {
    throw new GoogleError('google-unavailable', `id_token rejected: ${error?.code ?? error?.name}`);
  }
  if (claims.nonce !== flow.nonce) throw new GoogleError('state', 'id_token nonce does not match');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw new GoogleError('google-unavailable', 'id_token has no subject');
  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!isEmail(email) || !(claims.email_verified === true || claims.email_verified === 'true')) throw new GoogleError('email-unverified');
  return { sub: claims.sub, email, name: cleanName(claims.name), picture: cleanPicture(claims.picture) };
}
