import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, { dbName: undefined });
  console.log('MongoDB connected');
}
