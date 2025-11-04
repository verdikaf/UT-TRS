import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { Task } from '../models/Task.js';
import { agenda } from '../config/agenda.js';
import { JOB_NAME } from '../jobs/reminder.js';
import { computeInitialSendTime, computeOffsetMs } from '../utils/scheduler.js';

const router = Router();

router.use(auth);

router.get('/', async (req, res) => {
  const tasks = await Task.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(tasks);
});

router.post('/', async (req, res) => {
  try {
    const { name, deadline, reminderType, reminderOffset, endDate } = req.body;
    if (!name || !deadline || !reminderOffset) return res.status(400).json({ error: 'Missing fields' });

    const deadlineDate = new Date(deadline);
    let endDateVal = undefined;
    if (reminderType === 'weekly') {
      if (!endDate) return res.status(400).json({ error: 'endDate is required for weekly recurring tasks' });
      endDateVal = new Date(endDate);
      if (!(endDateVal instanceof Date) || isNaN(+endDateVal)) {
        return res.status(400).json({ error: 'Invalid endDate' });
      }
      if (endDateVal < deadlineDate) {
        return res.status(400).json({ error: 'endDate must be on or after the start deadline' });
      }
    }

    // Validate reminder time: now must be before (deadline - offset)
    try {
      const sendAtCheck = new Date(deadlineDate.getTime() - computeOffsetMs(reminderOffset));
      const now = new Date();
      if (now >= sendAtCheck) {
        return res.status(400).json({
          error: 'Selected reminder time has already passed for this deadline. Adjust the deadline or choose a different reminder offset.'
        });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid reminderOffset' });
    }
    const task = await Task.create({
      user: req.user.id,
      name,
      deadline: deadlineDate,
      reminderType: reminderType === 'weekly' ? 'weekly' : 'once',
      reminderOffset,
      endDate: endDateVal,
    });

    const { sendAt, normalizedDeadline } = computeInitialSendTime(deadlineDate, task.reminderOffset, task.reminderType, { endDate: endDateVal });
    if (+normalizedDeadline !== +task.deadline) {
      task.deadline = normalizedDeadline;
    }

    if (!sendAt) {
      return res.status(400).json({ error: 'No valid future reminder occurs before endDate' });
    }

    const job = await agenda.schedule(sendAt, JOB_NAME, { taskId: task._id.toString() });
    task.jobId = job?.attrs?._id?.toString();
    await task.save();

    res.status(201).json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, deadline, reminderType, reminderOffset, status, endDate } = req.body;
    const task = await Task.findOne({ _id: id, user: req.user.id });
    if (!task) return res.status(404).json({ error: 'Not found' });

    if (name !== undefined) task.name = name;
    if (deadline !== undefined) task.deadline = new Date(deadline);
    if (reminderType !== undefined) task.reminderType = reminderType === 'weekly' ? 'weekly' : 'once';
    if (reminderOffset !== undefined) task.reminderOffset = reminderOffset;
    if (status !== undefined) task.status = status;
    if (endDate !== undefined) task.endDate = endDate ? new Date(endDate) : undefined;

    if (task.reminderType === 'weekly') {
      if (!task.endDate) return res.status(400).json({ error: 'endDate is required for weekly recurring tasks' });
      if (task.endDate < task.deadline) return res.status(400).json({ error: 'endDate must be on or after the start deadline' });
    }

    // Validate reminder time after applying updates
    try {
      const sendAtCheck = new Date(task.deadline.getTime() - computeOffsetMs(task.reminderOffset));
      const now = new Date();
      if (now >= sendAtCheck) {
        return res.status(400).json({
          error: 'Selected reminder time has already passed for this deadline. Adjust the deadline or choose a different reminder offset.'
        });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid reminderOffset' });
    }

    // cancel previous job(s) for this task
    try { await agenda.cancel({ name: JOB_NAME, 'data.taskId': task._id.toString() }); } catch {}

    if (task.status !== 'completed') {
      const { sendAt, normalizedDeadline } = computeInitialSendTime(task.deadline, task.reminderOffset, task.reminderType, { endDate: task.endDate });
      if (+normalizedDeadline !== +task.deadline) task.deadline = normalizedDeadline;
      if (!sendAt) return res.status(400).json({ error: 'No valid future reminder occurs before endDate' });
      const job = await agenda.schedule(sendAt, JOB_NAME, { taskId: task._id.toString() });
      task.jobId = job?.attrs?._id?.toString();
    } else {
      task.jobId = undefined;
    }

    await task.save();
    res.json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, user: req.user.id });
    if (!task) return res.status(404).json({ error: 'Not found' });

    try { await agenda.cancel({ name: JOB_NAME, 'data.taskId': task._id.toString() }); } catch {}

    await Task.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
