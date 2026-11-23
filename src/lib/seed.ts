import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "./db";
import { saveOriginalFile } from "./storage";

export async function ensureSeedData() {
  const now = new Date().toISOString();

  // Always ensure shops have discovery metadata and coordinates populated
  try {
    db.prepare(`
      UPDATE shops 
      SET description = 'High-speed digital printing, color xerox, thesis binding & lamination.',
          city = 'Belagavi',
          locality = 'College Road',
          latitude = 15.8647,
          longitude = 74.5089,
          listed = 1,
          active = 1
      WHERE slug = 'apex-xerox'
    `).run();

    db.prepare(`
      UPDATE shops 
      SET latitude = 15.8524, longitude = 74.5042
      WHERE slug = 'city-prints'
    `).run();

    db.prepare(`
      UPDATE shops 
      SET latitude = 15.8821, longitude = 74.5218
      WHERE slug = 'campus-copies'
    `).run();
  } catch {}

  // 1. Ensure Secondary Print Centers for Discovery
  const defaultSettings = JSON.stringify({
    retention_hours: 24,
    auto_accept: false,
    max_file_size_mb: 20,
    max_files_per_order: 10,
    allowed_formats: ["pdf", "jpg", "jpeg", "png", "docx"],
  });

  const existingCityPrints = db.prepare("SELECT id FROM shops WHERE slug = ?").get("city-prints");
  if (!existingCityPrints) {
    const cityShopId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO shops (id, name, slug, phone, address, hours, is_open, public_token, settings, description, city, locality, listed, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cityShopId,
      "City Prints & Xerox Hub",
      "city-prints",
      "+91 98450 11223",
      "Shop 12, Market Main Road, Near Central Bus Stand",
      "8:30 AM - 9:30 PM (Mon-Sun)",
      1,
      "city-prints-hub",
      defaultSettings,
      "Fast document printing, color xerox, engineering drawings & lamination.",
      "Belagavi",
      "Market Circle",
      1,
      1,
      now,
      now
    );
    db.prepare(`
      INSERT INTO shop_qr_codes (id, shop_id, token, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `).run(crypto.randomUUID(), cityShopId, "city-prints-hub", now);
  }

  const existingCampus = db.prepare("SELECT id FROM shops WHERE slug = ?").get("campus-copies");
  if (!existingCampus) {
    const campusShopId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO shops (id, name, slug, phone, address, hours, is_open, public_token, settings, description, city, locality, listed, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      campusShopId,
      "Campus Digital Copies",
      "campus-copies",
      "+91 94480 33445",
      "Opposite University Gate 2, Campus Road",
      "9:00 AM - 8:00 PM (Mon-Sat)",
      1,
      "campus-copies-vt",
      defaultSettings,
      "Affordable student printouts, assignment copies, thesis & spiral binding.",
      "Belagavi",
      "University Campus",
      1,
      1,
      now,
      now
    );
    db.prepare(`
      INSERT INTO shop_qr_codes (id, shop_id, token, is_active, created_at)
      VALUES (?, ?, ?, 1, ?)
    `).run(crypto.randomUUID(), campusShopId, "campus-copies-vt", now);
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get("owner@demo-xerox.com");
  if (existingUser) {
    return; // Already seeded
  }

  const userId = crypto.randomUUID();
  const shopId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Insert Owner User
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, "owner@demo-xerox.com", passwordHash, "Rajesh Sharma", now, now);

  // Insert Primary Shop
  db.prepare(`
    INSERT INTO shops (id, name, slug, phone, address, hours, is_open, public_token, settings, description, city, locality, listed, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shopId,
    "Apex Xerox & Digital Prints",
    "apex-xerox",
    "+91 98765 43210",
    "Shop 4, University Metro Complex, College Road",
    "9:00 AM - 9:00 PM (Mon-Sat)",
    1,
    "apex-prints-demo",
    defaultSettings,
    "High-speed digital printing, color xerox, thesis binding & lamination.",
    "Belagavi",
    "College Road",
    1,
    1,
    now,
    now
  );

  // Shop Member (Owner)
  db.prepare(`
    INSERT INTO shop_members (id, shop_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), shopId, userId, "SHOP_OWNER", now);

  // Shop QR Code record
  db.prepare(`
    INSERT INTO shop_qr_codes (id, shop_id, token, is_active, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), shopId, "apex-prints-demo", 1, now);

  // 5. Create sample test orders:
  // Order 1: READY order ready for counter pickup verification
  const order1Id = crypto.randomUUID();
  const order1Pin = "739284";
  const pin1Hash = await bcrypt.hash(order1Pin, 10);
  const token1 = "order-token-ready-demo-123456";
  const token1Hash = crypto.createHash("sha256").update(token1).digest("hex");

  db.prepare(`
    INSERT INTO orders (
      id, shop_id, public_order_number, public_access_token, public_access_token_hash,
      customer_name, customer_phone, customer_pin_hash, customer_requirements,
      status, created_at, accepted_at, printing_at, ready_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order1Id,
    shopId,
    "PF-48291",
    token1,
    token1Hash,
    "Rahul Kumar",
    "+91 98111 22334",
    pin1Hash,
    "Please staple all documents separately. Keep the first page in color, rest in black and white.",
    "READY",
    new Date(Date.now() - 3600000).toISOString(),
    new Date(Date.now() - 3000000).toISOString(),
    new Date(Date.now() - 2000000).toISOString(),
    new Date(Date.now() - 600000).toISOString()
  );

  // Create demo physical files for Order 1 with real bytes
  // File 1: Assignment.pdf
  const pdfBuffer = Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 24 Tf 100 700 Td (Assignment PrintFlow Document) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000015 00000 n \n0000000068 00000 n \n00000000125 00000 n \n00000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n310\n%%EOF"
  );
  const file1Meta = await saveOriginalFile(shopId, order1Id, "College_Assignment.pdf", pdfBuffer);
  db.prepare(`
    INSERT INTO order_files (
      id, order_id, shop_id, original_filename, storage_key, mime_type, size_bytes, sha256,
      print_color, paper_size, duplex, copies, customer_requirements, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    order1Id,
    shopId,
    "College_Assignment.pdf",
    file1Meta.storageKey,
    "application/pdf",
    file1Meta.sizeBytes,
    file1Meta.sha256,
    "BW",
    "A4",
    "DOUBLE",
    2,
    "Print pages 2-5 only. Staple in top-left corner.",
    "ACTIVE",
    now
  );

  // File 2: PassportPhoto.jpg
  // Minimal valid 1x1 JPEG buffer
  const jpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbe, 0x3b, 0x28, 0xa0, 0x02, 0x8a, 0x28, 0xa0, 0xff, 0xd9
  ]);
  const file2Meta = await saveOriginalFile(shopId, order1Id, "Passport_Photo.jpg", jpgBuffer);
  db.prepare(`
    INSERT INTO order_files (
      id, order_id, shop_id, original_filename, storage_key, mime_type, size_bytes, sha256,
      print_color, paper_size, duplex, copies, customer_requirements, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    order1Id,
    shopId,
    "Passport_Photo.jpg",
    file2Meta.storageKey,
    "image/jpeg",
    file2Meta.sizeBytes,
    file2Meta.sha256,
    "COLOR",
    "A4",
    "SINGLE",
    1,
    "Full page photo print. Do not crop borders.",
    "ACTIVE",
    now
  );

  // Order 2: PENDING order
  const order2Id = crypto.randomUUID();
  const token2 = "order-token-pending-demo-789012";
  const token2Hash = crypto.createHash("sha256").update(token2).digest("hex");
  const pin2Hash = await bcrypt.hash("551234", 10);

  db.prepare(`
    INSERT INTO orders (
      id, shop_id, public_order_number, public_access_token, public_access_token_hash,
      customer_name, customer_phone, customer_pin_hash, customer_requirements,
      status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order2Id,
    shopId,
    "PF-10022",
    token2,
    token2Hash,
    "Ananya Deshmukh",
    "+91 97222 33445",
    pin2Hash,
    "Spiral binding required. Urgent for project review.",
    "PENDING",
    new Date(Date.now() - 600000).toISOString()
  );

  const file3Meta = await saveOriginalFile(shopId, order2Id, "Project_Thesis.pdf", pdfBuffer);
  db.prepare(`
    INSERT INTO order_files (
      id, order_id, shop_id, original_filename, storage_key, mime_type, size_bytes, sha256,
      print_color, paper_size, duplex, copies, customer_requirements, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    order2Id,
    shopId,
    "Project_Thesis.pdf",
    file3Meta.storageKey,
    "application/pdf",
    file3Meta.sizeBytes,
    file3Meta.sha256,
    "BW",
    "A4",
    "DOUBLE",
    1,
    "Print double sided on 75 GSM paper.",
    "ACTIVE",
    now
  );
}
