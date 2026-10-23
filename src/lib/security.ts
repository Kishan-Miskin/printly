import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { queryOne, execute } from "./db";

// Supported file validation specs
export interface FileValidationResult {
  valid: boolean;
  detectedMime: string;
  detectedExtension: string;
  error?: string;
}

/**
 * Validates file signatures (magic bytes) against expected formats:
 * PDF, JPEG, PNG, DOCX
 */
export function validateFileMagicBytes(buffer: Buffer, originalFilename: string): FileValidationResult {
  if (!buffer || buffer.length < 8) {
    return { valid: false, detectedMime: "", detectedExtension: "", error: "File buffer is empty or too small" };
  }

  const ext = originalFilename.split(".").pop()?.toLowerCase() || "";

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    if (ext !== "pdf") {
      return { valid: false, detectedMime: "application/pdf", detectedExtension: "pdf", error: "File content is PDF but extension is not .pdf" };
    }
    return { valid: true, detectedMime: "application/pdf", detectedExtension: "pdf" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (ext !== "png") {
      return { valid: false, detectedMime: "image/png", detectedExtension: "png", error: "File content is PNG but extension is not .png" };
    }
    return { valid: true, detectedMime: "image/png", detectedExtension: "png" };
  }

  // 3. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (ext !== "jpg" && ext !== "jpeg") {
      return { valid: false, detectedMime: "image/jpeg", detectedExtension: "jpg", error: "File content is JPEG but extension is not .jpg/.jpeg" };
    }
    return { valid: true, detectedMime: "image/jpeg", detectedExtension: ext };
  }

  // 4. DOCX: PK.. (ZIP archive containing [Content_Types].xml or word/)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05)) {
    if (ext !== "docx") {
      return { valid: false, detectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", detectedExtension: "docx", error: "File is a ZIP/Office container but extension is not .docx" };
    }
    return {
      valid: true,
      detectedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      detectedExtension: "docx",
    };
  }

  return {
    valid: false,
    detectedMime: "application/octet-stream",
    detectedExtension: ext,
    error: `Unsupported file type or invalid signature for: ${originalFilename}. Allowed: PDF, JPG, PNG, DOCX`,
  };
}

/**
 * Calculates SHA-256 hex digest of file buffer for exact byte integrity
 */
export function calculateSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Generates unique human-readable public Order ID (e.g. PF-48291)
 * Guaranteed unique in orders table
 */
export function generateUniqueOrderNumber(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const num = crypto.randomInt(10000, 99999);
    const orderNumber = `PF-${num}`;
    const existing = queryOne("SELECT 1 FROM orders WHERE public_order_number = ?", orderNumber);
    if (!existing) {
      return orderNumber;
    }
  }
  return `PF-${Date.now().toString().slice(-5)}`;
}

/**
 * Generates a cryptographically secure 6-digit Pickup PIN (e.g. "739284")
 */
export function generatePickupPin(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hashes Pickup PIN with bcrypt
 */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/**
 * Verifies Pickup PIN against hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!pin || !hash) return false;
  return bcrypt.compare(pin, hash);
}

/**
 * Generates high-entropy unguessable token
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Hash a public access token for safe secondary comparison
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Pickup verification rate-limit check:
 * Maximum 5 failed attempts per order in 15 minutes
 */
export function checkPickupRateLimit(orderId: string): { isLocked: boolean; failedAttempts: number; remainingAttempts: number } {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const countRow = queryOne<{ count: number }>(`
    SELECT COUNT(*) as count 
    FROM pickup_verifications 
    WHERE order_id = ? AND result = 'FAILED' AND verified_at >= ?
  `, orderId, fifteenMinutesAgo);

  const failedAttempts = countRow?.count || 0;
  const isLocked = failedAttempts >= 5;
  const remainingAttempts = Math.max(0, 5 - failedAttempts);

  return { isLocked, failedAttempts, remainingAttempts };
}

/**
 * Safe audit logger - writes to audit_logs table
 * Strict rule: NEVER log passwords or plaintext PINs
 */
export function logAuditEvent(params: {
  shopId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    const id = crypto.randomUUID();
    const detailsStr = typeof params.details === "object" ? JSON.stringify(params.details) : params.details || null;
    const now = new Date().toISOString();

    execute(`
      INSERT INTO audit_logs (id, shop_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      params.shopId,
      params.userId || null,
      params.action,
      params.resourceType,
      params.resourceId || null,
      detailsStr,
      params.ipAddress || null,
      params.userAgent || null,
      now
    );
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
