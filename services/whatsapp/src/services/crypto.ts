import crypto from "crypto";
import { config } from "../config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = config.encryptionKey;
  if (!key || key.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 hex characters");
  }
  return Buffer.from(key.slice(0, 32), "utf-8");
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf-8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  // Format: iv:tag:encrypted (all base64)
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");

  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "base64", "utf-8");
  decrypted += decipher.final("utf-8");

  return decrypted;
}
