import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import {
  validateFileMagicBytes,
  calculateSha256,
  generateUniqueOrderNumber,
  generatePickupPin,
  hashPin,
  generateSecureToken,
  hashToken,
  logAuditEvent,
} from "@/lib/security";
import { saveOriginalFile } from "@/lib/storage";

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;

    interface ShopRow {
      id: string;
      name: string;
      is_open: number;
      settings: string;
    }

    const shop = db.prepare(`
      SELECT id, name, is_open, settings
      FROM shops
      WHERE (public_token = ? OR slug = ?) AND active = 1
    `).get(token, token) as ShopRow | undefined;

    if (!shop) {
      return NextResponse.json({ error: "Print center not found or currently unavailable" }, { status: 404 });
    }

    if (shop.is_open !== 1) {
      return NextResponse.json(
        { error: `${shop.name} is currently closed and not accepting new orders. Please check opening hours.` },
        { status: 400 }
      );
    }

    let parsedSettings = {
      max_file_size_mb: 20,
      max_files_per_order: 10,
    };
    try {
      parsedSettings = { ...parsedSettings, ...JSON.parse(shop.settings) };
    } catch {}

    const formData = await request.formData();

    // Check for idempotency key
    const idempotencyKey = (formData.get("idempotencyKey") as string)?.trim() || null;
    if (idempotencyKey) {
      interface ExistingOrderRow {
        public_order_number: string;
        public_access_token: string;
        created_at: string;
      }

      const existingOrder = db.prepare(`
        SELECT public_order_number, public_access_token, created_at
        FROM orders
        WHERE shop_id = ? AND idempotency_key = ?
      `).get(shop.id, idempotencyKey) as ExistingOrderRow | undefined;

      if (existingOrder) {
        // Return existing order info for idempotent replay
        return NextResponse.json({
          success: true,
          orderNumber: existingOrder.public_order_number,
          publicAccessToken: existingOrder.public_access_token,
          statusUrl: `/order/${existingOrder.public_access_token}`,
          shopName: shop.name,
          isReplay: true,
          message: "Order already received",
        });
      }
    }

    const customerName = ((formData.get("customerName") as string) || "").trim();
    const customerPhone = ((formData.get("customerPhone") as string) || "").trim();
    const customerRequirements = ((formData.get("customerRequirements") as string) || "").trim();
    const orderSource = (formData.get("source") as string) === "DIRECTORY" ? "DIRECTORY" : "QR";

    // Extract files
    const fileEntries = formData.getAll("files") as File[];
    if (!fileEntries || fileEntries.length === 0) {
      return NextResponse.json({ error: "Please upload at least one document" }, { status: 400 });
    }

    if (fileEntries.length > parsedSettings.max_files_per_order) {
      return NextResponse.json(
        { error: `Maximum ${parsedSettings.max_files_per_order} files allowed per order` },
        { status: 400 }
      );
    }

    // Extract per-file metadata passed as JSON string or individual fields
    let filesMetaRaw: Array<{
      originalFilename?: string;
      printColor?: "BW" | "COLOR";
      paperSize?: "A4" | "A3" | "LEGAL" | "LETTER";
      duplex?: "SINGLE" | "DOUBLE";
      copies?: number;
      customerRequirements?: string;
    }> = [];

    const metaJson = formData.get("filesMeta") as string;
    if (metaJson) {
      try {
        filesMetaRaw = JSON.parse(metaJson);
      } catch {
        filesMetaRaw = [];
      }
    }

    // Pre-validate all files
    let totalOrderSize = 0;
    const maxFileSizeBytes = parsedSettings.max_file_size_mb * 1024 * 1024;
    const maxTotalSizeBytes = 100 * 1024 * 1024; // 100MB order limit

    const validatedFiles: Array<{
      file: File;
      buffer: Buffer;
      mimeType: string;
      meta: {
        printColor: "BW" | "COLOR";
        paperSize: "A4" | "A3" | "LEGAL" | "LETTER";
        duplex: "SINGLE" | "DOUBLE";
        copies: number;
        customerRequirements: string;
      };
    }> = [];

    for (let i = 0; i < fileEntries.length; i++) {
      const file = fileEntries[i];
      if (file.size <= 0) {
        return NextResponse.json({ error: `File "${file.name}" is empty` }, { status: 400 });
      }

      if (file.size > maxFileSizeBytes) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the ${parsedSettings.max_file_size_mb}MB limit` },
          { status: 400 }
        );
      }

      totalOrderSize += file.size;
      if (totalOrderSize > maxTotalSizeBytes) {
        return NextResponse.json({ error: "Total order size exceeds the 100MB limit" }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Deep magic-bytes validation
      const validation = validateFileMagicBytes(buffer, file.name);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error || `Invalid file format: ${file.name}` }, { status: 400 });
      }

      const metaItem = filesMetaRaw[i] || {};
      validatedFiles.push({
        file,
        buffer,
        mimeType: validation.detectedMime,
        meta: {
          printColor: metaItem.printColor === "COLOR" ? "COLOR" : "BW",
          paperSize: (["A4", "A3", "LEGAL", "LETTER"].includes(metaItem.paperSize || "")
            ? metaItem.paperSize
            : "A4") as "A4" | "A3" | "LEGAL" | "LETTER",
          duplex: metaItem.duplex === "DOUBLE" ? "DOUBLE" : "SINGLE",
          copies: Math.min(Math.max(1, Number(metaItem.copies) || 1), 999),
          customerRequirements: (metaItem.customerRequirements || "").trim(),
        },
      });
    }

    // Generate Order identifiers
    const orderId = crypto.randomUUID();
    const publicOrderNumber = generateUniqueOrderNumber();
    const pickupPin = generatePickupPin(); // 6 digits
    const customerPinHash = await hashPin(pickupPin);
    const publicAccessToken = generateSecureToken(32);
    const publicAccessTokenHash = hashToken(publicAccessToken);
    const now = new Date().toISOString();

    // Physical storage of original untouched files
    const storedFiles: Array<{
      fileId: string;
      originalFilename: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      printColor: string;
      paperSize: string;
      duplex: string;
      copies: number;
      customerRequirements: string;
    }> = [];

    for (const item of validatedFiles) {
      const fileId = crypto.randomUUID();
      const stored = await saveOriginalFile(shop.id, orderId, item.file.name, item.buffer);
      storedFiles.push({
        fileId,
        originalFilename: item.file.name,
        storageKey: stored.storageKey,
        mimeType: item.mimeType,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        printColor: item.meta.printColor,
        paperSize: item.meta.paperSize,
        duplex: item.meta.duplex,
        copies: item.meta.copies,
        customerRequirements: item.meta.customerRequirements,
      });
    }

    // Atomic DB transaction
    db.exec("BEGIN TRANSACTION;");
    try {
      db.prepare(`
        INSERT INTO orders (
          id, shop_id, public_order_number, public_access_token, public_access_token_hash,
          customer_name, customer_phone, customer_pin_hash, customer_requirements,
          status, source, idempotency_key, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
      `).run(
        orderId,
        shop.id,
        publicOrderNumber,
        publicAccessToken,
        publicAccessTokenHash,
        customerName || null,
        customerPhone || null,
        customerPinHash,
        customerRequirements || null,
        orderSource,
        idempotencyKey,
        now
      );

      const fileStmt = db.prepare(`
        INSERT INTO order_files (
          id, order_id, shop_id, original_filename, storage_key, mime_type,
          size_bytes, sha256, print_color, paper_size, duplex, copies,
          customer_requirements, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `);

      for (const f of storedFiles) {
        fileStmt.run(
          f.fileId,
          orderId,
          shop.id,
          f.originalFilename,
          f.storageKey,
          f.mimeType,
          f.sizeBytes,
          f.sha256,
          f.printColor,
          f.paperSize,
          f.duplex,
          f.copies,
          f.customerRequirements || null,
          now
        );
      }

      db.exec("COMMIT;");
    } catch (dbErr) {
      db.exec("ROLLBACK;");
      throw dbErr;
    }

    // Audit log
    logAuditEvent({
      shopId: shop.id,
      action: "ORDER_CREATED",
      resourceType: "ORDER",
      resourceId: orderId,
      details: {
        publicOrderNumber,
        fileCount: storedFiles.length,
        customerName: customerName || "Anonymous",
      },
    });

    return NextResponse.json({
      success: true,
      orderNumber: publicOrderNumber,
      pickupPin, // Displayed on customer receipt once
      publicAccessToken,
      statusUrl: `/order/${publicAccessToken}`,
      documentCount: storedFiles.length,
      shopName: shop.name,
      createdAt: now,
    });
  } catch (err: unknown) {
    console.error("Order submission error:", err);
    return NextResponse.json({ error: "Failed to submit print order" }, { status: 500 });
  }
}
