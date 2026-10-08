import express from 'express';
import { healthRouter } from './routes/health.js';
import { educationNewsRouter } from './routes/education-news.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api/health', healthRouter);
app.use('/api/education-news', educationNewsRouter);
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  const status = error.status === 400 ? 400 : 500;
  if (status === 500) console.error('Request failed:', error.message);
  response.status(status).json({ error: status === 400 ? 'Invalid request body' : 'Internal server error' });
});
