import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { Task } from "../models/Task.js";
import { agenda } from "../config/agenda.js";
import { JOB_NAME } from "../jobs/reminder.js";
import { computeInitialSendTime, computeOffsetMs } from "../utils/scheduler.js";

const router = Router();

router.use(auth);

// Helpers to reduce duplicate code across routes
function parseWeeklyEndDate(reminderType, deadlineDate, endDateRaw) {
  if (reminderType !== "weekly") return { endDateVal: undefined };
  if (!endDateRaw)
    return { error: "End date (endDate) is required for weekly reminders" };
  const endDateVal = new Date(endDateRaw);
  if (isNaN(+endDateVal)) {
    return { error: "Invalid end date" };
  }
  if (endDateVal < deadlineDate) {
    return { error: "End date must be the same as or after the start date" };
  }
  return { endDateVal };
}

function validateReminderTimeFuture(deadlineDate, reminderOffset) {
  try {
    const sendAtCheck = new Date(
      deadlineDate.getTime() - computeOffsetMs(reminderOffset)
    );
    const now = new Date();
    if (now >= sendAtCheck) {
      return {
        error:
          "Reminder time already passed for this deadline. Adjust the deadline or choose a different reminder offset.",
      };
    }
    return {};
  } catch (e) {
    return { error: "Invalid reminder offset" };
  }
}

async function cancelTaskJobsById(taskId) {
  try {
    await agenda.cancel({ name: JOB_NAME, "data.taskId": taskId });
  } catch {}
}

function computeSchedule(task) {
  const { sendAt, normalizedDeadline } = computeInitialSendTime(
    task.deadline,
    task.reminderOffset,
    task.reminderType,
    { endDate: task.endDate }
  );
  return { sendAt, normalizedDeadline };
}

async function schedulePendingTask(task) {
  const { sendAt, normalizedDeadline } = computeSchedule(task);
  if (+normalizedDeadline !== +task.deadline) task.deadline = normalizedDeadline;
  if (!sendAt) return { error: "No upcoming reminder before end date" };
  const job = await agenda.schedule(sendAt, JOB_NAME, {
    taskId: task._id.toString(),
  });
  task.jobId = job?.attrs?._id?.toString();
  return {};
}

router.get("/", async (req, res) => {
  const includeCompleted = req.query.includeCompleted === "true";
  const query = { user: req.user.id };
  if (!includeCompleted) query.status = { $ne: "completed" };
  const tasks = await Task.find(query).sort({ createdAt: -1 });
  res.json(tasks);
});

router.post("/", async (req, res) => {
  try {
    const { name, deadline, reminderType, reminderOffset, endDate } = req.body;
    if (!name || !deadline || !reminderOffset)
      return res.status(400).json({ error: "Required fields are missing" });

    const deadlineDate = new Date(deadline);
    const { endDateVal, error: weeklyErr } = parseWeeklyEndDate(
      reminderType,
      deadlineDate,
      endDate
    );
    if (weeklyErr) return res.status(400).json({ error: weeklyErr });

    // Validate reminder time: now must be before (deadline - offset)
    {
      const { error } = validateReminderTimeFuture(deadlineDate, reminderOffset);
      if (error) return res.status(400).json({ error });
    }
    const task = await Task.create({
      user: req.user.id,
      name,
      deadline: deadlineDate,
      reminderType: reminderType === "weekly" ? "weekly" : "once",
      reminderOffset,
      endDate: endDateVal,
    });
    {
      const { error } = await schedulePendingTask(task);
      if (error) return res.status(400).json({ error });
    }
    await task.save();

    res.status(201).json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, deadline, reminderType, reminderOffset, status, endDate } =
      req.body;
    const task = await Task.findOne({ _id: id, user: req.user.id });
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (name !== undefined) task.name = name;
    if (deadline !== undefined) task.deadline = new Date(deadline);
    if (reminderType !== undefined)
      task.reminderType = reminderType === "weekly" ? "weekly" : "once";
    if (reminderOffset !== undefined) task.reminderOffset = reminderOffset;
    if (status !== undefined) {
      // Prevent resuming once stopped/completed
      if (task.status !== "pending" && status === "pending") {
        return res
          .status(400)
          .json({
            error: "Task cannot be resumed after it is stopped or completed",
          });
      }
      task.status = status;
    }
    if (endDate !== undefined)
      task.endDate = endDate ? new Date(endDate) : undefined;

    if (task.reminderType === "weekly") {
      if (!task.endDate)
        return res
          .status(400)
          .json({ error: "End date is required for weekly reminders" });
      if (task.endDate < task.deadline)
        return res
          .status(400)
          .json({ error: "End date must be the same as or after the start date" });
    }

    // Validate reminder time after applying updates
    {
      const { error } = validateReminderTimeFuture(
        task.deadline,
        task.reminderOffset
      );
      if (error) return res.status(400).json({ error });
    }

    // cancel previous job(s) for this task
    await cancelTaskJobsById(task._id.toString());

    if (task.status === "pending") {
      const { error } = await schedulePendingTask(task);
      if (error) return res.status(400).json({ error });
    } else {
      task.jobId = undefined;
    }

    await task.save();
    res.json(task);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, user: req.user.id });
    if (!task) return res.status(404).json({ error: "Task not found" });

    await cancelTaskJobsById(task._id.toString());

    await Task.deleteOne({ _id: id });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

// Stop a task: cancel future reminders and mark as stopped (irreversible)
router.post("/:id/stop", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await Task.findOne({ _id: id, user: req.user.id });
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (task.status !== "pending")
      return res
        .status(400)
        .json({ error: "Task already completed or stopped" });

    await cancelTaskJobsById(task._id.toString());
    task.status = "stopped";
    task.jobId = undefined;
    await task.save();
    res.json({ ok: true, task });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});
