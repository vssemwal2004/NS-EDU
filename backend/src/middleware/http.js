import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { createRateLimiter } from '../lib/rate-limit.js';

// Request id: reuse a proxy's X-Request-Id when it looks sane, otherwise mint one; echoed back for support.
export function requestId(request, response, next) {
  const incoming = request.get('x-request-id');
  request.id = incoming && /^[\w.-]{8,100}$/.test(incoming) ? incoming : randomUUID();
  response.set('X-Request-Id', request.id);
  next();
}

// One line per request: JSON in production (for log aggregation), compact text in development.
// Query strings are dropped so search terms and tokens never reach the logs.
export function accessLog(request, response, next) {
  if (process.env.NODE_ENV === 'test') return next();
  const started = process.hrtime.bigint();
  response.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const path = request.originalUrl.split('?')[0];
    if (path.startsWith('/api/health') && response.statusCode < 400) return;
    const entry = { at: new Date().toISOString(), id: request.id, method: request.method, path, status: response.statusCode, ms: Math.round(ms) };
    if (env.isProduction) console.log(JSON.stringify(entry));
    else if (ms > 300 || response.statusCode >= 500) console.log(`${entry.method} ${entry.path} ${entry.status} ${entry.ms}ms${ms > 300 ? ' (slow)' : ''}`);
  });
  next();
}

// API responses are JSON only, so a strict policy costs nothing: no sniffing, framing or scripts.
export function securityHeaders(_request, response, next) {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    ...(env.isProduction && { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' }),
  });
  next();
}

// Coarse per-IP ceiling for every API call (route-specific limits stay stricter). In-memory, so
// with several API instances put the same limit on the load balancer or move it to Redis.
const apiLimiter = createRateLimiter({ windowMs: 60_000, max: Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 600 });
// School drive QR forms get their own, higher bucket: a whole school hall can share one Wi-Fi
// address, and /api/forms has per-form and per-IP submit limits of its own.
const formsLimiter = createRateLimiter({ windowMs: 60_000, max: Number(process.env.FORMS_RATE_LIMIT_PER_MINUTE) || 3000 });
export function apiRateLimit(request, _response, next) {
  if (request.path === '/api/health' || request.path === '/api/health/ready') return next();
  const limiter = request.path.startsWith('/api/forms/') ? formsLimiter : apiLimiter;
  const { allowed, retryAfterSeconds } = limiter.hit(request.ip);
  if (!allowed) throw new HttpError(429, 'Too many requests. Please wait a moment and try again.', { retryAfterSeconds });
  next();
}
