import crypto from 'crypto';

// Generate ephemeral RSA key pair at startup. For production you'd persist or rotate securely.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

export function getPublicKeyPem() {
  return publicKey;
}

export function decryptPasswordBase64(b64) {
  try {
    const buf = Buffer.from(b64, 'base64');
    const decrypted = crypto.privateDecrypt({
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    }, buf);
    return decrypted.toString();
  } catch (e) {
    return null;
  }
}
