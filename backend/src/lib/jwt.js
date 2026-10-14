import jwt from 'jsonwebtoken';
import { requireJwtSecret } from '../config/env.js';

const ISSUER = 'nsedu-api';
const audience = (role) => `nsedu-${role}`;

export function signSession(subject, role, expiresIn) {
  return jwt.sign({ role }, requireJwtSecret(), { algorithm: 'HS256', subject, issuer: ISSUER, audience: audience(role), expiresIn });
}

// Returns the payload only when the token is valid for exactly this role.
export function verifySession(token, role) {
  if (typeof token !== 'string' || !token || token.length > 2048) return null;
  try {
    const payload = jwt.verify(token, requireJwtSecret(), { algorithms: ['HS256'], issuer: ISSUER, audience: audience(role) });
    return payload.role === role && typeof payload.sub === 'string' ? payload : null;
  } catch (error) {
    if (error.message?.startsWith('Set JWT_SECRET')) throw error;
    return null;
  }
}
