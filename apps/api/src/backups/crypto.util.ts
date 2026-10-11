import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

/**
 * تشفير النسخ الاحتياطي المشفر (§5.16): AES-256-GCM.
 *
 * صيغة الملف: MAGIC(8) | iv(12) | authTag(16) | ciphertext
 * المفتاح: BACKUP_ENCRYPTION_KEY (64 hex) أو مشتق بمفتاح عبارة pass-phrase.
 */
const MAGIC = Buffer.from('BAYANBK1');
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SALT = 'bayan-backup-salt';

/** مفتاح تشفير ثابت يُشتق من البيئة (يدعم فك التشفير بعد إعادة التشغيل). */
export function resolveKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (process.env.NODE_ENV === 'production' && !raw) {
    throw new Error('BACKUP_ENCRYPTION_KEY (64 hex chars) is required in production');
  }
  const passphrase = raw && raw.length > 0 ? raw : 'bayan-dev-backup-key';
  return scryptSync(passphrase, SALT, KEY_LEN);
}

export function encrypt(plain: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

export function decrypt(enc: Buffer, key: Buffer): Buffer {
  const header = MAGIC.length + IV_LEN + TAG_LEN;
  if (enc.length < header || !enc.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Not a Bayan encrypted backup (bad header)');
  }
  const iv = enc.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = enc.subarray(MAGIC.length + IV_LEN, header);
  const ciphertext = enc.subarray(header);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
