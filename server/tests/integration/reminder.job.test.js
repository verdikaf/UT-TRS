import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { jest } from '@jest/globals';

import { Task } from "../../src/models/Task.js";
import { User } from "../../src/models/User.js";

// ESM mocking: mock fonnte module before importing the job module
const sendWhatsAppMessageMock = jest.fn().mockResolvedValue({ ok: true });
await jest.unstable_mockModule("../../src/services/fonnte.js", () => ({
  sendWhatsAppMessage: sendWhatsAppMessageMock,
}));

const { registerReminderJob } = await import("../../src/jobs/reminder.js");

describe("Reminder job", () => {
  let mongod;

  beforeAll(async () => {
    process.env.TIMEZONE = "Asia/Jakarta";
    process.env.MONGODB_DB = "ut_trs_test";
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName: "ut_trs_test" });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  test("once reminder sends message and completes task", async () => {
    const user = await User.create({
      name: "U",
      phone: "628555555555",
      passwordHash: "x",
    });
    const dl = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const task = await Task.create({
      user: user._id,
      name: "Test Once",
      deadline: dl,
      reminderType: "once",
      reminderOffset: "1d",
    });

    // Fake agenda to capture define and schedule
    const calls = { scheduled: [] };
    const fakeAgenda = {
      define: (name, handler) => {
        fakeAgenda._handler = handler;
      },
      schedule: async (when, name, data) => {
        calls.scheduled.push({ when, name, data });
        return { attrs: { _id: "jobid" } };
      },
    };

    registerReminderJob(fakeAgenda);

    // Invoke the job handler directly
    await fakeAgenda._handler({
      attrs: { data: { taskId: task._id.toString() } },
    });

    const updated = await Task.findById(task._id);
    expect(sendWhatsAppMessageMock).toHaveBeenCalled();
    expect(updated.status).toBe("completed");
  });

  test("weekly reminder advances deadline and schedules next", async () => {
    const user = await User.create({
      name: "U2",
      phone: "628555555556",
      passwordHash: "x",
    });
    const dl = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const task = await Task.create({
      user: user._id,
      name: "Test Weekly",
      deadline: dl,
      reminderType: "weekly",
      reminderOffset: "1d",
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const calls = { scheduled: [] };
    const fakeAgenda = {
      define: (name, handler) => {
        fakeAgenda._handler = handler;
      },
      schedule: async (when, name, data) => {
        calls.scheduled.push({ when, name, data });
        return { attrs: { _id: "nextJob" } };
      },
    };

    registerReminderJob(fakeAgenda);
    await fakeAgenda._handler({
      attrs: { data: { taskId: task._id.toString() } },
    });

    const updated = await Task.findById(task._id);
    expect(sendWhatsAppMessageMock).toHaveBeenCalled();
    expect(updated.status).toBe("pending");
    expect(updated.deadline.getTime()).toBeGreaterThan(dl.getTime());
    expect(updated.jobId).toBe("nextJob");
    expect(calls.scheduled.length).toBe(1);
  });
});
