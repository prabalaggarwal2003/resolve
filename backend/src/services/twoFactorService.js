import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

const ENCRYPTION_ALGO = 'aes-256-gcm';
const ENCRYPTION_KEY = crypto.scryptSync(env.jwtSecret, 'resolve-2fa-salt', 32);
const TOTP_WINDOW = 1; // ±30 seconds
const BACKUP_CODE_COUNT = 10;
const BCRYPT_ROUNDS = 10;

const attemptStore = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function getAttemptKey(identifier) {
  return String(identifier).toLowerCase();
}

export function checkRateLimit(identifier) {
  const key = getAttemptKey(identifier);
  const record = attemptStore.get(key);
  if (!record) return null;

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const minutesLeft = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    return `Too many attempts. Try again in ${minutesLeft} minute(s).`;
  }

  if (record.lockedUntil && Date.now() >= record.lockedUntil) {
    attemptStore.delete(key);
  }

  return null;
}

export function recordFailedAttempt(identifier) {
  const key = getAttemptKey(identifier);
  const record = attemptStore.get(key) || { count: 0, lockedUntil: null };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_MS;
    record.count = 0;
  }

  attemptStore.set(key, record);
}

export function clearRateLimit(identifier) {
  attemptStore.delete(getAttemptKey(identifier));
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored) {
  if (!stored) return null;
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGO,
    ENCRYPTION_KEY,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex'), null, 'utf8') + decipher.final('utf8');
}

export function generateTotpSecret(email) {
  return speakeasy.generateSecret({
    name: email,
    issuer: 'Resolve',
    length: 32,
  });
}

export async function buildSetupPayload(secret, email) {
  const otpauthUrl = speakeasy.otpauthURL({
    secret: secret.base32,
    label: email,
    issuer: 'Resolve',
    encoding: 'base32',
  });

  const qrCode = await QRCode.toDataURL(otpauthUrl);

  return {
    qrCode,
    manualKey: secret.base32,
  };
}

export function verifyTotpCode(secretBase32, token) {
  if (!secretBase32 || !token) return false;
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: 'base32',
    token: String(token).trim(),
    window: TOTP_WINDOW,
  });
}

function generateBackupCode() {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${part1}-${part2}`;
}

export async function generateBackupCodes() {
  const plainCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => generateBackupCode());
  const hashedCodes = await Promise.all(
    plainCodes.map((code) => bcrypt.hash(code.replace(/-/g, '').toUpperCase(), BCRYPT_ROUNDS))
  );
  return { plainCodes, hashedCodes };
}

export async function verifyAndConsumeBackupCode(user, rawCode) {
  if (!rawCode || !user.backupCodes?.length) return false;

  const normalized = String(rawCode).replace(/-/g, '').trim().toUpperCase();
  if (!normalized) return false;

  for (let i = 0; i < user.backupCodes.length; i += 1) {
    const matches = await bcrypt.compare(normalized, user.backupCodes[i]);
    if (matches) {
      user.backupCodes.splice(i, 1);
      await user.save();
      return true;
    }
  }

  return false;
}

export function getDecryptedTotpSecret(user) {
  if (!user.twoFactorSecret) return null;
  return decryptSecret(user.twoFactorSecret);
}
