import { Router } from 'express';
import { EVENT_TYPES, RETENTION_DAYS } from '../insights/events.js';
import { insightsOverview, searchReport, studentActivity, viewedReport } from '../insights/analytics.js';

// Mounted after requireOwnerAdmin: administrators only, never employees.
export const adminInsightsRouter = Router();

adminInsightsRouter.get('/overview', async (request, response) => response.json({
  ...await insightsOverview(request.query),
  retentionDays: RETENTION_DAYS,
  eventTypes: EVENT_TYPES,
  notice: 'Collected to improve search results and university recommendations. No IP addresses, user agents or full URLs are stored.',
}));
adminInsightsRouter.get('/searches', async (request, response) => response.json(await searchReport(request.query)));
adminInsightsRouter.get('/institutions', async (request, response) => response.json(await viewedReport(request.query)));
adminInsightsRouter.get('/students/:id', async (request, response) => response.json(await studentActivity(request.params.id, request.query)));
