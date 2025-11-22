// Client-side RSA-OAEP encryption utility (static public key variant)
// Public key is supplied via build-time env: VITE_RSA_PUBLIC_KEY
// Throws if missing to avoid sending plaintext passwords.

const PUBLIC_KEY_PEM = (import.meta.env.VITE_RSA_PUBLIC_KEY || "").trim();
let importedKey = null;

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(
    /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\r|\n|\s/g,
    ""
  );
  if (!b64) throw new Error("Missing RSA public key PEM (VITE_RSA_PUBLIC_KEY)");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function importKey() {
  if (importedKey) return importedKey;
  importedKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(PUBLIC_KEY_PEM),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
  return importedKey;
}

export async function encryptPassword(plain) {
  if (typeof plain !== "string" || !plain) throw new Error("Password empty");
  await importKey();
  const encoded = new TextEncoder().encode(plain);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    importedKey,
    encoded
  );
  const bytes = new Uint8Array(cipherBuf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function buildEncryptedPasswordPayload(fieldName, plain) {
  const passwordEncrypted = await encryptPassword(plain);
  return { [fieldName]: passwordEncrypted };
}
