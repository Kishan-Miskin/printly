import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { db, queryOne, queryAll, execute } from "@/lib/db";
import { requireShopAuth, hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/security";

export async function GET(request: Request) {
  try {
    const auth = requireShopAuth(request);

    interface StaffRow {
      membership_id: string;
      user_id: string;
      name: string;
      email: string;
      role: string;
      created_at: string;
    }

    const staff = queryAll<StaffRow>(`
      SELECT sm.id as membership_id, sm.user_id, u.name, u.email, sm.role, sm.created_at
      FROM shop_members sm
      JOIN users u ON sm.user_id = u.id
      WHERE sm.shop_id = ?
      ORDER BY sm.role DESC, sm.created_at ASC
    `, auth.shop.id);

    return NextResponse.json({ staff });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("List staff error:", err);
    return NextResponse.json({ error: "Failed to list staff" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = requireShopAuth(request);

    if (auth.role !== "SHOP_OWNER") {
      return NextResponse.json({ error: "Forbidden: Only shop owner can add staff members" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Name, email, and initial password are required" }, { status: 400 });
    }

    const assignedRole = role === "SHOP_OWNER" ? "SHOP_OWNER" : "SHOP_STAFF";
    const now = new Date().toISOString();

    interface ExistingUser {
      id: string;
      email: string;
    }

    let user = queryOne<ExistingUser>("SELECT id, email FROM users WHERE email = ?", email.toLowerCase());
    let userId = user?.id;

    db.exec("BEGIN TRANSACTION;");
    try {
      if (!user) {
        userId = crypto.randomUUID();
        const passwordHash = await hashPassword(password);
        execute(`
          INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, userId, email.toLowerCase(), passwordHash, name, now, now);
      }

      if (!userId) {
        throw new Error("Failed to resolve user ID");
      }

      // Check if already member
      const existingMember = queryOne("SELECT id FROM shop_members WHERE shop_id = ? AND user_id = ?", auth.shop.id, userId);

      if (existingMember) {
        db.exec("ROLLBACK;");
        return NextResponse.json({ error: "This user is already a member of this shop" }, { status: 409 });
      }

      const membershipId = crypto.randomUUID();
      execute(`
        INSERT INTO shop_members (id, shop_id, user_id, role, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, membershipId, auth.shop.id, userId, assignedRole, now);

      db.exec("COMMIT;");
    } catch (txErr) {
      db.exec("ROLLBACK;");
      throw txErr;
    }

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "STAFF_ADDED",
      resourceType: "STAFF",
      resourceId: userId,
      details: { email, role: assignedRole },
    });

    return NextResponse.json({ success: true, message: `Staff member ${name} added successfully` });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Add staff error:", err);
    return NextResponse.json({ error: "Failed to add staff member" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = requireShopAuth(request);

    if (auth.role !== "SHOP_OWNER") {
      return NextResponse.json({ error: "Forbidden: Only shop owner can remove staff members" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const membershipId = searchParams.get("id");

    if (!membershipId) {
      return NextResponse.json({ error: "Missing membership id" }, { status: 400 });
    }

    interface TargetMember {
      user_id: string;
      role: string;
    }

    const target = queryOne<TargetMember>("SELECT user_id, role FROM shop_members WHERE id = ? AND shop_id = ?", membershipId, auth.shop.id);

    if (!target) {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }

    if (target.user_id === auth.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself from your own shop" }, { status: 400 });
    }

    execute("DELETE FROM shop_members WHERE id = ? AND shop_id = ?", membershipId, auth.shop.id);

    logAuditEvent({
      shopId: auth.shop.id,
      userId: auth.user.id,
      action: "STAFF_REMOVED",
      resourceType: "STAFF",
      resourceId: target.user_id,
    });

    return NextResponse.json({ success: true, message: "Staff member removed" });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    console.error("Delete staff error:", err);
    return NextResponse.json({ error: "Failed to remove staff member" }, { status: 500 });
  }
}
