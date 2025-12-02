import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRouter from '../../src/routes/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { User } from '../../src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
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

describe('Duplicate phone registration prevention', () => {
  let mongod; let app; let pubPem;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    process.env.MONGODB_URI = uri;
    await mongoose.connect(uri, { dbName: 'ut_trs_test' });
    app = buildApp();
    const keyPath = path.join(__dirname, '../../src/keys/rsa_public.pem');
    pubPem = fs.readFileSync(keyPath, 'utf8');
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('register plain then plus variant blocked', async () => {
    const phone = '628555123456';
    const pwEnc = encryptWithPem(pubPem, 'Password123');
    await request(app).post('/api/auth/register').send({ name: 'A', phone, passwordEncrypted: pwEnc }).expect(200);
    const pwEnc2 = encryptWithPem(pubPem, 'Password123');
    const dup = await request(app).post('/api/auth/register').send({ name: 'B', phone: '+' + phone, passwordEncrypted: pwEnc2 }).expect(409);
    expect(dup.body.error).toMatch(/already registered/i);
  });

  test('register plus then plain variant blocked', async () => {
    const phone = '628555987654';
    const pwEnc = encryptWithPem(pubPem, 'Password123');
    await request(app).post('/api/auth/register').send({ name: 'A', phone: '+' + phone, passwordEncrypted: pwEnc }).expect(200);
    const pwEnc2 = encryptWithPem(pubPem, 'Password123');
    const dup = await request(app).post('/api/auth/register').send({ name: 'B', phone, passwordEncrypted: pwEnc2 }).expect(409);
    expect(dup.body.error).toMatch(/already registered/i);
  });

  test('stored phone is canonical (no leading plus)', async () => {
    const phone = '628777000111';
    const pwEnc = encryptWithPem(pubPem, 'Password123');
    const res = await request(app).post('/api/auth/register').send({ name: 'C', phone: '+' + phone, passwordEncrypted: pwEnc }).expect(200);
    expect(res.body.user.phone).toBe(phone); // canonical stored
  });

  test('phone-available returns false for any variant after register', async () => {
    const phone = '628333444555';
    const pwEnc = encryptWithPem(pubPem, 'Password123');
    await request(app).post('/api/auth/register').send({ name: 'D', phone, passwordEncrypted: pwEnc }).expect(200);
    const avail1 = await request(app).get('/api/auth/phone-available?phone=' + phone).expect(200);
    expect(avail1.body.available).toBe(false);
    const avail2 = await request(app).get('/api/auth/phone-available?phone=+' + phone).expect(200);
    expect(avail2.body.available).toBe(false);
  });
});
