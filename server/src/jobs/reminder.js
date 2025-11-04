import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { sendWhatsAppMessage } from '../services/fonnte.js';
import { computeNextWeekly } from '../utils/scheduler.js';

const JOB_NAME = 'send_whatsapp_reminder';

export function registerReminderJob(agenda) {
  agenda.define(JOB_NAME, async (job) => {
    const { taskId } = job.attrs.data || {};
    if (!taskId) return;

    const task = await Task.findById(taskId);
    if (!task) return;

    const user = await User.findById(task.user);
    if (!user) return;

    const deadlineStr = new Date(task.deadline).toLocaleString();
    const message = `Reminder: ${task.name}\nDeadline: ${deadlineStr}`;

    try {
      await sendWhatsAppMessage({ phone: user.phone, message });
      task.lastSentAt = new Date();

      if (task.reminderType === 'once') {
        task.status = 'completed';
        // no further scheduling
      } else if (task.reminderType === 'weekly') {
        const { nextDeadline, sendAt } = computeNextWeekly(task.deadline, task.reminderOffset, task.endDate);
        if (nextDeadline && sendAt) {
          task.deadline = nextDeadline;
          // schedule next run
          const nextJob = await agenda.schedule(sendAt, JOB_NAME, { taskId: task._id.toString() });
          task.jobId = nextJob?.attrs?._id?.toString();
        } else {
          // end of recurrence window
          task.status = 'completed';
          task.jobId = undefined;
        }
      }
      await task.save();
    } catch (err) {
      console.error('Failed to send reminder', err?.response?.data || err.message);
    }
  });
}

export { JOB_NAME };
