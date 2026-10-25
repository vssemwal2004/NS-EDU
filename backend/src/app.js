import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { accessLog, apiRateLimit, requestId, securityHeaders } from './middleware/http.js';
import { env } from './config/env.js';
import { HttpError } from './lib/http-error.js';
import { healthRouter } from './routes/health.js';
import { educationNewsRouter } from './routes/education-news.js';
import { catalogRouter, platformRouter } from './modules/catalog/catalog.routes.js';
import { studentAuthRouter } from './modules/student-auth/student-auth.routes.js';
import { adminAuthRouter } from './modules/admin-auth/admin-auth.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { universitiesRouter } from './modules/universities/universities.routes.js';
import { applicationsRouter } from './modules/applications/applications.routes.js';
import { contentRouter } from './modules/content/content.routes.js';
import { insightsRouter } from './modules/insights/insights.routes.js';
import { consentRouter } from './modules/consent/consent.routes.js';

const isDatabaseUnavailable = (error) => /^Mongo(ServerSelection|Network|NotConnected|Topology)/.test(error?.name ?? '')
  || error?.message?.startsWith('Set MONGODB_URI');

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);
app.use(requestId, accessLog, securityHeaders);
app.use(compression({ threshold: 1024 }));
app.use(apiRateLimit);
// JSON bodies are capped at 100 kB; bulk imports post raw text with their own limit (data-ops routes).
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api/health', healthRouter);
app.use('/api/education-news', educationNewsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/platform', platformRouter);
app.use('/api/content', contentRouter);
app.use('/api/universities', universitiesRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/consent', consentRouter);
app.use('/api/auth', studentAuthRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin', adminRouter);
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, request, response, _next) => {
  if (error instanceof HttpError) {
    const { retryAfterSeconds } = error.details;
    if (retryAfterSeconds) response.set('Retry-After', String(retryAfterSeconds));
    return response.status(error.status).json({ error: error.message, ...error.details });
  }
  if (error.type === 'entity.too.large') return response.status(413).json({ error: 'Request body is too large' });
  if (error.status === 400) return response.status(400).json({ error: 'Invalid request body' });
  if (isDatabaseUnavailable(error)) {
    console.error('Database unavailable:', error.message);
    return response.status(503).json({ error: 'Service temporarily unavailable. Please try again shortly.' });
  }
  console.error(`Request ${request.id} ${request.method} ${request.path} failed:`, env.isProduction ? error.message : error);
  response.status(500).json({ error: 'Internal server error', requestId: request.id });
});
