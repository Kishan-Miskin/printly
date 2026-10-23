import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { queryOne, execute } from "./db";

export const SESSION_COOKIE_NAME = "printflow_session";
const SESSION_DURATION_DAYS = 7;

export interface AuthenticatedContext {
  user: {
    id: string;
    email: string;
    name: string;
  };
  shop: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    hours: string | null;
    is_open: boolean;
    public_token: string;
    settings: Record<string, unknown>;
  };
  role: "SHOP_OWNER" | "SHOP_STAFF";
  sessionToken: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Creates a new secure session for a user and shop
 */
export function createSession(userId: string, shopId: string): { sessionToken: string; expiresAt: string } {
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  execute(`
    INSERT INTO sessions (id, user_id, shop_id, session_token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, id, userId, shopId, sessionToken, expiresAt, now);

  return { sessionToken, expiresAt };
}

/**
 * Destroys session
 */
export function destroySession(sessionToken: string): void {
  execute("DELETE FROM sessions WHERE session_token = ?", sessionToken);
}

/**
 * Resolves session and returns full tenant context
 */
export function resolveSession(sessionToken: string): AuthenticatedContext | null {
  if (!sessionToken) return null;

  const now = new Date().toISOString();

  interface SessionRow {
    user_id: string;
    shop_id: string;
    expires_at: string;
    user_email: string;
    user_name: string;
    shop_name: string;
    shop_slug: string;
    shop_phone: string | null;
    shop_address: string | null;
    shop_hours: string | null;
    shop_is_open: number;
    shop_public_token: string;
    shop_settings: string;
    role: "SHOP_OWNER" | "SHOP_STAFF";
  }

  const row = queryOne<SessionRow>(`
    SELECT 
      s.user_id, s.shop_id, s.expires_at,
      u.email as user_email, u.name as user_name,
      sh.name as shop_name, sh.slug as shop_slug, sh.phone as shop_phone,
      sh.address as shop_address, sh.hours as shop_hours, sh.is_open as shop_is_open,
      sh.public_token as shop_public_token, sh.settings as shop_settings,
      sm.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    JOIN shops sh ON s.shop_id = sh.id
    JOIN shop_members sm ON (sm.shop_id = s.shop_id AND sm.user_id = s.user_id)
    WHERE s.session_token = ? AND s.expires_at > ?
  `, sessionToken, now);

  if (!row) {
    return null;
  }

  let parsedSettings: Record<string, unknown> = {};
  try {
    parsedSettings = JSON.parse(row.shop_settings);
  } catch {
    parsedSettings = {};
  }

  return {
    user: {
      id: row.user_id,
      email: row.user_email,
      name: row.user_name,
    },
    shop: {
      id: row.shop_id,
      name: row.shop_name,
      slug: row.shop_slug,
      phone: row.shop_phone,
      address: row.shop_address,
      hours: row.shop_hours,
      is_open: row.shop_is_open === 1,
      public_token: row.shop_public_token,
      settings: parsedSettings,
    },
    role: row.role,
    sessionToken,
  };
}

/**
 * Extracts session token from incoming Request (Cookie or Authorization header)
 */
export function extractTokenFromRequest(request: Request): string | null {
  // 1. Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 2. Cookie header
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

/**
 * Resolves session for server-side page/layout components using Next.js cookies()
 */
export async function getServerSession(): Promise<AuthenticatedContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return resolveSession(token);
  } catch {
    return null;
  }
}

/**
 * Requires shop authentication for API routes. Returns AuthenticatedContext or throws error Response.
 */
export function requireShopAuth(request: Request): AuthenticatedContext {
  const token = extractTokenFromRequest(request);
  if (!token) {
    throw new Response(JSON.stringify({ error: "Unauthorized: Missing session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = resolveSession(token);
  if (!auth) {
    throw new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return auth;
}
