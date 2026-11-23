import React from "react";
import { queryOne, queryAll } from "@/lib/db";
import OrderStatusClient, { PublicOrderData } from "./OrderStatusClient";

export default async function CustomerOrderStatusPage({
  params,
}: {
  params: Promise<{ orderToken: string }>;
}) {
  const { orderToken } = await params;

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

  const orderRow = queryOne<OrderDetailRow>(`
    SELECT 
      o.id, o.public_order_number, o.customer_name, o.customer_requirements,
      o.status, o.created_at, o.accepted_at, o.printing_at, o.ready_at, o.completed_at,
      sh.name as shop_name, sh.phone as shop_phone, sh.address as shop_address, sh.hours as shop_hours
    FROM orders o
    JOIN shops sh ON o.shop_id = sh.id
    WHERE o.public_access_token = ?
  `, orderToken);

  let initialOrder: PublicOrderData | null = null;

  if (orderRow) {
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
    `, orderRow.id);

    initialOrder = {
      orderNumber: orderRow.public_order_number,
      status: orderRow.status as PublicOrderData["status"],
      customerName: orderRow.customer_name,
      customerRequirements: orderRow.customer_requirements,
      createdAt: orderRow.created_at,
      acceptedAt: orderRow.accepted_at,
      printingAt: orderRow.printing_at,
      readyAt: orderRow.ready_at,
      completedAt: orderRow.completed_at,
      shop: {
        name: orderRow.shop_name,
        phone: orderRow.shop_phone,
        address: orderRow.shop_address,
        hours: orderRow.shop_hours,
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
    };
  }

  return <OrderStatusClient orderToken={orderToken} initialOrder={initialOrder} />;
}
