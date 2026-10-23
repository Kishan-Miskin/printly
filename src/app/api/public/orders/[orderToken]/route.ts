import { NextResponse } from "next/server";
import { queryOne, queryAll } from "@/lib/db";

export async function GET(
  request: Request,
  props: { params: Promise<{ orderToken: string }> }
) {
  try {
    const { orderToken } = await props.params;

    if (!orderToken) {
      return NextResponse.json({ error: "Missing order token" }, { status: 400 });
    }

    interface OrderDetailRow {
      id: string;
      public_order_number: string;
      customer_name: string | null;
      customer_requirements: string | null;
      status: string;
      created_at: string;
      accepted_at: string | null;
      printing_at: string | null;
      ready_at: string | null;
      completed_at: string | null;
      shop_name: string;
      shop_phone: string | null;
      shop_address: string | null;
      shop_hours: string | null;
    }

    const order = queryOne<OrderDetailRow>(`
      SELECT 
        o.id, o.public_order_number, o.customer_name, o.customer_requirements,
        o.status, o.created_at, o.accepted_at, o.printing_at, o.ready_at, o.completed_at,
        sh.name as shop_name, sh.phone as shop_phone, sh.address as shop_address, sh.hours as shop_hours
      FROM orders o
      JOIN shops sh ON o.shop_id = sh.id
      WHERE o.public_access_token = ?
    `, orderToken);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    interface FileSummaryRow {
      original_filename: string;
      mime_type: string;
      size_bytes: number;
      print_color: string;
      paper_size: string;
      duplex: string;
      copies: number;
      customer_requirements: string | null;
    }

    const files = queryAll<FileSummaryRow>(`
      SELECT original_filename, mime_type, size_bytes, print_color, paper_size, duplex, copies, customer_requirements
      FROM order_files
      WHERE order_id = ?
      ORDER BY created_at ASC
    `, order.id);

    return NextResponse.json({
      order: {
        orderNumber: order.public_order_number,
        status: order.status,
        customerName: order.customer_name,
        customerRequirements: order.customer_requirements,
        createdAt: order.created_at,
        acceptedAt: order.accepted_at,
        printingAt: order.printing_at,
        readyAt: order.ready_at,
        completedAt: order.completed_at,
        shop: {
          name: order.shop_name,
          phone: order.shop_phone,
          address: order.shop_address,
          hours: order.shop_hours,
        },
        files: files.map((f) => ({
          filename: f.original_filename,
          mimeType: f.mime_type,
          sizeBytes: f.size_bytes,
          printColor: f.print_color,
          paperSize: f.paper_size,
          duplex: f.duplex,
          copies: f.copies,
          requirements: f.customer_requirements,
        })),
      },
    });
  } catch (err: unknown) {
    console.error("Public order status fetch error:", err);
    return NextResponse.json({ error: "Failed to load order status" }, { status: 500 });
  }
}
