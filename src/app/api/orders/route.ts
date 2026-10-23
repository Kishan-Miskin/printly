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
      orders: rows,
      counts: statusCounts,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Fetch orders error:", err);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
