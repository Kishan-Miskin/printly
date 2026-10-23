import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { OrderStatusUpdateSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/security";

// Strict allowed transition map
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PRINTING", "CANCELLED"],
  PRINTING: ["READY", "CANCELLED"],
  READY: ["CANCELLED"], // NOTE: READY -> COMPLETED is handled exclusively by /complete endpoint after PIN verification
  COMPLETED: [], // Terminal state
  REJECTED: [],  // Terminal state
  CANCELLED: [], // Terminal state
};

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireShopAuth(request);
    const { id } = await props.params;

    const body = await request.json();
    const parsed = OrderStatusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { status: nextStatus } = parsed.data;

    interface OrderRow {
      id: string;
      shop_id: string;
      status: string;
      public_order_number: string;
    }

    const order = db.prepare("SELECT id, shop_id, status, public_order_number FROM orders WHERE id = ? AND shop_id = ?").get(
      id,
      auth.shop.id
    ) as OrderRow | undefined;

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const currentStatus = order.status;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: Cannot change order ${order.public_order_number} from ${currentStatus} to ${nextStatus}.`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let timestampField = "";

    if (nextStatus === "ACCEPTED") timestampField = ", accepted_at = ?";
    else if (nextStatus === "PRINTING") timestampField = ", printing_at = ?";
    else if (nextStatus === "READY") timestampField = ", ready_at = ?";

    const sql = `UPDATE orders SET status = ? ${timestampField} WHERE id = ? AND shop_id = ?`;
    const params = timestampField ? [nextStatus, now, id, auth.shop.id] : [nextStatus, id, auth.shop.id];

    db.prepare(sql).run(...params);

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: `ORDER_${nextStatus}`,
      resourceType: "ORDER",
      resourceId: id,
      details: {
        from: currentStatus,
        to: nextStatus,
        publicOrderNumber: order.public_order_number,
      },
    });

    return NextResponse.json({
      success: true,
      currentStatus: nextStatus,
      message: `Order status updated to ${nextStatus}`,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Update status error:", err);
    return NextResponse.json({ error: "Failed to update order status" }, { status: 500 });
  }
}
