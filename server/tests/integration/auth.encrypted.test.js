import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRouter from '../../src/routes/auth.js';
import profileRouter from '../../src/routes/profile.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../../src/models/User.js';
import { Session } from '../../src/models/Session.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  return app;
}

function randomPhone() {
  // Indonesian-style starting with 628 plus 9 digits (total length 12)
  return '628' + Math.floor(Math.random() * 1e9).toString().padStart(9,'0');
}

function encryptWithPem(pubPem, plain) {
  const buf = Buffer.from(plain, 'utf8');
  const cipher = crypto.publicEncrypt({
    key: pubPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, buf);
  return cipher.toString('base64');
}

describe('Encrypted auth flows', () => {
  let mongod; let app; let pubPem;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName: 'ut_trs_test' });
    app = buildApp();
    // read persisted public key directly (static key approach)
    const keyPath = path.join(__dirname, '../../keys/rsa_public.pem');
    pubPem = fs.readFileSync(keyPath, 'utf8');
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

  test('register succeeds with encrypted password', async () => {
    const phone = randomPhone();
    const passwordEncrypted = encryptWithPem(pubPem, 'SuperSecret123');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'EncUser', phone, passwordEncrypted })
      .expect(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user).toBeDefined();
  });

  test('login succeeds with encrypted password', async () => {
    const phone = randomPhone();
    const pw = 'AnotherSecret987';
    // register first
    const regCipher = encryptWithPem(pubPem, pw);
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'LoginUser', phone, passwordEncrypted: regCipher })
      .expect(200);
    const loginCipher = encryptWithPem(pubPem, pw);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone, passwordEncrypted: loginCipher })
      .expect(200);
    expect(loginRes.body.token).toBeDefined();
  });

  test('login fails with wrong password', async () => {
    const phone = randomPhone();
    const regCipher = encryptWithPem(pubPem, 'RightPass123');
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'WrongPW', phone, passwordEncrypted: regCipher })
      .expect(200);
    const wrongCipher = encryptWithPem(pubPem, 'WrongPass999');
    await request(app)
      .post('/api/auth/login')
      .send({ phone, passwordEncrypted: wrongCipher })
      .expect(401);
  });

  test('register rejects missing encrypted password', async () => {
    const phone = randomPhone();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'NoEnc', phone })
      .expect(400);
    expect(res.body.error).toMatch(/Required fields/i);
  });

  test('login rejects missing encrypted password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: randomPhone() })
      .expect(400);
    expect(res.body.error).toMatch(/Required fields/i);
  });

  test('register rejects invalid ciphertext', async () => {
    const phone = randomPhone();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'BadCipher', phone, passwordEncrypted: 'abcd' })
      .expect(400);
    expect(res.body.error).toMatch(/Invalid encrypted password/i);
  });

  test('profile password change with encrypted fields', async () => {
    const phone = randomPhone();
    const oldPw = 'OldPass321';
    const regCipher = encryptWithPem(pubPem, oldPw);
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Changer', phone, passwordEncrypted: regCipher })
      .expect(200);
    const token = regRes.body.token;
    const newPw = 'NewPass654';
    const currentPasswordEncrypted = encryptWithPem(pubPem, oldPw);
    const newPasswordEncrypted = encryptWithPem(pubPem, newPw);
    const changeRes = await request(app)
      .put('/api/profile/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPasswordEncrypted, newPasswordEncrypted })
      .expect(200);
    expect(changeRes.body.token).toBeDefined();
    // login with new password
    const loginCipher = encryptWithPem(pubPem, newPw);
    await request(app)
      .post('/api/auth/login')
      .send({ phone, passwordEncrypted: loginCipher })
      .expect(200);
  });
});
