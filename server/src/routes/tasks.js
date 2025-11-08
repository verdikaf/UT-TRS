import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { Task } from "../models/Task.js";
import { agenda } from "../config/agenda.js";
import { JOB_NAME } from "../jobs/reminder.js";
import { computeInitialSendTime, computeOffsetMs } from "../utils/scheduler.js";

const router = Router();

router.use(auth);

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
    let endDateVal = undefined;
    if (reminderType === "weekly") {
      if (!endDate)
        return res
          .status(400)
          .json({
            error: "End date (endDate) is required for weekly reminders",
          });
      endDateVal = new Date(endDate);
      if (!(endDateVal instanceof Date) || isNaN(+endDateVal)) {
        return res.status(400).json({ error: "Invalid end date" });
      }
      if (endDateVal < deadlineDate) {
        return res
          .status(400)
          .json({
            error: "End date must be the same as or after the start date",
          });
      }
    }

    // Validate reminder time: now must be before (deadline - offset)
    try {
      const sendAtCheck = new Date(
        deadlineDate.getTime() - computeOffsetMs(reminderOffset)
      );
      const now = new Date();
      if (now >= sendAtCheck) {
        return res.status(400).json({
          error:
            "Reminder time already passed for this deadline. Adjust the deadline or choose a different reminder offset.",
        });
      }
    } catch (err) {
      return res.status(400).json({ error: "Invalid reminder offset" });
    }
    const task = await Task.create({
      user: req.user.id,
      name,
      deadline: deadlineDate,
      reminderType: reminderType === "weekly" ? "weekly" : "once",
      reminderOffset,
      endDate: endDateVal,
    });

    const { sendAt, normalizedDeadline } = computeInitialSendTime(
      deadlineDate,
      task.reminderOffset,
      task.reminderType,
      { endDate: endDateVal }
    );
    if (+normalizedDeadline !== +task.deadline) {
      task.deadline = normalizedDeadline;
    }

    if (!sendAt) {
      return res
        .status(400)
        .json({ error: "No upcoming reminder before end date" });
    }

    const job = await agenda.schedule(sendAt, JOB_NAME, {
      taskId: task._id.toString(),
    });
    task.jobId = job?.attrs?._id?.toString();
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
          .json({
            error: "End date must be the same as or after the start date",
          });
    }

    // Validate reminder time after applying updates
    try {
      const sendAtCheck = new Date(
        task.deadline.getTime() - computeOffsetMs(task.reminderOffset)
      );
      const now = new Date();
      if (now >= sendAtCheck) {
        return res.status(400).json({
          error:
            "Reminder time already passed for this deadline. Adjust the deadline or choose a different reminder offset.",
        });
      }
    } catch (err) {
      return res.status(400).json({ error: "Invalid reminder offset" });
    }

    // cancel previous job(s) for this task
    try {
      await agenda.cancel({
        name: JOB_NAME,
        "data.taskId": task._id.toString(),
      });
    } catch {}

    if (task.status === "pending") {
      const { sendAt, normalizedDeadline } = computeInitialSendTime(
        task.deadline,
        task.reminderOffset,
        task.reminderType,
        { endDate: task.endDate }
      );
      if (+normalizedDeadline !== +task.deadline)
        task.deadline = normalizedDeadline;
      if (!sendAt)
        return res
          .status(400)
          .json({ error: "No upcoming reminder before end date" });
      const job = await agenda.schedule(sendAt, JOB_NAME, {
        taskId: task._id.toString(),
      });
      task.jobId = job?.attrs?._id?.toString();
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

    try {
      await agenda.cancel({
        name: JOB_NAME,
        "data.taskId": task._id.toString(),
      });
    } catch {}

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

    try {
      await agenda.cancel({
        name: JOB_NAME,
        "data.taskId": task._id.toString(),
      });
    } catch {}
    task.status = "stopped";
    task.jobId = undefined;
    await task.save();
    res.json({ ok: true, task });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});
