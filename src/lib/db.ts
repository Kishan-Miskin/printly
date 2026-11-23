import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "printflow.db");

// Singleton connection across Next.js reloads
declare global {
  // eslint-disable-next-line no-var
  var __printflow_db: DatabaseSync | undefined;
}

function getDatabase(): DatabaseSync {
  if (global.__printflow_db) {
    return global.__printflow_db;
  }

  const db = new DatabaseSync(DB_PATH);

  // Performance and safety pragmas
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  initSchema(db);

  if (process.env.NODE_ENV !== "production") {
    global.__printflow_db = db;
  }

  return db;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      phone TEXT,
      address TEXT,
      hours TEXT,
      is_open INTEGER NOT NULL DEFAULT 1,
      public_token TEXT UNIQUE NOT NULL,
      settings TEXT NOT NULL,
      description TEXT DEFAULT '',
      city TEXT DEFAULT '',
      locality TEXT DEFAULT '',
      listed INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      logo_url TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_members (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('SHOP_OWNER', 'SHOP_STAFF')),
      created_at TEXT NOT NULL,
      UNIQUE(shop_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      public_order_number TEXT UNIQUE NOT NULL,
      public_access_token TEXT UNIQUE NOT NULL,
      public_access_token_hash TEXT NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      customer_pin_hash TEXT NOT NULL,
      customer_requirements TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'PRINTING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED')),
      source TEXT NOT NULL DEFAULT 'QR' CHECK(source IN ('QR', 'DIRECTORY', 'DIRECT')),
      idempotency_key TEXT,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      printing_at TEXT,
      ready_at TEXT,
      pickup_verified_at TEXT,
      completed_at TEXT,
      completed_by_user_id TEXT REFERENCES users(id),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS order_files (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      original_filename TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      preview_storage_key TEXT,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      print_color TEXT NOT NULL DEFAULT 'BW' CHECK(print_color IN ('BW', 'COLOR')),
      paper_size TEXT NOT NULL DEFAULT 'A4' CHECK(paper_size IN ('A4', 'A3', 'LEGAL', 'LETTER')),
      duplex TEXT NOT NULL DEFAULT 'SINGLE' CHECK(duplex IN ('SINGLE', 'DOUBLE')),
      copies INTEGER NOT NULL DEFAULT 1,
      customer_requirements TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'EXPIRED', 'DELETED')),
      created_at TEXT NOT NULL,
      expires_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pickup_verifications (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      verified_by_user_id TEXT REFERENCES users(id),
      attempt_count INTEGER NOT NULL DEFAULT 1,
      result TEXT NOT NULL CHECK(result IN ('SUCCESS', 'FAILED', 'LOCKED')),
      verified_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      session_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_qr_codes (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_invitations (
      id TEXT PRIMARY KEY,
      shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'SHOP_STAFF' CHECK(role IN ('SHOP_OWNER', 'SHOP_STAFF')),
      token TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'ACCEPTED', 'EXPIRED')),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    -- Base Indices for high performance
    CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
    CREATE INDEX IF NOT EXISTS idx_shops_public_token ON shops(public_token);
    CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
    CREATE INDEX IF NOT EXISTS idx_orders_public_order_number ON orders(public_order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_public_access_token ON orders(public_access_token);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(shop_id, idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_order_files_order_id ON order_files(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_files_shop_id ON order_files(shop_id);
    CREATE INDEX IF NOT EXISTS idx_shop_members_shop_id ON shop_members(shop_id);
    CREATE INDEX IF NOT EXISTS idx_shop_members_user_id ON shop_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
    CREATE INDEX IF NOT EXISTS idx_pickup_verif_order ON pickup_verifications(order_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_shop ON audit_logs(shop_id);
  `);

  // Safe runtime migrations for existing databases
  const shopMigrations = [
    "ALTER TABLE shops ADD COLUMN description TEXT DEFAULT ''",
    "ALTER TABLE shops ADD COLUMN city TEXT DEFAULT ''",
    "ALTER TABLE shops ADD COLUMN locality TEXT DEFAULT ''",
    "ALTER TABLE shops ADD COLUMN listed INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE shops ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE shops ADD COLUMN logo_url TEXT",
    "ALTER TABLE shops ADD COLUMN latitude REAL",
    "ALTER TABLE shops ADD COLUMN longitude REAL",
  ];
  for (const sql of shopMigrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists
    }
  }

  const orderMigrations = [
    "ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'QR'",
  ];
  for (const sql of orderMigrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists
    }
  }

  // Create indexes on migrated columns now that columns definitely exist
  const migratedIndices = [
    "CREATE INDEX IF NOT EXISTS idx_shops_discovery ON shops(listed, active, is_open)",
    "CREATE INDEX IF NOT EXISTS idx_shops_city ON shops(city)",
    "CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source)",
  ];
  for (const idxSql of migratedIndices) {
    try {
      db.exec(idxSql);
    } catch {
      // Ignore if index already exists
    }
  }
}

export const db = getDatabase();

export type BindParam = string | number | bigint | Buffer | null | boolean | undefined;

function sanitizeParam(p: BindParam): unknown {
  if (typeof p === "boolean") return p ? 1 : 0;
  if (p === undefined) return null;
  return p;
}

export function queryOne<T = Record<string, unknown>>(sql: string, ...params: BindParam[]): T | undefined {
  const safeParams = params.map(sanitizeParam);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).get(...(safeParams as any)) as unknown as T | undefined;
}

export function queryAll<T = Record<string, unknown>>(sql: string, ...params: BindParam[]): T[] {
  const safeParams = params.map(sanitizeParam);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).all(...(safeParams as any)) as unknown as T[];
}

export function execute(sql: string, ...params: BindParam[]) {
  const safeParams = params.map(sanitizeParam);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.prepare(sql).run(...(safeParams as any));
}

export default db;
