import Agenda from 'agenda';
import mongoose from 'mongoose';
import { registerReminderJob } from '../jobs/reminder.js';

let agenda;

export async function initAgenda() {
  if (agenda) return agenda;
  const mongoUri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB; // ensure Agenda uses same DB as mongoose
  if (!mongoUri) throw new Error('MONGODB_URI not set for Agenda');

  agenda = new Agenda({
    db: { address: mongoUri, collection: 'agendaJobs', options: dbName ? { dbName } : {} },
    processEvery: '1 minute',
    maxConcurrency: 10,
    defaultConcurrency: 5,
    defaultLockLifetime: 10 * 60 * 1000,
  });

  registerReminderJob(agenda);

  await agenda.start();
  console.log(`Agenda started (db: ${dbName || mongoose.connection.name})`);
  return agenda;
}

export { agenda };
