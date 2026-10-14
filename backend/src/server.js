import { app } from './app.js';
import { env } from './config/env.js';
import { closeDb, getDb } from './db/collections.js';

const server = app.listen(env.port, '127.0.0.1', () => {
  console.log(`NSEDU API: http://localhost:${env.port}/api/health`);
});

// Warm the connection and indexes without blocking start-up; requests retry on failure.
if (env.mongodbUri) {
  getDb().catch((error) => console.error('Database not ready at start-up:', error.message));
} else {
  console.warn('MONGODB_URI is not set: catalog, auth and admin routes will return 503.');
}
if (!env.jwtSecret) console.warn('JWT_SECRET is not set: sign-in routes will fail until it is configured.');

function shutdown() {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
