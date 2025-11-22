import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Persisted key files (single key, no rotation yet)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keysDir = path.join(__dirname, '..', 'keys');
const pubPath = path.join(keysDir, 'rsa_public.pem');
const privPath = path.join(keysDir, 'rsa_private.pem');

let publicKeyPem;
let privateKeyPem;

// Lock retry configuration
const MAX_LOCK_RETRIES = 10;
const LOCK_RETRY_DELAY_MS = 100;

function ensureKeypair() {
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  
  // Check if keys already exist
  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    publicKeyPem = fs.readFileSync(pubPath, 'utf8');
    privateKeyPem = fs.readFileSync(privPath, 'utf8');
    return;
  }
  
  // Use a lock file to prevent race conditions in clustered deployments
  const lockPath = path.join(keysDir, '.keypair.lock');
  let lockFd;
  
  try {
    // Try to acquire exclusive lock (will fail if another process holds it)
    lockFd = fs.openSync(lockPath, 'wx');
    
    // Double-check keys don't exist (another process may have created them before we got the lock)
    if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
      publicKeyPem = fs.readFileSync(pubPath, 'utf8');
      privateKeyPem = fs.readFileSync(privPath, 'utf8');
      return;
    }
    
    // Generate keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    
    // Write to temporary files first
    const tmpPubPath = pubPath + '.tmp';
    const tmpPrivPath = privPath + '.tmp';
    
    fs.writeFileSync(tmpPubPath, publicKey, { mode: 0o644 });
    fs.writeFileSync(tmpPrivPath, privateKey, { mode: 0o600 });
    
    // Atomically rename temp files to final locations
    fs.renameSync(tmpPubPath, pubPath);
    fs.renameSync(tmpPrivPath, privPath);
    
    publicKeyPem = publicKey;
    privateKeyPem = privateKey;
  } catch (err) {
    if (err.code === 'EEXIST') {
      // Lock file exists, another process is generating keys
      // Wait briefly and retry reading existing keys
      let retries = MAX_LOCK_RETRIES;
      while (retries > 0 && (!fs.existsSync(pubPath) || !fs.existsSync(privPath))) {
        // Synchronous sleep using performance timer (compatible across Node.js versions)
        const start = performance.now();
        while (performance.now() - start < LOCK_RETRY_DELAY_MS) {
          // Busy wait - unavoidable in synchronous module initialization
        }
        retries--;
      }
      
      if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
        publicKeyPem = fs.readFileSync(pubPath, 'utf8');
        privateKeyPem = fs.readFileSync(privPath, 'utf8');
      } else {
        throw new Error('Failed to acquire keypair after waiting for lock');
      }
    } else {
      throw err;
    }
  } finally {
    // Clean up lock file
    if (lockFd !== undefined) {
      try {
        fs.closeSync(lockFd);
        fs.unlinkSync(lockPath);
      } catch (cleanupErr) {
        // Log cleanup errors but don't fail the operation
        console.warn('Failed to clean up lock file:', cleanupErr.message);
      }
    }
  }
}

ensureKeypair();

// Public key will be consumed directly by build-time tooling / client env
export const PUBLIC_KEY_PEM = publicKeyPem;

export function decryptPasswordBase64(b64) {
  try {
    if (typeof b64 !== 'string' || b64.length === 0) return null;
    const buf = Buffer.from(b64, 'base64');
    const decrypted = crypto.privateDecrypt({
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    }, buf);
    return decrypted.toString('utf8');
  } catch (e) {
    return null;
  }
}
