import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';

test('API is usable without MongoDB and unknown routes return JSON 404', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', service: 'nsedu-api' });
    const missing = await fetch(`${base}/api/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'Route not found' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
