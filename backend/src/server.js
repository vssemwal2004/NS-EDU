import { app } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './config/database.js';

const server = app.listen(env.port, '127.0.0.1', () => {
  console.log(`NSEDU API: http://localhost:${env.port}/api/health`);
});

function shutdown() {
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
