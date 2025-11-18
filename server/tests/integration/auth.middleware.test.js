import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { jest } from '@jest/globals';

import { auth } from "../../src/middleware/auth.js";
import { User } from "../../src/models/User.js";
import { Session } from "../../src/models/Session.js";

function buildApp() {
  const app = express();
  app.get("/protected", auth, (req, res) =>
    res.json({ ok: true, user: req.user })
  );
  return app;
}

function uniquePhone(prefix = '6287777') {
  return prefix + Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
}

async function createUserAndSession({
  idleMinutesAgo = 0,
  revoked = false,
} = {}) {
  const user = await User.create({
    name: "AuthU",
    phone: uniquePhone(),
    passwordHash: "h",
  });
  const jti = "jti-" + Math.random().toString(36).slice(2);
  const token = jwt.sign(
    { id: user._id, phone: user.phone, name: user.name, jti },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
  const lastActivityAt = new Date(Date.now() - idleMinutesAgo * 60 * 1000 - 1);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await Session.create({
    jti,
    user: user._id,
    lastActivityAt,
    expiresAt,
    revoked,
  });
  return { user, token };
}

describe("auth middleware", () => {
  let mongod;
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    process.env.MAX_IDLE_MINUTES = "5";
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName: "ut_trs_test" });
    app = buildApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Session.deleteMany({}),
    ]);
  });

  test("rejects missing token", async () => {
    await request(app).get("/protected").expect(401);
  });

  test("allows valid session", async () => {
    const { token } = await createUserAndSession({ idleMinutesAgo: 0 });
    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(res.body.ok).toBe(true);
  });

  test("rejects idle session", async () => {
    const { token } = await createUserAndSession({ idleMinutesAgo: 6 });
    await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  test("rejects revoked session", async () => {
    const { token, user } = await createUserAndSession({ idleMinutesAgo: 0 });
    // revoke it
    await Session.updateMany({ user: user._id }, { $set: { revoked: true } });
    await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });
});
