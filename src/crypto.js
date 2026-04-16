const crypto = require('crypto');
const config = require('./config');

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function keyBuffer() {
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}

function encrypt(text) {
  if (!text) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, keyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload) return null;
  const [ivB64, authTagB64, encryptedB64] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, keyBuffer(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
