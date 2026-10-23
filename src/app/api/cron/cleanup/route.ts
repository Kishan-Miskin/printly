import { NextResponse } from "next/server";
import { db, queryAll, execute } from "@/lib/db";
import { deletePhysicalFile } from "@/lib/storage";
import { logAuditEvent } from "@/lib/security";

export async function POST(request: Request) {
  try {
    // Optional bearer secret token for cron triggers in production
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    interface ExpiredFileRow {
      file_id: string;
      order_id: string;
      shop_id: string;
      storage_key: string;
      original_filename: string;
      order_status: string;
    }

    // Find active files belonging to completed orders older than 24h OR cancelled/rejected older than 48h
    const expiredFiles = queryAll<ExpiredFileRow>(`
      SELECT 
        f.id as file_id, f.order_id, f.shop_id, f.storage_key, f.original_filename,
        o.status as order_status
      FROM order_files f
      JOIN orders o ON f.order_id = o.id
      WHERE f.status = 'ACTIVE' AND (
        (o.status = 'COMPLETED' AND o.completed_at <= ?) OR
        (o.status IN ('CANCELLED', 'REJECTED') AND o.created_at <= ?)
      )
      LIMIT 200
    `, twentyFourHoursAgo, fortyEightHoursAgo);

    let deletedCount = 0;
    const nowIso = now.toISOString();

    for (const file of expiredFiles) {
      // 1. Delete physical file from storage
      await deletePhysicalFile(file.shop_id, file.storage_key);

      // 2. Mark database record as DELETED
      execute(`
        UPDATE order_files 
        SET status = 'DELETED', deleted_at = ?
        WHERE id = ?
      `, nowIso, file.file_id);

      logAuditEvent({
        shopId: file.shop_id,
        action: "FILE_CLEANUP_DELETED",
        resourceType: "FILE",
        resourceId: file.file_id,
        details: {
          originalFilename: file.original_filename,
          orderId: file.order_id,
          orderStatus: file.order_status,
        },
      });

      deletedCount++;
    }

    return NextResponse.json({
      success: true,
      deletedFilesCount: deletedCount,
      timestamp: nowIso,
    });
  } catch (err: unknown) {
    console.error("Cleanup cron error:", err);
    return NextResponse.json({ error: "Failed to run retention cleanup" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
