import { NextResponse } from "next/server";
import { queryOne, execute, BindParam } from "@/lib/db";
import { requireShopAuth } from "@/lib/auth";
import { UpdateShopSchema } from "@/lib/validation";
import { logAuditEvent } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const auth = requireShopAuth(request);

    interface ShopDetails {
      id: string;
      name: string;
      slug: string;
      phone: string | null;
      address: string | null;
      hours: string | null;
      is_open: number;
      public_token: string;
      settings: string;
      created_at: string;
    }

    const shop = queryOne<ShopDetails>(`
      SELECT id, name, slug, phone, address, hours, is_open, public_token, settings, created_at
      FROM shops WHERE id = ?
    `, auth.shop.id);

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    let parsedSettings = {};
    try {
      parsedSettings = JSON.parse(shop.settings);
    } catch {}

    return NextResponse.json({
      shop: {
        ...shop,
        is_open: shop.is_open === 1,
        settings: parsedSettings,
      },
      role: auth.role,
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Get shop error:", err);
    return NextResponse.json({ error: "Failed to load shop settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = requireShopAuth(request);

    if (auth.role !== "SHOP_OWNER") {
      return NextResponse.json({ error: "Forbidden: Only shop owner can modify shop settings" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = UpdateShopSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updates: string[] = [];
    const params: BindParam[] = [];

    if (parsed.data.name !== undefined) {
      updates.push("name = ?");
      params.push(parsed.data.name);
    }
    if (parsed.data.phone !== undefined) {
      updates.push("phone = ?");
      params.push(parsed.data.phone);
    }
    if (parsed.data.address !== undefined) {
      updates.push("address = ?");
      params.push(parsed.data.address);
    }
    if (parsed.data.hours !== undefined) {
      updates.push("hours = ?");
      params.push(parsed.data.hours);
    }
    if (parsed.data.is_open !== undefined) {
      updates.push("is_open = ?");
      params.push(parsed.data.is_open ? 1 : 0);
    }
    if (parsed.data.settings !== undefined) {
      // Merge with existing settings
      const current = queryOne<{ settings: string }>("SELECT settings FROM shops WHERE id = ?", auth.shop.id);
      let currentSettings = {};
      try {
        currentSettings = JSON.parse(current?.settings || "{}");
      } catch {}
      const merged = JSON.stringify({ ...currentSettings, ...parsed.data.settings });
      updates.push("settings = ?");
      params.push(merged);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes provided" });
    }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());

    params.push(auth.shop.id);

    execute(`UPDATE shops SET ${updates.join(", ")} WHERE id = ?`, ...params);

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "SHOP_SETTINGS_UPDATED",
      resourceType: "SHOP",
      resourceId: auth.shop.id,
      details: body,
    });

    return NextResponse.json({ success: true, message: "Shop settings updated" });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Update shop error:", err);
    return NextResponse.json({ error: "Failed to update shop settings" }, { status: 500 });
  }
}
