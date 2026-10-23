import { NextResponse } from "next/server";
import { extractTokenFromRequest, resolveSession } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export async function GET(request: Request) {
  try {
    // Ensure demo seed data exists
    await ensureSeedData();

    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null, shop: null }, { status: 401 });
    }

    const auth = resolveSession(token);
    if (!auth) {
      return NextResponse.json({ authenticated: false, user: null, shop: null }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: auth.user,
      shop: auth.shop,
      role: auth.role,
    });
  } catch (err: unknown) {
    console.error("Auth me error:", err);
    return NextResponse.json({ authenticated: false, user: null, shop: null }, { status: 500 });
  }
}
