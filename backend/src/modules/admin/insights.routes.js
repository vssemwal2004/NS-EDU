import { Router } from 'express';
import { createTtlCache } from '../../lib/ttl-cache.js';
import { EVENT_TYPES, RETENTION_DAYS } from '../insights/events.js';
import { insightsOverview, searchReport, studentActivity, viewedReport, windowDays } from '../insights/analytics.js';
import { consentReport } from '../consent/consent.js';

// Mounted behind the `analytics.search` permission.
export const adminInsightsRouter = Router();

// The overview and the consent report aggregate the whole window; one result per window is shared for a minute.
const reports = createTtlCache({ ttlMs: 60_000, maxEntries: 20 });

adminInsightsRouter.get('/overview', async (request, response) => {
  const days = windowDays(request.query.days);
  response.json(await reports.wrap(`overview|${days}`, async () => ({
    ...await insightsOverview({ days }),
    retentionDays: RETENTION_DAYS,
    eventTypes: EVENT_TYPES,
    notice: 'Collected to improve search results and university recommendations. No IP addresses, user agents or full URLs are stored.',
    generatedAt: new Date().toISOString(),
  })));
});
adminInsightsRouter.get('/consent', async (request, response) => {
  const days = [7, 30, 90].includes(Number(request.query.days)) ? Number(request.query.days) : 30;
  response.json(await reports.wrap(`consent|${days}`, async () => ({ ...await consentReport({ days }), generatedAt: new Date().toISOString() })));
});
adminInsightsRouter.get('/searches', async (request, response) => response.json(await searchReport(request.query)));
adminInsightsRouter.get('/institutions', async (request, response) => response.json(await viewedReport(request.query)));
adminInsightsRouter.get('/students/:id', async (request, response) => response.json(await studentActivity(request.params.id, request.query)));
