import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const action = process.argv[2] ?? 'status';
const uri = 'mongodb://127.0.0.1:27018/?directConnection=true';
const configPath = fileURLToPath(new URL('../mongodb/mongod.local.cfg', import.meta.url));
const dataPath = 'D:\\MongoDB\\NS-EDU\\data';
const logPath = 'D:\\MongoDB\\NS-EDU\\log';
const mongodPath = 'C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe';

async function connect(timeout = 1000) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: timeout });
  await client.connect();
  return client;
}

async function isRunning() {
  let client;
  try {
    client = await connect();
    await client.db('admin').command({ ping: 1 });
    return true;
  } catch {
    return false;
  } finally {
    await client?.close().catch(() => {});
  }
}

async function waitUntil(check, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function start() {
  if (await isRunning()) {
    console.log('NS-EDU MongoDB is already running at 127.0.0.1:27018.');
    return;
  }

  await Promise.all([
    mkdir(dataPath, { recursive: true }),
    mkdir(logPath, { recursive: true }),
  ]);

  const child = spawn(mongodPath, ['--config', configPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  if (!(await waitUntil(isRunning))) {
    throw new Error(`MongoDB did not start. Check ${logPath}\\mongod.log`);
  }

  console.log('NS-EDU MongoDB started.');
  console.log(`URI: ${uri}`);
  console.log(`Data: ${dataPath}`);
}

async function stop() {
  if (!(await isRunning())) {
    console.log('NS-EDU MongoDB is already stopped.');
    return;
  }

  let client;
  try {
    client = await connect(3000);
    await client.db('admin').command({ shutdown: 1 });
  } catch (error) {
    // A successful shutdown closes the socket before MongoDB can reply.
    if (!['MongoNetworkError', 'MongoServerSelectionError'].includes(error?.name)) throw error;
  } finally {
    await client?.close().catch(() => {});
  }

  if (!(await waitUntil(async () => !(await isRunning())))) {
    throw new Error('MongoDB did not stop within 15 seconds.');
  }
  console.log('NS-EDU MongoDB stopped cleanly.');
}

async function status() {
  const running = await isRunning();
  console.log(`NS-EDU MongoDB: ${running ? 'running' : 'stopped'}`);
  console.log(`URI: ${uri}`);
  console.log(`Data: ${dataPath}`);
  process.exitCode = running ? 0 : 1;
}

if (action === 'start') await start();
else if (action === 'stop') await stop();
else if (action === 'status') await status();
else throw new Error('Usage: node local-mongo.mjs <start|stop|status>');
