import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword, createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { RegisterShopSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RegisterShopSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, password, name, shopName, phone, address } = parsed.data;

    // Check if user already exists
    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
    if (existingUser) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const userId = crypto.randomUUID();
    const shopId = crypto.randomUUID();
    const qrId = crypto.randomUUID();
    const now = new Date().toISOString();

    const passwordHash = await hashPassword(password);
    const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + crypto.randomBytes(3).toString("hex");
    const publicToken = crypto.randomBytes(8).toString("hex");

    const defaultSettings = JSON.stringify({
      retention_hours: 24,
      auto_accept: false,
      max_file_size_mb: 20,
      max_files_per_order: 10,
      allowed_formats: ["pdf", "jpg", "jpeg", "png", "docx"],
    });

    // Execute atomic transaction for new shop setup
    db.exec("BEGIN TRANSACTION;");
    try {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email.toLowerCase(), passwordHash, name, now, now);

      db.prepare(`
        INSERT INTO shops (id, name, slug, phone, address, hours, is_open, public_token, settings, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(shopId, shopName, slug, phone || null, address || null, "9:00 AM - 8:00 PM", publicToken, defaultSettings, now, now);

      db.prepare(`
        INSERT INTO shop_members (id, shop_id, user_id, role, created_at)
        VALUES (?, ?, ?, 'SHOP_OWNER', ?)
      `).run(crypto.randomUUID(), shopId, userId, now);

      db.prepare(`
        INSERT INTO shop_qr_codes (id, shop_id, token, is_active, created_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(qrId, shopId, publicToken, now);

      db.exec("COMMIT;");
    } catch (txErr) {
      db.exec("ROLLBACK;");
      throw txErr;
    }

    // Create session
    const { sessionToken } = createSession(userId, shopId);

    logAuditEvent({
      shopId,
      userId,
      action: "REGISTER_SHOP",
      resourceType: "SHOP",
      resourceId: shopId,
      details: { shopName, email },
    });

    const response = NextResponse.json({
      success: true,
      shop: {
        id: shopId,
        name: shopName,
        slug,
        publicToken,
      },
      user: {
        id: userId,
        email,
        name,
        role: "SHOP_OWNER",
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    console.error("Register error:", err);
    return NextResponse.json({ error: "Failed to create shop account" }, { status: 500 });
  }
}
