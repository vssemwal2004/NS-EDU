import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTtlCache } from '../src/lib/ttl-cache.js';

const settle = () => new Promise((resolve) => { setImmediate(resolve); });

test('wrap caches a value until it expires, and concurrent misses share one load', async () => {
  let now = 0;
  let loads = 0;
  const cache = createTtlCache({ ttlMs: 100, clock: () => now });
  const load = async () => { loads += 1; return loads; };
  const [a, b] = await Promise.all([cache.wrap('k', load), cache.wrap('k', load)]);
  assert.deepEqual([a, b, loads], [1, 1, 1]);
  now = 50;
  assert.equal(await cache.wrap('k', load), 1);
  now = 150; // expired, no stale window: the caller waits for a fresh load
  assert.equal(await cache.wrap('k', load), 2);
});

test('with staleMs, an expired entry is answered at once and refreshed in the background', async () => {
  let now = 0;
  let loads = 0;
  const cache = createTtlCache({ ttlMs: 100, staleMs: 1000, clock: () => now });
  const load = async () => { loads += 1; return `v${loads}`; };
  assert.equal(await cache.wrap('k', load), 'v1');
  now = 200;
  assert.equal(await cache.wrap('k', load), 'v1', 'stale copy served immediately');
  assert.equal(await cache.wrap('k', load), 'v1', 'one background refresh at a time');
  await settle(); await settle();
  assert.equal(loads, 2);
  assert.equal(await cache.wrap('k', load), 'v2', 'the refreshed value replaces it');
  now = 5000; // beyond the stale window: wait for a fresh load
  assert.equal(await cache.wrap('k', load), 'v3');
});

test('a failed background refresh keeps the stale value; clear() drops everything at once', async () => {
  let now = 0;
  let fail = false;
  const cache = createTtlCache({ ttlMs: 100, staleMs: 1000, clock: () => now });
  const load = async () => { if (fail) throw new Error('db down'); return 'ok'; };
  await cache.wrap('k', load);
  now = 200; fail = true;
  assert.equal(await cache.wrap('k', load), 'ok');
  await settle(); await settle();
  assert.equal(await cache.wrap('k', load), 'ok', 'still served after the refresh failed');
  await settle(); await settle(); // that read started another (failing) refresh; let it finish
  // An admin write clears the cache: the next read must not see the old value, and a refresh that
  // was in flight before the clear must not write it back.
  fail = false;
  let release;
  const slow = () => new Promise((resolve) => { release = () => resolve('old'); });
  now = 400;
  await cache.wrap('k', slow); // stale → background refresh starts (slow) on the next tick
  await settle();
  cache.clear();
  release();
  await settle(); await settle();
  assert.equal(await cache.wrap('k', async () => 'new'), 'new');
});
