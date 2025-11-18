import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";

import tasksRouter from "../../src/routes/tasks.js";
import { User } from "../../src/models/User.js";
import { Session } from "../../src/models/Session.js";
import { Task } from "../../src/models/Task.js";
import { agenda, initAgenda } from "../../src/config/agenda.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/tasks", tasksRouter);
  return app;
}

function uniquePhone(prefix = "6281111") {
  return (
    prefix +
    Math.floor(Math.random() * 1e9)
      .toString()
      .padStart(9, "0")
  );
}

async function makeAuthUser() {
  const user = await User.create({
    name: "Test User",
    phone: uniquePhone(),
    passwordHash: "hash",
  });
  const jti = "test-jti-" + Math.random().toString(36).slice(2);
  const token = jwt.sign(
    { id: user._id, phone: user.phone, name: user.name, jti },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  const expAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Session.create({
    jti,
    user: user._id,
    lastActivityAt: new Date(),
    expiresAt: expAt,
    revoked: false,
  });
  return { user, token };
}

describe("Tasks routes (integration)", () => {
  let mongod;
  let app;

  beforeAll(async () => {
    process.env.TIMEZONE = process.env.TIMEZONE || "Asia/Jakarta";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.WORKER = "1";
    process.env.MONGODB_DB = "ut_trs_test";

    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName: "ut_trs_test" });
    // Start Agenda against the same test DB (lightweight integration)
    await initAgenda();
    app = buildApp();
  }, 60000);

  afterAll(async () => {
    try {
      if (agenda) await agenda.stop();
    } catch {}
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    // Clean up between tests to avoid unique index collisions
    await Promise.all([
      User.deleteMany({}),
      Session.deleteMany({}),
      Task.deleteMany({}),
    ]);
  });

  test("GET /api/tasks returns empty array initially", async () => {
    const { token } = await makeAuthUser();
    const res = await request(app)
      .get("/api/tasks?includeCompleted=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  test("POST /api/tasks validates required fields", async () => {
    const { token } = await makeAuthUser();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  test("POST /api/tasks creates task and schedules job (once)", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    ).toISOString();
    const res = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "My Task",
        deadline,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    expect(res.body._id).toBeDefined();
    expect(res.body.jobId).toBeTruthy();
    expect(res.body.status).toBe("pending");
  }, 20000);

  test("PUT /api/tasks/:id updates pending task and reschedules job", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000
    ).toISOString();
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Edit Me",
        deadline,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    const id = create.body._id;
    const oldJobId = create.body.jobId;
    // Push deadline further to require reschedule
    const newDeadline = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const upd = await request(app)
      .put(`/api/tasks/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Edited", deadline: newDeadline, reminderOffset: "3h" })
      .expect(200);

    expect(upd.body.name).toBe("Edited");
    expect(upd.body.status).toBe("pending");
    expect(upd.body.jobId).toBeTruthy();
    expect(upd.body.jobId).not.toBe(oldJobId);
  }, 20000);

  test("PUT weekly requires endDate and endDate >= deadline", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    ).toISOString();
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Weekly",
        deadline,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    const id = create.body._id;
    // Missing endDate
    const res1 = await request(app)
      .put(`/api/tasks/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reminderType: "weekly" })
      .expect(400);
    expect(res1.body.error).toMatch(/End date is required/i);

    // endDate before deadline
    const badEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const res2 = await request(app)
      .put(`/api/tasks/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reminderType: "weekly", endDate: badEnd })
      .expect(400);
    expect(res2.body.error).toMatch(
      /End date must be the same as or after the start date/i
    );

    // Valid weekly with far endDate
    const goodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const res3 = await request(app)
      .put(`/api/tasks/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reminderType: "weekly", endDate: goodEnd })
      .expect(200);
    expect(res3.body.reminderType).toBe("weekly");
    expect(res3.body.endDate).toBeTruthy();
    expect(res3.body.status).toBe("pending");
    expect(res3.body.jobId).toBeTruthy();
  }, 25000);

  test("PUT cannot resume non-pending by setting status back to pending", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    ).toISOString();
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "To Stop",
        deadline,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    const id = create.body._id;
    await request(app)
      .post(`/api/tasks/${id}/stop`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const res = await request(app)
      .put(`/api/tasks/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "pending" })
      .expect(400);
    expect(res.body.error).toMatch(/cannot be resumed/i);
  }, 20000);

  test("POST /api/tasks/:id/stop stops pending task and clears jobId", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    ).toISOString();
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Stop Me",
        deadline,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    const id = create.body._id;
    const stopRes = await request(app)
      .post(`/api/tasks/${id}/stop`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(stopRes.body.ok).toBe(true);
    expect(stopRes.body.task.status).toBe("stopped");
    expect(stopRes.body.task.jobId).toBeFalsy();

    // stopping again should error
    const stopAgain = await request(app)
      .post(`/api/tasks/${id}/stop`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
    expect(stopAgain.body.error).toMatch(/already completed or stopped/i);
  }, 20000);

  test("DELETE /api/tasks/:id deletes task and returns ok", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    ).toISOString();
    const create = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Delete Me",
        deadline,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    const id = create.body._id;
    const del = await request(app)
      .delete(`/api/tasks/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(del.body.ok).toBe(true);

    const list = await request(app)
      .get("/api/tasks?includeCompleted=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(list.body.find((t) => t._id === id)).toBeUndefined();
  }, 20000);

  test("GET /api/tasks filters out completed by default and includes with flag", async () => {
    const { token } = await makeAuthUser();
    const deadline1 = new Date(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    ).toISOString();
    const t1 = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "A",
        deadline: deadline1,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    const deadline2 = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const t2 = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "B",
        deadline: deadline2,
        reminderType: "once",
        reminderOffset: "1d",
      })
      .expect(201);

    // Mark the first as completed directly via model
    await Task.updateOne(
      { _id: t1.body._id },
      { $set: { status: "completed" } }
    );

    const defList = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    // Should only contain the non-completed one
    expect(defList.body.length).toBe(1);
    expect(defList.body[0]._id).toBe(t2.body._id);

    const allList = await request(app)
      .get("/api/tasks?includeCompleted=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(allList.body.length).toBe(2);
    // Sorted by createdAt desc: t2 should come before t1
    expect(allList.body[0]._id).toBe(t2.body._id);
    expect(allList.body[1]._id).toBe(t1.body._id);
  }, 20000);

  test("POST weekly requires endDate and validates relation; success path", async () => {
    const { token } = await makeAuthUser();
    const deadline = new Date(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    ).toISOString();

    const miss = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Weekly Missing",
        deadline,
        reminderType: "weekly",
        reminderOffset: "1d",
      })
      .expect(400);
    expect(miss.body.error).toMatch(/end date.*required/i);

    const badEnd = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const bad = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Weekly Bad",
        deadline,
        endDate: badEnd,
        reminderType: "weekly",
        reminderOffset: "1d",
      })
      .expect(400);
    expect(bad.body.error).toMatch(
      /End date must be the same as or after the start date/i
    );

    const goodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const ok = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Weekly Ok",
        deadline,
        endDate: goodEnd,
        reminderType: "weekly",
        reminderOffset: "1d",
      })
      .expect(201);
    expect(ok.body.reminderType).toBe("weekly");
    expect(ok.body.jobId).toBeTruthy();
    expect(ok.body.status).toBe("pending");
  }, 25000);
});
