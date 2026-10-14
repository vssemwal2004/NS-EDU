import express from 'express';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { HttpError } from './lib/http-error.js';
import { healthRouter } from './routes/health.js';
import { educationNewsRouter } from './routes/education-news.js';
import { catalogRouter, platformRouter } from './modules/catalog/catalog.routes.js';
import { studentAuthRouter } from './modules/student-auth/student-auth.routes.js';
import { adminAuthRouter } from './modules/admin-auth/admin-auth.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';

const isDatabaseUnavailable = (error) => /^Mongo(ServerSelection|Network|NotConnected|Topology)/.test(error?.name ?? '')
  || error?.message?.startsWith('Set MONGODB_URI');

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxy);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api/health', healthRouter);
app.use('/api/education-news', educationNewsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/platform', platformRouter);
app.use('/api/auth', studentAuthRouter);
app.use('/api/admin/auth', adminAuthRouter);
app.use('/api/admin', adminRouter);
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
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
  console.error('Request failed:', error.message);
  response.status(500).json({ error: 'Internal server error' });
});
