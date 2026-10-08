import { MongoClient } from 'mongodb';
import { env } from './env.js';

let client;

// Connect only when a database-backed feature is introduced.
export async function connectDatabase() {
  if (!env.mongodbUri) throw new Error('Set MONGODB_URI before using database features.');
  if (!client) {
    const connection = new MongoClient(env.mongodbUri, { serverSelectionTimeoutMS: 5000 });
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
