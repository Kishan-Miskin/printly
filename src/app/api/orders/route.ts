import { NextResponse } from "next/server";
import { queryAll, BindParam } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export async function GET(request: Request) {
  try {
    await ensureSeedData();
    const auth = requireShopAuth(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.toUpperCase();
    const query = searchParams.get("q")?.trim();

    let sql = `
      SELECT 
        o.id, o.public_order_number, o.customer_name, o.customer_phone,
        o.customer_requirements, o.status, o.created_at, o.accepted_at,
        o.printing_at, o.ready_at, o.pickup_verified_at, o.completed_at,
        COUNT(f.id) as file_count,
        SUM(f.copies) as total_copies
      FROM orders o
      LEFT JOIN order_files f ON o.id = f.order_id
      WHERE o.shop_id = ?
    `;
    const params: BindParam[] = [auth.shop.id];

    if (status && status !== "ALL") {
      sql += " AND o.status = ?";
      params.push(status);
    }

    if (query) {
      sql += " AND (o.public_order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)";
      const pattern = `%${query}%`;
      params.push(pattern, pattern, pattern);
    }

    sql += " GROUP BY o.id ORDER BY o.created_at DESC LIMIT 100";

    const rows = queryAll(sql, ...params);

    // Attach file details to each order for immediate shopkeeper queue display
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderIds = rows.map((r: any) => r.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filesByOrder: Record<string, any[]> = {};
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => "?").join(",");
      const allFiles = queryAll(`
        SELECT id, order_id, original_filename, mime_type, size_bytes, print_color, paper_size, duplex, copies, customer_requirements
        FROM order_files
        WHERE order_id IN (${placeholders}) AND status = 'ACTIVE'
      `, ...orderIds);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of allFiles as any[]) {
        if (!filesByOrder[f.order_id]) filesByOrder[f.order_id] = [];
        filesByOrder[f.order_id].push({
          id: f.id,
          originalFilename: f.original_filename,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes,
          printColor: f.print_color,
          paperSize: f.paper_size,
          duplex: f.duplex,
          copies: f.copies,
          requirements: f.customer_requirements,
          downloadUrl: `/api/orders/${f.order_id}/files/${f.id}/download`,
          previewUrl: `/api/orders/${f.order_id}/files/${f.id}/preview`,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ordersWithFiles = rows.map((r: any) => ({
      ...r,
      files: filesByOrder[r.id] || [],
    }));

    // Also get quick status count summaries for the dashboard tabs
    interface CountRow {
      status: string;
      cnt: number;
    }
    const counts = queryAll<CountRow>(`
      SELECT status, COUNT(*) as cnt
      FROM orders
      WHERE shop_id = ?
      GROUP BY status
    `, auth.shop.id);

    const statusCounts: Record<string, number> = {
      ALL: 0,
      PENDING: 0,
      ACCEPTED: 0,
      PRINTING: 0,
      READY: 0,
      COMPLETED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };

    counts.forEach((c) => {
      statusCounts[c.status] = c.cnt;
      statusCounts.ALL += c.cnt;
    });

    return NextResponse.json({
      orders: ordersWithFiles,
      counts: statusCounts,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Fetch orders error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
