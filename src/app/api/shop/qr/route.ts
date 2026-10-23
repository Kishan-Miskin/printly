import { NextResponse } from "next/server";
import QRCode from "qrcode";
import crypto from "node:crypto";
import os from "node:os";
import { db } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/security";

function getLocalLanIps(): Array<{ name: string; address: string; isWifi: boolean }> {
  const ifaces = os.networkInterfaces();
  const list: Array<{ name: string; address: string; isWifi: boolean }> = [];

  for (const name of Object.keys(ifaces)) {
    const entries = ifaces[name];
    if (!entries) continue;
    for (const net of entries) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254.")) {
        const isWifi = name.toLowerCase().includes("wi-fi") || name.toLowerCase().includes("wlan");
        list.push({ name, address: net.address, isWifi });
      }
    }
  }

  // Sort so Wi-Fi is first, then standard private subnets
  list.sort((a, b) => {
    if (a.isWifi && !b.isWifi) return -1;
    if (!a.isWifi && b.isWifi) return 1;
    return 0;
  });

  return list;
}

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

    const urlObj = new URL(request.url);
    const customHost = urlObj.searchParams.get("customHost")?.trim();

    const requestHost = request.headers.get("host") || "localhost:3000";
    const port = requestHost.includes(":") ? requestHost.split(":")[1] : "3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";

    const lanIps = getLocalLanIps();
    const primaryLanIp = lanIps[0]?.address || "127.0.0.1";

    let targetHost = requestHost;

    if (customHost) {
      // User explicitly set custom host or domain
      targetHost = customHost;
    } else if (requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1")) {
      // Automatic Wi-Fi IP replacement for phone scanning!
      // A phone scanning a localhost QR code cannot resolve localhost.
      if (primaryLanIp && primaryLanIp !== "127.0.0.1") {
        targetHost = `${primaryLanIp}:${port}`;
      }
    }

    // Build the public customer URL
    const publicUrl = targetHost.startsWith("http://") || targetHost.startsWith("https://")
      ? `${targetHost.replace(/\/$/, "")}/p/${shop.public_token}`
      : `${protocol}://${targetHost}/p/${shop.public_token}`;

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
      targetHost,
      primaryLanIp,
      port,
      lanIps,
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
      db.prepare("UPDATE shop_qr_codes SET is_active = 0 WHERE shop_id = ?").run(auth.shop.id);
      db.prepare(`
        INSERT INTO shop_qr_codes (id, shop_id, token, is_active, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(crypto.randomUUID(), auth.shop.id, newToken, now);
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
