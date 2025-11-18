process.env.TIMEZONE = 'Asia/Jakarta';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.WORKER = '1';
// MONGODB_URI will be provided dynamically via mongodb-memory-server in tests that need DB.
