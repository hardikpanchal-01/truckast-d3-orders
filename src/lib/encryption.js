/**
 * Encryption Utility for Sensitive Data
 *
 * Uses AES-256-GCM encryption for storing sensitive data like API keys.
 * Requires ENCRYPTION_SECRET_KEY environment variable (32+ characters).
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 16 bytes for AES
const AUTH_TAG_LENGTH = 16; // 16 bytes for GCM auth tag
const ENCODING = "hex";

/**
 * Get the encryption key from environment variable
 * Key must be exactly 32 bytes for AES-256
 */
function getEncryptionKey() {
  const secret = process.env.ENCRYPTION_SECRET_KEY;

  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET_KEY environment variable is not set. " +
        "Please set a 32+ character secret key."
    );
  }

  // Create a 32-byte key from the secret using SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Check if a string appears to be encrypted (internal use)
 */
function checkIsEncrypted(text) {
  if (!text) return false;

  const parts = text.split(":");
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Encrypt sensitive data
 * @param {string} plainText - The text to encrypt
 * @returns {string} Encrypted string in format: iv:authTag:encryptedData (hex encoded)
 */
export function encrypt(plainText) {
  if (!plainText) {
    return "";
  }

  // Skip if already encrypted (prevents double encryption)
  if (checkIsEncrypted(plainText)) {
    return plainText;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plainText, "utf8", ENCODING);
    encrypted += cipher.final(ENCODING);

    const authTag = cipher.getAuthTag();

    // Combine iv, authTag, and encrypted data
    return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedText - The encrypted string in format: iv:authTag:encryptedData
 * @returns {string} Decrypted plain text
 */
export function decrypt(encryptedText) {
  if (!encryptedText) {
    return "";
  }

  // Check if the data is in the expected encrypted format
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    // Data might not be encrypted (legacy data), return as-is
    console.warn("Data does not appear to be encrypted, returning as-is");
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = parts;

    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);

    // Validate lengths
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
      // Invalid format, might be legacy data
      console.warn("Invalid encryption format, returning as-is");
      return encryptedText;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, ENCODING, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    // If decryption fails, it might be legacy unencrypted data
    console.warn("Decryption failed, data might be unencrypted:", error);
    return encryptedText;
  }
}

/**
 * Check if a string appears to be encrypted
 * @param {string} text - The text to check
 * @returns {boolean} true if the text appears to be in encrypted format
 */
export function isEncrypted(text) {
  if (!text) return false;

  const parts = text.split(":");
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex] = parts;

  // Check if parts are valid hex and correct length
  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Mask a sensitive string for display (e.g., "sk-xxxxx...xxxxx")
 * @param {string} text - The text to mask
 * @param {number} visibleChars - Number of characters to show at start and end
 * @returns {string} Masked string
 */
export function maskSensitiveData(text, visibleChars = 4) {
  if (!text) return "";
  if (text.length <= visibleChars * 2) return "****";

  const start = text.substring(0, visibleChars);
  const end = text.substring(text.length - visibleChars);
  return `${start}...${end}`;
}
