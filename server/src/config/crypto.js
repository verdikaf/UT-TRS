import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Persisted key files (single key, no rotation yet)
const keysDir = path.join(process.cwd(), 'server', 'keys');
const pubPath = path.join(keysDir, 'rsa_public.pem');
const privPath = path.join(keysDir, 'rsa_private.pem');

let publicKeyPem;
let privateKeyPem;

function ensureKeypair() {
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    publicKeyPem = fs.readFileSync(pubPath, 'utf8');
    privateKeyPem = fs.readFileSync(privPath, 'utf8');
    return;
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
  fs.writeFileSync(pubPath, publicKeyPem, { mode: 0o600 });
  fs.writeFileSync(privPath, privateKeyPem, { mode: 0o600 });
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
    return decrypted.toString();
  } catch (e) {
    return null;
  }
}
