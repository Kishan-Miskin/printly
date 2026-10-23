import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    await ensureSeedData();
    const { token } = await props.params;

    if (!token) {
      return NextResponse.json({ error: "Missing shop token" }, { status: 400 });
    }

    interface PublicShopRow {
      id: string;
      name: string;
      phone: string | null;
      address: string | null;
      hours: string | null;
      is_open: number;
      public_token: string;
      settings: string;
    }

    const shop = db.prepare(`
      SELECT id, name, phone, address, hours, is_open, public_token, settings
      FROM shops
      WHERE public_token = ?
    `).get(token) as PublicShopRow | undefined;

    if (!shop) {
      return NextResponse.json({ error: "Shop not found or invalid QR code" }, { status: 404 });
    }

    let parsedSettings = {
      retention_hours: 24,
      max_file_size_mb: 20,
      max_files_per_order: 10,
      allowed_formats: ["pdf", "jpg", "jpeg", "png", "docx"],
    };

    try {
      parsedSettings = { ...parsedSettings, ...JSON.parse(shop.settings) };
    } catch {
      // Use defaults
    }

    // Only return safe customer-facing data
    return NextResponse.json({
      shop: {
        name: shop.name,
        phone: shop.phone,
        address: shop.address,
        hours: shop.hours,
        isOpen: shop.is_open === 1,
        publicToken: shop.public_token,
        settings: {
          maxFileSizeMb: parsedSettings.max_file_size_mb,
          maxFilesPerOrder: parsedSettings.max_files_per_order,
          allowedFormats: parsedSettings.allowed_formats,
          paperOptions: ["A4", "A3", "Legal", "Letter"],
          colorOptions: ["Black & White", "Color"],
          duplexOptions: ["Single-sided", "Double-sided"],
        },
      },
    });
  } catch (err: unknown) {
    console.error("Public shop fetch error:", err);
    return NextResponse.json({ error: "Failed to load shop information" }, { status: 500 });
  }
}
