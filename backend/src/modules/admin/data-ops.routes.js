import express, { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { queryString } from '../../lib/query.js';
import { isPlainObject } from '../../lib/validation.js';
import { csvRow } from '../../scraper/csv.js';
import { COURSE_TEMPLATE_COLUMNS, importCourses, relinkInstitutions, syncCatalogue } from '../catalog/course-catalogue.js';
import { cancelJobs, enqueueSources, listJobs, listRuns, queueStats, retryJobs } from '../../scraper/queue.js';
import { createSource, deleteSource, importSources, listSources, parseSeedList, updateSource } from '../../scraper/sources.js';
import {
  bulkUpdateInstitutions, dataOverview, importInstitutions, listReviewQueue, MAX_IMPORT_BYTES, streamInstitutionsCsv, TEMPLATE_COLUMNS,
} from './data-ops-service.js';

// Admin-only data operations: bulk import/export, review queue and the scraper queue.
// Crawling itself runs in the CLI worker (`npm run scrape -- work`), never inside a request.
export const dataOpsRouter = Router();

// Files are posted as raw text (Content-Type text/csv or text/plain, options in the query string),
// which the app-wide 100 kB JSON parser skips. Small JSON envelopes { format, content, ... } also work.
const fileBody = express.text({ type: ['text/*', 'application/csv'], limit: '6mb' });
function fileInput(request) {
  if (typeof request.body === 'string') return { ...request.query, content: request.body };
  if (isPlainObject(request.body) && typeof request.body.content === 'string') return request.body;
  throw new HttpError(400, 'Send the file as text/csv or text/plain, or as JSON { "format", "content" }.');
}
const formatOf = (input) => {
  const format = queryString(input.format, 10).toLowerCase();
  if (!['csv', 'json'].includes(format)) throw new HttpError(400, 'Choose CSV or JSON.', { fields: { format: 'Use csv or json' } });
  return format;
};

dataOpsRouter.get('/overview', async (_request, response) => response.json(await dataOverview()));

dataOpsRouter.get('/universities/template.csv', (_request, response) => {
  response.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="universities-template.csv"' });
  response.send(`﻿${csvRow(TEMPLATE_COLUMNS)}`);
});
dataOpsRouter.post('/universities/import', fileBody, async (request, response) => {
  const input = fileInput(request);
  if (Buffer.byteLength(input.content) > MAX_IMPORT_BYTES) throw new HttpError(413, 'Files are limited to 5 MB. Split the list and import it in parts.');
  response.json(await importInstitutions({ ...input, format: formatOf(input) }));
});
dataOpsRouter.post('/universities/bulk', async (request, response) => response.json(await bulkUpdateInstitutions(request.body, request.admin)));
dataOpsRouter.get('/universities/export.csv', async (request, response) => streamInstitutionsCsv(request.query, response));

// Course catalogue: bulk import, the full Indian degree list, and relinking institutions' programmes.
dataOpsRouter.get('/courses/template.csv', (_request, response) => {
  response.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="courses-template.csv"' });
  response.send(`﻿${csvRow(COURSE_TEMPLATE_COLUMNS)}${csvRow(['B.Sc Agriculture', 'bsc-agriculture', 'Bachelor of Science in Agriculture', 'Agriculture', 'UG', 'science', 'Undergraduate degree in agronomy and soil science.', 'B.Sc Ag; B.Sc (Hons) Agriculture', 'false', '200', 'true'])}`);
});
dataOpsRouter.post('/courses/import', fileBody, async (request, response) => {
  const input = fileInput(request);
  response.json(await importCourses({ content: input.content, format: formatOf(input), dryRun: ['true', '1', true].includes(input.dryRun) }));
});
dataOpsRouter.post('/courses/sync', async (_request, response) => response.json({ catalogue: await syncCatalogue(), relinked: await relinkInstitutions() }));
dataOpsRouter.post('/courses/relink', async (_request, response) => response.json(await relinkInstitutions()));

dataOpsRouter.get('/review', async (request, response) => response.json(await listReviewQueue(request.query)));

dataOpsRouter.get('/scraper/stats', async (_request, response) => response.json(await queueStats()));
dataOpsRouter.get('/scraper/runs', async (request, response) => response.json({ items: await listRuns(request.query.limit) }));
dataOpsRouter.get('/scraper/sources', async (request, response) => response.json(await listSources(request.query)));
dataOpsRouter.post('/scraper/sources', async (request, response) => response.status(201).json({ item: await createSource(request.body) }));
dataOpsRouter.post('/scraper/sources/import', fileBody, async (request, response) => {
  const input = fileInput(request);
  const rows = parseSeedList(input.content, formatOf(input));
  response.json(await importSources(rows, { seedListName: queryString(input.seedListName, 80) || 'Admin upload' }));
});
dataOpsRouter.patch('/scraper/sources/:id', async (request, response) => response.json({ item: await updateSource(request.params.id, request.body) }));
dataOpsRouter.delete('/scraper/sources/:id', async (request, response) => {
  await deleteSource(request.params.id);
  response.status(204).end();
});
dataOpsRouter.post('/scraper/enqueue', async (request, response) => {
  const body = isPlainObject(request.body) ? request.body : {};
  const result = await enqueueSources({
    mode: queryString(body.mode, 10) || 'all', staleDays: Number(body.staleDays) || 30, limit: Number(body.limit) || 0,
    sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : [], seedListName: queryString(body.seedListName, 80), createdBy: request.admin.email,
  });
  response.status(201).json(result);
});
dataOpsRouter.get('/scraper/jobs', async (request, response) => response.json(await listJobs(request.query)));
dataOpsRouter.post('/scraper/jobs/retry', async (request, response) => {
  const body = isPlainObject(request.body) ? request.body : {};
  response.json(await retryJobs({ ids: Array.isArray(body.ids) ? body.ids : undefined, status: queryString(body.status, 10) || 'failed' }));
});
dataOpsRouter.post('/scraper/jobs/cancel', async (request, response) => {
  const body = isPlainObject(request.body) ? request.body : {};
  response.json(await cancelJobs({ ids: Array.isArray(body.ids) ? body.ids : undefined, runId: queryString(body.runId, 24) || undefined }));
});
