import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const auth = requireShopAuth(request);

    interface AuditRow {
      id: string;
      action: string;
      resource_type: string;
      resource_id: string | null;
      details: string | null;
      ip_address: string | null;
      created_at: string;
      user_name: string | null;
      user_email: string | null;
    }

    const logs = queryAll<AuditRow>(`
      SELECT 
        a.id, a.action, a.resource_type, a.resource_id, a.details, a.ip_address, a.created_at,
        u.name as user_name, u.email as user_email
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.shop_id = ?
      ORDER BY a.created_at DESC
      LIMIT 100
    `, auth.shop.id);

    return NextResponse.json({ logs });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Audit logs error:", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
