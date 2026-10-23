import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { LoginSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 400 });
    }

    const { email, password } = parsed.data;

    interface UserRow {
      id: string;
      email: string;
      password_hash: string;
      name: string;
    }

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
    if (!user) {
      // Generic error response to prevent user enumeration
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = await verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Find user's shop membership
    interface MemberRow {
      shop_id: string;
      role: "SHOP_OWNER" | "SHOP_STAFF";
      shop_name: string;
      shop_slug: string;
      public_token: string;
    }

    const member = db.prepare(`
      SELECT sm.shop_id, sm.role, sh.name as shop_name, sh.slug as shop_slug, sh.public_token
      FROM shop_members sm
      JOIN shops sh ON sm.shop_id = sh.id
      WHERE sm.user_id = ?
      LIMIT 1
    `).get(user.id) as MemberRow | undefined;

    if (!member) {
      return NextResponse.json({ error: "No active shop associated with this account" }, { status: 403 });
    }

    // Create session
    const { sessionToken } = createSession(user.id, member.shop_id);

    logAuditEvent({
      shopId: member.shop_id,
      userId: user.id,
      action: "LOGIN_SUCCESS",
      resourceType: "AUTH",
      details: { email: user.email },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: member.role,
      },
      shop: {
        id: member.shop_id,
        name: member.shop_name,
        slug: member.shop_slug,
        publicToken: member.public_token,
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
    console.error("Login error:", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
