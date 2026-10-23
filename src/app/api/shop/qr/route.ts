import { NextResponse } from "next/server";
import QRCode from "qrcode";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const auth = requireShopAuth(request);

    interface ShopQRInfo {
      id: string;
      name: string;
      slug: string;
      public_token: string;
    }

    const shop = db.prepare("SELECT id, name, slug, public_token FROM shops WHERE id = ?").get(auth.shop.id) as
      | ShopQRInfo
      | undefined;

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const publicUrl = `${protocol}://${host}/p/${shop.public_token}`;

    // Generate high-resolution QR PNG Data URL
    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 600,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    });

    // Generate SVG string for vector printing
    const qrSvg = await QRCode.toString(publicUrl, {
      type: "svg",
      margin: 2,
      errorCorrectionLevel: "H",
    });

    return NextResponse.json({
      shopName: shop.name,
      publicToken: shop.public_token,
      publicUrl,
      qrDataUrl,
      qrSvg,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("QR generation error:", err);
    return NextResponse.json({ error: "Failed to generate shop QR code" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireShopAuth(request);

    if (auth.role !== "SHOP_OWNER") {
      return NextResponse.json({ error: "Forbidden: Only shop owner can regenerate QR codes" }, { status: 403 });
    }

    const newToken = crypto.randomBytes(8).toString("hex");
    const now = new Date().toISOString();

    db.exec("BEGIN TRANSACTION;");
    try {
      // Deactivate old QR records
      db.prepare("UPDATE shop_qr_codes SET is_active = 0 WHERE shop_id = ?").run(auth.shop.id);

      // Insert new QR record
      db.prepare(`
        INSERT INTO shop_qr_codes (id, shop_id, token, is_active, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(crypto.randomUUID(), auth.shop.id, newToken, now);

      // Update shop's active token
      db.prepare("UPDATE shops SET public_token = ?, updated_at = ? WHERE id = ?").run(newToken, now, auth.shop.id);

      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      throw err;
    }

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "QR_REGENERATED",
      resourceType: "SHOP_QR",
      details: { previousToken: auth.shop.public_token, newToken },
    });

    return NextResponse.json({
      success: true,
      newToken,
      message: "QR code regenerated successfully. Please print a new counter poster.",
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("QR regeneration error:", err);
    return NextResponse.json({ error: "Failed to regenerate QR code" }, { status: 500 });
  }
}
