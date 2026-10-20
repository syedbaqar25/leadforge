import * as crypto from 'crypto';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt plaintext using AES-256-GCM authenticated encryption.
 * @param plaintext String to encrypt (e.g. OAuth access token or refresh token)
 * @param secretKey 32-byte hexadecimal encryption key
 */
export function encryptAesGcm(plaintext: string, secretKey: string): EncryptedData {
  // Normalize secret key to 32 bytes (64 hex characters)
  const normalizedKey =
    secretKey.length >= 64
      ? Buffer.from(secretKey.slice(0, 64), 'hex')
      : crypto.createHash('sha256').update(secretKey).digest();

  const iv = crypto.randomBytes(12); // Recommended 12 bytes IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', normalizedKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag,
  };
}

/**
 * Decrypt AES-256-GCM encrypted data with authentication tag verification.
 */
export function decryptAesGcm(data: EncryptedData, secretKey: string): string {
  const normalizedKey =
    secretKey.length >= 64
      ? Buffer.from(secretKey.slice(0, 64), 'hex')
      : crypto.createHash('sha256').update(secretKey).digest();

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    normalizedKey,
    Buffer.from(data.iv, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

  let decrypted = decipher.update(data.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
