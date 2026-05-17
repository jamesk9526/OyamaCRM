/**
 * Credential encryption/decryption utility for securely storing sensitive data.
 * Uses Node.js crypto for AES-256-GCM encryption with authenticated decryption.
 *
 * Pattern:
 *   - Store only encrypted secrets in database
 *   - Decrypt on demand when credential is needed
 *   - Never log or expose raw secrets
 *   - Use unique encryption key per organization (future enhancement)
 *
 * @module services/credential-encryption
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const AUTH_TAG_LENGTH = 16; // bytes
const IV_LENGTH = 12; // bytes for GCM (96 bits recommended)
const ENCRYPTION_KEY_LENGTH = 32; // bytes for AES-256

/**
 * Gets the master encryption key from environment.
 * In production, use a secure key management service (AWS KMS, Azure Key Vault, etc).
 * Fallback to environment variable for development/testing only.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!envKey) {
    // Development fallback - NEVER use in production!
    console.warn(
      "WARNING: CREDENTIAL_ENCRYPTION_KEY not set. Using development fallback. " +
      "This should NEVER be used in production. Set CREDENTIAL_ENCRYPTION_KEY to a 64-character hex string.",
    );
    // 64-character hex string = 32 bytes
    return Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex");
  }

  if (envKey.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  return Buffer.from(envKey, "hex");
}

/**
 * Encrypts a credential (password, token, etc) into a format safe to store in database.
 *
 * Returns format: "iv:authTag:encryptedData" (all hex-encoded, colon-separated)
 *
 * @param plaintext - The secret to encrypt (e.g., SMTP password)
 * @returns Encrypted credential string safe for database storage
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext) return "";

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plaintext, "utf-8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: "iv:authTag:encryptedData" - each part hex-encoded
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a credential that was encrypted with encryptCredential().
 *
 * @param encrypted - The encrypted credential string from database
 * @returns The original plaintext secret
 * @throws Error if decryption fails (corrupted data, wrong key, wrong format)
 */
export function decryptCredential(encrypted: string): string {
  if (!encrypted || typeof encrypted !== "string") return "";

  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted credential format");
    }

    const [ivHex, authTagHex, encryptedDataHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedData = Buffer.from(encryptedDataHex, "hex");

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
    }

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData.toString("hex"), "hex", "utf-8");
    decrypted += decipher.final("utf8") as unknown as string;

    return decrypted;
  } catch (error) {
    // Log error but don't expose implementation details in response
    console.error("Credential decryption failed:", error instanceof Error ? error.message : "Unknown error");
    throw new Error("Failed to decrypt credential");
  }
}

/**
 * Generates a new encryption key for setup/rotation.
 * Returns a 64-character hex string suitable for CREDENTIAL_ENCRYPTION_KEY.
 */
export function generateEncryptionKey(): string {
  return randomBytes(ENCRYPTION_KEY_LENGTH).toString("hex");
}

/**
 * Marks a credential as encrypted without exposing the value.
 * Use this to indicate a field is stored encrypted without revealing its content.
 */
export function isCredentialEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && typeof value === "string" && value.includes(":") && value.length > 20);
}
