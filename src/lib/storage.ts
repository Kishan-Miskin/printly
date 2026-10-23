import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { calculateSha256 } from "./security";

// Base private storage directory - isolated from public web assets
const STORAGE_ROOT = path.join(process.cwd(), "storage");

/**
 * Ensures the target shop order directory exists in private storage
 */
export function ensureOrderStorageDir(shopId: string, orderId: string): string {
  // Sanitize shopId and orderId to prevent path traversal
  const safeShopId = shopId.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeOrderId = orderId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dirPath = path.join(STORAGE_ROOT, "shops", safeShopId, "orders", safeOrderId, "files");
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export interface StoredFileResult {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
}

/**
 * Saves original file bytes without any modification or compression.
 * Generates an unguessable storage filename.
 */
export async function saveOriginalFile(
  shopId: string,
  orderId: string,
  originalFilename: string,
  fileBuffer: Buffer
): Promise<StoredFileResult> {
  const dir = ensureOrderStorageDir(shopId, orderId);
  const ext = path.extname(originalFilename).toLowerCase();
  const randomFileKey = `${crypto.randomUUID()}${ext}`;
  const absolutePath = path.join(dir, randomFileKey);

  // Compute exact byte-level SHA-256 digest
  const sha256 = calculateSha256(fileBuffer);
  const sizeBytes = fileBuffer.length;

  // Write exact bytes to disk
  await fs.promises.writeFile(absolutePath, fileBuffer);

  // Verification step: re-read and ensure file integrity on disk matches exactly
  const writtenBuffer = await fs.promises.readFile(absolutePath);
  const verifySha = calculateSha256(writtenBuffer);
  if (verifySha !== sha256) {
    // Integrity failure - unlink immediately and throw error
    await fs.promises.unlink(absolutePath).catch(() => {});
    throw new Error("File integrity check failed after writing to disk");
  }

  // Relative storage key for DB storage
  const storageKey = path.posix.join("shops", shopId, "orders", orderId, "files", randomFileKey);

  return {
    storageKey,
    sha256,
    sizeBytes,
  };
}

/**
 * Resolves absolute path from relative storage key and verifies it's within STORAGE_ROOT
 * Strictly enforces tenant path boundary
 */
export function resolveSafeStoragePath(shopId: string, storageKey: string): string {
  const safeShopId = shopId.replace(/[^a-zA-Z0-9_-]/g, "");
  const expectedPrefix = path.normalize(path.join(STORAGE_ROOT, "shops", safeShopId));
  const absolutePath = path.normalize(path.join(STORAGE_ROOT, storageKey));

  // Path traversal check
  if (!absolutePath.startsWith(expectedPrefix)) {
    throw new Error("Access denied: Storage path traversal detected");
  }

  return absolutePath;
}

/**
 * Reads original file buffer for shop download
 */
export async function readOriginalFile(shopId: string, storageKey: string): Promise<Buffer> {
  const absolutePath = resolveSafeStoragePath(shopId, storageKey);
  if (!fs.existsSync(absolutePath)) {
    throw new Error("File not found on storage server");
  }
  return fs.promises.readFile(absolutePath);
}

/**
 * Deletes physical file from disk idempotently
 */
export async function deletePhysicalFile(shopId: string, storageKey: string): Promise<boolean> {
  try {
    const absolutePath = resolveSafeStoragePath(shopId, storageKey);
    if (fs.existsSync(absolutePath)) {
      await fs.promises.unlink(absolutePath);
      return true;
    }
  } catch (err) {
    console.warn("Could not delete physical file:", storageKey, err);
  }
  return false;
}
