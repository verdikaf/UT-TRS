import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Persisted key files (single key, no rotation yet)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keysDir = path.join(__dirname, "..", "keys");
const pubPath = path.join(keysDir, "rsa_public.pem");
const privPath = path.join(keysDir, "rsa_private.pem");

let publicKeyPem;
let privateKeyPem;

function loadExisting() {
  if (fs.existsSync(pubPath) && fs.existsSync(privPath)) {
    publicKeyPem = fs.readFileSync(pubPath, "utf8");
    privateKeyPem = fs.readFileSync(privPath, "utf8");
    return true;
  }
  return false;
}

function generateAndPersist() {
  if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(pubPath, publicKey, { mode: 0o644 });
  fs.writeFileSync(privPath, privateKey, { mode: 0o600 });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
}

// Initialize keypair (no busy-wait locking; assume single process or pre-generated files)
if (!loadExisting()) {
  generateAndPersist();
}

export const PUBLIC_KEY_PEM = publicKeyPem;

export function decryptPasswordBase64(b64) {
  try {
    if (typeof b64 !== "string" || b64.length === 0) return null;
    const buf = Buffer.from(b64, "base64");
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      buf
    );
    return decrypted.toString("utf8");
  } catch (e) {
    return null;
  }
}
