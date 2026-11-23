import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/security";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireShopAuth(request);
    const { id } = await props.params;

    interface OrderRow {
      id: string;
      shop_id: string;
      public_order_number: string;
      status: string;
      customer_name: string | null;
    }

    const order = db.prepare(`
      SELECT id, shop_id, public_order_number, status, customer_name
      FROM orders
      WHERE id = ? AND shop_id = ?
    `).get(id, auth.shop.id) as OrderRow | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Explicit manual printing rule: Only PENDING, ACCEPTED or PRINT_FAILED can transition to PRINTING
    if (!["PENDING", "ACCEPTED", "PRINT_FAILED", "PRINTING"].includes(order.status)) {
      return NextResponse.json(
        { error: `Cannot print order: Current status is ${order.status}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    if (order.status !== "PRINTING") {
      db.prepare(`
        UPDATE orders
        SET status = 'PRINTING', printing_at = ?
        WHERE id = ? AND shop_id = ?
      `).run(now, order.id, auth.shop.id);

      logAuditEvent({
        shopId: auth.shop.id,
        userId: auth.user.id,
        action: "PRINT_STARTED",
        resourceType: "ORDER",
        resourceId: id,
        details: {
          publicOrderNumber: order.public_order_number,
          previousStatus: order.status,
          printedAt: now,
        },
      });
    }

    // Retrieve order files for printing
    interface FileRow {
      id: string;
      original_filename: string;
      mime_type: string;
      size_bytes: number;
      print_color: string;
      paper_size: string;
      duplex: string;
      copies: number;
      customer_requirements: string | null;
    }

    const files = db.prepare(`
      SELECT id, original_filename, mime_type, size_bytes, print_color, paper_size, duplex, copies, customer_requirements
      FROM order_files
      WHERE order_id = ? AND shop_id = ? AND status = 'ACTIVE'
    `).all(order.id, auth.shop.id) as unknown as FileRow[];

    return NextResponse.json({
      success: true,
      status: "PRINTING",
      orderNumber: order.public_order_number,
      files: files.map((f) => ({
        id: f.id,
        filename: f.original_filename,
        downloadUrl: `/api/orders/${order.id}/files/${f.id}/download`,
        previewUrl: `/api/orders/${order.id}/files/${f.id}/preview`,
        printColor: f.print_color,
        paperSize: f.paper_size,
        duplex: f.duplex,
        copies: f.copies,
        requirements: f.customer_requirements,
      })),
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Print order error:", err);
    return NextResponse.json({ error: "Failed to initiate print" }, { status: 500 });
  }
}
