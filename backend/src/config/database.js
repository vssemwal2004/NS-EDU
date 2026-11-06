import { MongoClient } from 'mongodb';
import { env } from './env.js';

let client;

// Connect only when a database-backed feature is introduced.
export async function connectDatabase() {
  if (!env.mongodbUri) throw new Error('Set MONGODB_URI before using database features.');
  // Tests drop their database when they finish, so under `node --test` (or NODE_ENV=test) only a
  // throwaway nsedu_test_* database may be opened; a test that loads env.js too early fails here
  // instead of wiping the real one.
  if ((process.env.NODE_TEST_CONTEXT || process.env.NODE_ENV === 'test') && !env.mongodbDatabase.startsWith('nsedu_test_')) {
    throw new Error(`Refusing to open database "${env.mongodbDatabase}" from a test: set MONGODB_DATABASE=nsedu_test_* before importing src/.`);
  }
  if (!client) {
    // A few connections stay open (each new TLS connection to Atlas costs several round trips), and
    // replies are compressed — university documents are large and mostly text.
    const connection = new MongoClient(env.mongodbUri, { serverSelectionTimeoutMS: 5000, minPoolSize: 4, maxPoolSize: 50, compressors: ['zlib'] });
    try {
      await connection.connect();
      client = connection;
    } catch (error) {
      await connection.close();
      throw error;
    }
  }
  return client.db(env.mongodbDatabase);
}

export async function closeDatabase() {
  if (client) await client.close();
  client = undefined;
}
