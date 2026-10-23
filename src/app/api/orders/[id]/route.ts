import { NextResponse } from "next/server";
import { queryOne, queryAll } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";

export async function GET(
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
      customer_phone: string | null;
      customer_requirements: string | null;
      status: string;
      created_at: string;
      accepted_at: string | null;
      printing_at: string | null;
      ready_at: string | null;
      pickup_verified_at: string | null;
      completed_at: string | null;
      completed_by_user_id: string | null;
    }

    // IDOR protection: strictly enforce shop_id match
    const order = queryOne<OrderRow>(`
      SELECT * FROM orders
      WHERE id = ? AND shop_id = ?
    `, id, auth.shop.id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    interface FileRow {
      id: string;
      order_id: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      size_bytes: number;
      sha256: string;
      print_color: string;
      paper_size: string;
      duplex: string;
      copies: number;
      customer_requirements: string | null;
      status: string;
      created_at: string;
    }

    const files = queryAll<FileRow>(`
      SELECT * FROM order_files
      WHERE order_id = ? AND shop_id = ?
      ORDER BY created_at ASC
    `, order.id, auth.shop.id);

    // Pickup verification logs
    interface VerificationRow {
      id: string;
      attempt_count: number;
      result: string;
      verified_at: string;
      user_name: string | null;
    }

    const verifications = queryAll<VerificationRow>(`
      SELECT pv.id, pv.attempt_count, pv.result, pv.verified_at, u.name as user_name
      FROM pickup_verifications pv
      LEFT JOIN users u ON pv.verified_by_user_id = u.id
      WHERE pv.order_id = ? AND pv.shop_id = ?
      ORDER BY pv.verified_at DESC
    `, order.id, auth.shop.id);

    return NextResponse.json({
      order: {
        id: order.id,
        publicOrderNumber: order.public_order_number,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerRequirements: order.customer_requirements,
        status: order.status,
        createdAt: order.created_at,
        acceptedAt: order.accepted_at,
        printingAt: order.printing_at,
        readyAt: order.ready_at,
        pickupVerifiedAt: order.pickup_verified_at,
        completedAt: order.completed_at,
        isPickupVerified: Boolean(order.pickup_verified_at),
        files: files.map((f) => ({
          id: f.id,
          originalFilename: f.original_filename,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes,
          sha256: f.sha256,
          printColor: f.print_color,
          paperSize: f.paper_size,
          duplex: f.duplex,
          copies: f.copies,
          requirements: f.customer_requirements,
          status: f.status,
          downloadUrl: `/api/orders/${order.id}/files/${f.id}/download`,
          previewUrl: `/api/orders/${order.id}/files/${f.id}/preview`,
        })),
        verifications,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Order detail error:", err);
    return NextResponse.json({ error: "Failed to load order details" }, { status: 500 });
  }
}
