import Agenda from 'agenda';
import mongoose from 'mongoose';
import { registerReminderJob } from '../jobs/reminder.js';

let agenda;

export async function initAgenda() {
  if (agenda) return agenda;
  const mongoConnection = mongoose.connection?.client?.db?.();
  const mongoUri = process.env.MONGODB_URI;

  agenda = new Agenda({
    db: { address: mongoUri, collection: 'agendaJobs' },
    processEvery: '1 minute',
    maxConcurrency: 10,
    defaultConcurrency: 5,
    defaultLockLifetime: 10 * 60 * 1000,
  });

  registerReminderJob(agenda);

  await agenda.start();
  console.log('Agenda started');
  return agenda;
}

export { agenda };
