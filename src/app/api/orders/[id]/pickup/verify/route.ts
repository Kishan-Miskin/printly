import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { queryOne, queryAll, execute } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { PickupVerifySchema } from "@/lib/validation";
import { verifyPin, checkPickupRateLimit, logAuditEvent } from "@/lib/security";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireShopAuth(request);
    const { id } = await props.params;

    const body = await request.json();
    const parsed = PickupVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Pickup PIN must be exactly 6 digits" }, { status: 400 });
    }

    const { pin } = parsed.data;

    interface OrderRow {
      id: string;
      shop_id: string;
      public_order_number: string;
      customer_name: string | null;
      customer_pin_hash: string;
      status: string;
      pickup_verified_at: string | null;
    }

    const order = queryOne<OrderRow>(`
      SELECT id, shop_id, public_order_number, customer_name, customer_pin_hash, status, pickup_verified_at
      FROM orders
      WHERE id = ? AND shop_id = ?
    `, id, auth.shop.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Rate-limit check: max 5 failed attempts in 15 minutes
    const rateLimit = checkPickupRateLimit(order.id);
    if (rateLimit.isLocked) {
      logAuditEvent({
        shopId: auth.shop.id,
        userId: auth.user.id,
        action: "PICKUP_VERIFICATION_LOCKED",
        resourceType: "ORDER",
        resourceId: id,
        details: { publicOrderNumber: order.public_order_number, failedAttempts: rateLimit.failedAttempts },
      });

      return NextResponse.json(
        {
          error: "Pickup verification temporarily locked due to 5 consecutive failed attempts. Please try again after 15 minutes or verify identity via shop owner.",
          isLocked: true,
        },
        { status: 429 }
      );
    }

    // Secure PIN verification using bcrypt
    const isValidPin = await verifyPin(pin, order.customer_pin_hash);
    const now = new Date().toISOString();
    const verificationId = crypto.randomUUID();
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "unknown";

    if (!isValidPin) {
      // Record failed attempt
      execute(`
        INSERT INTO pickup_verifications (id, order_id, shop_id, verified_by_user_id, attempt_count, result, verified_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, 'FAILED', ?, ?, ?)
      `, verificationId, order.id, auth.shop.id, auth.user.id, rateLimit.failedAttempts + 1, now, ip, userAgent);

      logAuditEvent({
        shopId: auth.shop.id,
        userId: auth.user.id,
        action: "PICKUP_VERIFICATION_FAILED",
        resourceType: "ORDER",
        resourceId: id,
        details: { publicOrderNumber: order.public_order_number, remainingAttempts: rateLimit.remainingAttempts - 1 },
      });

      return NextResponse.json(
        {
          verified: false,
          error: "Incorrect pickup PIN. Please check with customer.",
          remainingAttempts: Math.max(0, rateLimit.remainingAttempts - 1),
        },
        { status: 400 }
      );
    }

    // PIN is correct!
    // Record successful verification
    execute(`
      INSERT INTO pickup_verifications (id, order_id, shop_id, verified_by_user_id, attempt_count, result, verified_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?)
    `, verificationId, order.id, auth.shop.id, auth.user.id, 1, now, ip, userAgent);

    // Update order with verified timestamp
    execute(`
      UPDATE orders
      SET pickup_verified_at = ?
      WHERE id = ? AND shop_id = ?
    `, now, order.id, auth.shop.id);

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "PICKUP_VERIFICATION_SUCCESS",
      resourceType: "ORDER",
      resourceId: id,
      details: { publicOrderNumber: order.public_order_number, customerName: order.customer_name },
    });

    // Fetch order documents for handover checklist
    interface FileSummary {
      id: string;
      original_filename: string;
      copies: number;
      print_color: string;
      paper_size: string;
      duplex: string;
      customer_requirements: string | null;
    }

    const files = queryAll<FileSummary>(`
      SELECT id, original_filename, copies, print_color, paper_size, duplex, customer_requirements
      FROM order_files
      WHERE order_id = ? AND shop_id = ?
    `, order.id, auth.shop.id);

    return NextResponse.json({
      verified: true,
      message: "Customer verified successfully",
      publicOrderNumber: order.public_order_number,
      customerName: order.customer_name,
      verifiedAt: now,
      documents: files.map((f) => ({
        id: f.id,
        filename: f.original_filename,
        copies: f.copies,
        printColor: f.print_color,
        paperSize: f.paper_size,
        duplex: f.duplex,
        requirements: f.customer_requirements,
      })),
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Pickup verify error:", err);
    return NextResponse.json({ error: "Failed to verify pickup PIN" }, { status: 500 });
  }
}
