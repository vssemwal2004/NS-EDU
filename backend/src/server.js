import { app } from './app.js';
import { assertProductionConfig, env } from './config/env.js';
import { closeDb, getDb } from './db/collections.js';

assertProductionConfig();

const server = app.listen(env.port, env.host, () => {
  console.log(`Gyaan Vidhya API: http://${env.host === '0.0.0.0' ? 'localhost' : env.host}:${env.port}/api/health`);
});
// Keep idle connections open longer than a typical load balancer (60 s) so it never reuses a closed socket.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.on('error', (error) => {
  console.error(`API could not start on ${env.host}:${env.port}:`, error.message);
  process.exit(1);
});

// Warm the connection and indexes without blocking start-up; requests retry on failure.
if (env.mongodbUri) {
  getDb().catch((error) => console.error('Database not ready at start-up:', error.message));
} else {
  console.warn('MONGODB_URI is not set: catalog, auth and admin routes will return 503.');
}
if (!env.jwtSecret) console.warn('JWT_SECRET is not set: sign-in routes will fail until it is configured.');

process.on('unhandledRejection', (reason) => console.error('Unhandled promise rejection:', reason));

// Graceful shutdown: stop accepting connections, let in-flight requests finish (max 10 s), close MongoDB.
let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received, shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(async () => {
    await closeDb().catch(() => {});
    process.exit(0);
  });
  server.closeIdleConnections?.();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
