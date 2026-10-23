import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { readOriginalFile } from "@/lib/storage";
import { calculateSha256, logAuditEvent } from "@/lib/security";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = requireShopAuth(request);
    const { id: orderId, fileId } = await props.params;

    // Verify order belongs to authenticated shop
    interface OrderCheck {
      id: string;
      shop_id: string;
      public_order_number: string;
    }

    const order = db.prepare("SELECT id, shop_id, public_order_number FROM orders WHERE id = ? AND shop_id = ?").get(
      orderId,
      auth.shop.id
    ) as OrderCheck | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Verify file belongs to order and shop
    interface FileCheck {
      id: string;
      order_id: string;
      shop_id: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      size_bytes: number;
      sha256: string;
      status: string;
    }

    const file = db.prepare(`
      SELECT id, order_id, shop_id, original_filename, storage_key, mime_type, size_bytes, sha256, status
      FROM order_files
      WHERE id = ? AND order_id = ? AND shop_id = ?
    `).get(fileId, orderId, auth.shop.id) as FileCheck | undefined;

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.status === "DELETED") {
      return NextResponse.json({ error: "This file has been deleted per retention policy" }, { status: 410 });
    }

    // Read physical file from private storage
    const buffer = await readOriginalFile(auth.shop.id, file.storage_key);

    // Cryptographic verification: ensure disk bytes match recorded SHA-256
    const currentSha256 = calculateSha256(buffer);
    if (currentSha256 !== file.sha256) {
      console.error(`Integrity mismatch on file ${file.id}! Expected ${file.sha256}, got ${currentSha256}`);
      return NextResponse.json({ error: "Document integrity check failed: File appears tampered or corrupt" }, { status: 500 });
    }

    // Audit log file access
    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "FILE_DOWNLOADED",
      resourceType: "FILE",
      resourceId: file.id,
      details: {
        originalFilename: file.original_filename,
        orderNumber: order.public_order_number,
        sha256: file.sha256,
        sizeBytes: file.size_bytes,
      },
    });

    const safeFilename = encodeURIComponent(file.original_filename);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
        "Content-Length": buffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("File download error:", err);
    return NextResponse.json({ error: "Failed to download original document" }, { status: 500 });
  }
}
