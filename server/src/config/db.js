import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  mongoose.set('strictQuery', false);
  const dbName = process.env.MONGODB_DB; // optional override
  const options = {};
  if (dbName) options.dbName = dbName;
  await mongoose.connect(uri, options);
  const connectedName = mongoose.connection.name || mongoose.connection.db?.databaseName;
  console.log(`MongoDB connected (db: ${connectedName || 'unknown'})`);
}
