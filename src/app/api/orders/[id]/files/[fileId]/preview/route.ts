import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { readOriginalFile } from "@/lib/storage";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const auth = requireShopAuth(request);
    const { id: orderId, fileId } = await props.params;

    interface FileCheck {
      id: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      size_bytes: number;
      status: string;
    }

    const file = db.prepare(`
      SELECT id, original_filename, storage_key, mime_type, size_bytes, status
      FROM order_files
      WHERE id = ? AND order_id = ? AND shop_id = ?
    `).get(fileId, orderId, auth.shop.id) as FileCheck | undefined;

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.status === "DELETED") {
      return NextResponse.json({ error: "File has been deleted" }, { status: 410 });
    }

    const buffer = await readOriginalFile(auth.shop.id, file.storage_key);
    const safeFilename = encodeURIComponent(file.original_filename);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Content-Length": buffer.length.toString(),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Preview error:", err);
    return NextResponse.json({ error: "Failed to preview file" }, { status: 500 });
  }
}
