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
      customer_name: string | null;
      status: string;
      pickup_verified_at: string | null;
    }

    const order = db.prepare(`
      SELECT id, shop_id, public_order_number, customer_name, status, pickup_verified_at
      FROM orders
      WHERE id = ? AND shop_id = ?
    `).get(id, auth.shop.id) as OrderRow | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Strict Handover Business Rules
    if (order.status !== "READY") {
      return NextResponse.json(
        { error: `Cannot complete order: Current status is ${order.status}. Order must be in READY state before handover.` },
        { status: 400 }
      );
    }

    if (!order.pickup_verified_at) {
      return NextResponse.json(
        {
          error: "Handover denied: Customer Pickup PIN has NOT been verified. The 6-digit PIN must be verified at the counter before completing the order.",
          requiresPinVerification: true,
        },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE orders
      SET status = 'COMPLETED', completed_at = ?, completed_by_user_id = ?
      WHERE id = ? AND shop_id = ?
    `).run(now, auth.user.id, order.id, auth.shop.id);

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "ORDER_COMPLETED",
      resourceType: "ORDER",
      resourceId: id,
      details: {
        publicOrderNumber: order.public_order_number,
        customerName: order.customer_name,
        completedAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Order ${order.public_order_number} marked as COMPLETED. Documents successfully handed over.`,
      status: "COMPLETED",
      completedAt: now,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Order complete error:", err);
    return NextResponse.json({ error: "Failed to complete order handover" }, { status: 500 });
  }
}
