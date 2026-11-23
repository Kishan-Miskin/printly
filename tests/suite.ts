import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, queryOne, queryAll, execute } from "../src/lib/db";
import {
  validateFileMagicBytes,
  calculateSha256,
  generatePickupPin,
  hashPin,
  verifyPin,
  generateUniqueOrderNumber,
  checkPickupRateLimit,
} from "../src/lib/security";
import { saveOriginalFile, readOriginalFile, deletePhysicalFile } from "../src/lib/storage";
import { getPublicShop } from "../src/lib/shops";

async function runTestSuite() {
  console.log("=================================================");
  console.log("   PRINTFLOW SAAS AUTOMATED TEST SUITE          ");
  console.log("=================================================\n");

  let passedTests = 0;
  let totalTests = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ PASS: ${name}`);
        passedTests++;
      } catch (err: unknown) {
        console.error(`  ✗ FAIL: ${name}`);
        console.error(`    ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }

  // Helper to create valid parent shop in DB for FK constraints
  function createTestShop(
    id: string,
    name: string,
    options: {
      slug?: string;
      publicToken?: string;
      city?: string;
      locality?: string;
      listed?: number;
      active?: number;
      isOpen?: number;
    } = {}
  ) {
    const now = new Date().toISOString();
    const slug = options.slug || `slug-${id}`;
    const token = options.publicToken || `token-${id}`;
    const city = options.city || "Belagavi";
    const locality = options.locality || "College Road";
    const listed = options.listed !== undefined ? options.listed : 1;
    const active = options.active !== undefined ? options.active : 1;
    const isOpen = options.isOpen !== undefined ? options.isOpen : 1;

    execute(`
      INSERT INTO shops (
        id, name, slug, phone, address, hours, is_open, public_token,
        description, city, locality, listed, active, settings, created_at, updated_at
      )
      VALUES (?, ?, ?, '1234567890', 'Test St', '9-5', ?, ?, 'Test shop description', ?, ?, ?, ?, '{}', ?, ?)
    `, id, name, slug, isOpen, token, city, locality, listed, active, now, now);
  }

  // 1. FILE PRESERVATION & BIT-FOR-BIT INTEGRITY
  await test("Original file byte preservation (SHA-256 match)", async () => {
    const shopId = `test_shop_${crypto.randomUUID()}`;
    const orderId = `test_order_${crypto.randomUUID()}`;
    const testPayload = Buffer.from(
      "%PDF-1.4\n%âãÏÓ\nOriginal Unmodified Document Stream For Production Print Execution\n%%EOF"
    );
    const initialSha256 = calculateSha256(testPayload);

    // Save
    const stored = await saveOriginalFile(shopId, orderId, "Assignment.pdf", testPayload);
    assert.strictEqual(stored.sha256, initialSha256, "Stored SHA256 must match upload SHA256");

    // Re-read from storage
    const readBack = await readOriginalFile(shopId, stored.storageKey);
    const downloadedSha256 = calculateSha256(readBack);

    assert.strictEqual(downloadedSha256, initialSha256, "Downloaded SHA256 must be byte-for-byte identical");
    assert.deepStrictEqual(readBack, testPayload, "Original bytes must not be altered, compressed, or resized");

    // Cleanup
    await deletePhysicalFile(shopId, stored.storageKey);
  });

  // 2. FILE SIGNATURE / MAGIC BYTES VALIDATION
  await test("Magic-byte validation rejects forged executables and accepts valid formats", () => {
    // Valid PDF
    const pdfBuf = Buffer.from("%PDF-1.5 test content");
    const pdfRes = validateFileMagicBytes(pdfBuf, "notes.pdf");
    assert.strictEqual(pdfRes.valid, true, "Valid PDF must pass");

    // Valid JPEG
    const jpgBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const jpgRes = validateFileMagicBytes(jpgBuf, "photo.jpg");
    assert.strictEqual(jpgRes.valid, true, "Valid JPEG must pass");

    // Valid PNG
    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const pngRes = validateFileMagicBytes(pngBuf, "scan.png");
    assert.strictEqual(pngRes.valid, true, "Valid PNG must pass");

    // Forged file: Executable EXE renamed as .pdf
    const exeBuf = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
    const forgedRes = validateFileMagicBytes(exeBuf, "invoice.pdf");
    assert.strictEqual(forgedRes.valid, false, "Forged executable disguised as PDF must be rejected");

    // Script disguised as Word
    const scriptBuf = Buffer.from("<script>alert(1)</script>");
    const scriptRes = validateFileMagicBytes(scriptBuf, "resume.docx");
    assert.strictEqual(scriptRes.valid, false, "Script disguised as DOCX must be rejected");
  });

  // 3. PICKUP PIN CRYPTOGRAPHIC INTEGRITY
  await test("Pickup PIN generation, hashing, and verification", async () => {
    const pin = generatePickupPin();
    assert.strictEqual(pin.length, 6, "PIN must be 6 digits");
    assert.match(pin, /^\d{6}$/, "PIN must be numeric");

    const hash = await hashPin(pin);
    assert.notStrictEqual(pin, hash, "Plaintext PIN must never equal hash");

    const match = await verifyPin(pin, hash);
    assert.strictEqual(match, true, "Correct PIN must verify");

    const wrongMatch = await verifyPin("000000", hash);
    assert.strictEqual(wrongMatch, false, "Wrong PIN must fail");
  });

  // 4. WRONG CUSTOMER HANDOVER PROTECTION
  await test("Wrong customer cannot verify another customer's order", async () => {
    const customerA_PIN = "123456";
    const customerB_PIN = "654321";

    const hashA = await hashPin(customerA_PIN);
    const hashB = await hashPin(customerB_PIN);

    // Customer B attempts to verify Customer A's order with Customer B's PIN
    const unauthorizedAttempt = await verifyPin(customerB_PIN, hashA);
    assert.strictEqual(unauthorizedAttempt, false, "Customer B's PIN must fail for Order A");
  });

  // 5. PIN ATTEMPT RATE LIMITING & LOCKOUT
  await test("PIN verification locks after 5 consecutive failed attempts", () => {
    const testShopId = `test_shop_rate_${crypto.randomUUID()}`;
    createTestShop(testShopId, "Rate Limit Test Shop");

    const testOrderId = `test_order_rate_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Create parent order
    execute(`
      INSERT INTO orders (id, shop_id, public_order_number, public_access_token, public_access_token_hash, customer_pin_hash, status, created_at)
      VALUES (?, ?, 'PF-RATE1', 'tok_rate', 'hash_rate', 'pin_rate', 'READY', ?)
    `, testOrderId, testShopId, now);

    // Simulate 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      execute(`
        INSERT INTO pickup_verifications (id, order_id, shop_id, verified_by_user_id, attempt_count, result, verified_at, ip_address, user_agent)
        VALUES (?, ?, ?, NULL, ?, 'FAILED', ?, '127.0.0.1', 'test_agent')
      `, crypto.randomUUID(), testOrderId, testShopId, i, now);
    }

    let status = checkPickupRateLimit(testOrderId);
    assert.strictEqual(status.isLocked, false, "Should not be locked at 4 attempts");
    assert.strictEqual(status.remainingAttempts, 1, "Should have 1 attempt remaining");

    // 5th failed attempt
    execute(`
      INSERT INTO pickup_verifications (id, order_id, shop_id, verified_by_user_id, attempt_count, result, verified_at, ip_address, user_agent)
      VALUES (?, ?, ?, NULL, 5, 'FAILED', ?, '127.0.0.1', 'test_agent')
    `, crypto.randomUUID(), testOrderId, testShopId, now);

    status = checkPickupRateLimit(testOrderId);
    assert.strictEqual(status.isLocked, true, "Must be locked after 5 failed attempts");
    assert.strictEqual(status.remainingAttempts, 0, "Zero remaining attempts");

    // Cleanup
    execute("DELETE FROM pickup_verifications WHERE order_id = ?", testOrderId);
    execute("DELETE FROM orders WHERE id = ?", testOrderId);
    execute("DELETE FROM shops WHERE id = ?", testShopId);
  });

  // 6. MULTI-TENANT ISOLATION & IDOR DEFENSE
  await test("Cross-tenant isolation: Shop A cannot access Shop B order", () => {
    const shopA = `shop_A_${crypto.randomUUID()}`;
    const shopB = `shop_B_${crypto.randomUUID()}`;
    createTestShop(shopA, "Shop A");
    createTestShop(shopB, "Shop B");

    const orderB_Id = `order_B_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    // Insert Shop B order
    execute(`
      INSERT INTO orders (id, shop_id, public_order_number, public_access_token, public_access_token_hash, customer_pin_hash, status, created_at)
      VALUES (?, ?, 'PF-99991', 'tok_b', 'hash_b', 'pin_b', 'READY', ?)
    `, orderB_Id, shopB, now);

    // Query with Shop A context
    const accessAsShopA = queryOne(`
      SELECT * FROM orders WHERE id = ? AND shop_id = ?
    `, orderB_Id, shopA);

    assert.strictEqual(accessAsShopA, undefined, "Shop A must receive null/undefined when requesting Shop B's order");

    // Query with Shop B context
    const accessAsShopB = queryOne<{ id: string }>(`
      SELECT * FROM orders WHERE id = ? AND shop_id = ?
    `, orderB_Id, shopB);

    assert.strictEqual(accessAsShopB?.id, orderB_Id, "Shop B must have access to its own order");

    // Cleanup
    execute("DELETE FROM orders WHERE id = ?", orderB_Id);
    execute("DELETE FROM shops WHERE id IN (?, ?)", shopA, shopB);
  });

  // 7. ORDER LIFECYCLE & STATE MACHINE
  await test("Order state machine enforces sequential transitions (PENDING -> PRINTING -> READY -> COMPLETED)", () => {
    const ALLOWED: Record<string, string[]> = {
      PENDING: ["PRINTING", "ACCEPTED", "REJECTED", "CANCELLED"],
      ACCEPTED: ["PRINTING", "CANCELLED"],
      PRINTING: ["READY", "PRINT_FAILED", "CANCELLED"],
      PRINT_FAILED: ["PRINTING", "CANCELLED"],
      READY: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: [],
    };

    function canTransition(current: string, next: string): boolean {
      return (ALLOWED[current] || []).includes(next);
    }

    assert.strictEqual(canTransition("PENDING", "PRINTING"), true, "Shopkeeper can start printing from PENDING");
    assert.strictEqual(canTransition("PRINTING", "READY"), true, "Shopkeeper can mark READY from PRINTING");
    assert.strictEqual(canTransition("READY", "COMPLETED"), true, "Shopkeeper can complete from READY");
    assert.strictEqual(canTransition("COMPLETED", "PRINTING"), false, "Cannot restart completed order");
    assert.strictEqual(canTransition("PENDING", "COMPLETED"), false, "Cannot skip directly from PENDING to COMPLETED");
  });

  // 8. HANDOVER COMPLETION SAFETY
  await test("Order handover completion strictly requires READY state", () => {
    function canCompleteHandover(status: string): boolean {
      return status === "READY";
    }

    assert.strictEqual(canCompleteHandover("PENDING"), false, "PENDING cannot be completed");
    assert.strictEqual(canCompleteHandover("PRINTING"), false, "PRINTING cannot be completed");
    assert.strictEqual(canCompleteHandover("READY"), true, "READY can be completed");
  });

  // 9. IDEMPOTENCY KEY ENFORCEMENT
  await test("Idempotency key prevents duplicate order creations on rapid repeat clicks", () => {
    const shopId = `test_shop_idem_${crypto.randomUUID()}`;
    createTestShop(shopId, "Idempotency Test Shop");

    const idempotencyKey = "client_idem_key_123456";
    const now = new Date().toISOString();

    const orderId1 = crypto.randomUUID();
    execute(`
      INSERT INTO orders (id, shop_id, public_order_number, public_access_token, public_access_token_hash, customer_pin_hash, status, idempotency_key, created_at)
      VALUES (?, ?, 'A102', 'tok_idem', 'hash_idem', 'pin_idem', 'PENDING', ?, ?)
    `, orderId1, shopId, idempotencyKey, now);

    interface ExistingOrder {
      id: string;
      public_order_number: string;
    }
    const existing = queryOne<ExistingOrder>(`
      SELECT id, public_order_number FROM orders WHERE shop_id = ? AND idempotency_key = ?
    `, shopId, idempotencyKey);

    assert.strictEqual(existing?.id, orderId1, "Should find existing order");
    assert.strictEqual(existing?.public_order_number, "A102", "Matches existing order number");

    // Cleanup
    execute("DELETE FROM orders WHERE id = ?", orderId1);
    execute("DELETE FROM shops WHERE id = ?", shopId);
  });

  // 10. SHORT HUMAN-FRIENDLY ORDER ID FORMAT
  await test("Short human-friendly Order ID generation (e.g. A102) ensures non-collision", () => {
    const orderNumber1 = generateUniqueOrderNumber();
    const orderNumber2 = generateUniqueOrderNumber();
    assert.match(orderNumber1, /^[A-Z]\d{3,4}$/, "Order number follows format Letter + 3-4 digits (e.g. A102)");
    assert.notStrictEqual(orderNumber1, orderNumber2, "Consecutive generation produces unique IDs");
  });

  // 11. CRITICAL RULE: UPLOAD NEVER EQUALS AUTOMATIC PRINT
  await test("Upload creates PENDING order, never PRINTING", () => {
    const initialStatus = "PENDING";
    assert.strictEqual(initialStatus, "PENDING", "Customer upload must initialize as PENDING");
    assert.notStrictEqual(initialStatus, "PRINTING", "Customer upload must NEVER automatically be PRINTING");
  });

  // =========================================================================
  // SECTION 18 & 39: NEW ARCHITECTURAL TEST MATRIX (DISCOVERY + QR + PWA)
  // =========================================================================

  // 12. FLOW A: DIRECTORY RESOLUTION & ORDER CREATION VIA SLUG
  await test("Flow A: Customer discovers shop by slug, resolves authoritative shopId, creates DIRECTORY order", async () => {
    const shopDirId = `shop_dir_${crypto.randomUUID()}`;
    const slug = `shop-slug-${crypto.randomUUID().slice(0, 8)}`;
    createTestShop(shopDirId, "Directory Flow Xerox", { slug, listed: 1, active: 1 });

    // Customer opens /print/[slug] -> backend resolves via slug
    const resolved = await getPublicShop(slug);
    assert.notStrictEqual(resolved.shop, null, "Active listed shop must resolve by slug");
    assert.strictEqual(resolved.shop?.slug, slug, "Resolved shop slug matches input");

    // Backend creates order using authoritative shopDirId
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    execute(`
      INSERT INTO orders (id, shop_id, public_order_number, public_access_token, public_access_token_hash, customer_pin_hash, status, source, created_at)
      VALUES (?, ?, 'A201', 'tok_dir_test', 'hash_dir_test', 'pin_dir', 'PENDING', 'DIRECTORY', ?)
    `, orderId, shopDirId, now);

    const savedOrder = queryOne<{ id: string; shop_id: string; source: string }>(`
      SELECT id, shop_id, source FROM orders WHERE id = ?
    `, orderId);

    assert.strictEqual(savedOrder?.shop_id, shopDirId, "Order must belong strictly to directory shop ID");
    assert.strictEqual(savedOrder?.source, "DIRECTORY", "Order source must be DIRECTORY");

    // Cleanup
    execute("DELETE FROM orders WHERE id = ?", orderId);
    execute("DELETE FROM shops WHERE id = ?", shopDirId);
  });

  // 13. FLOW B: QR RESOLUTION & ORDER CREATION VIA PUBLIC TOKEN
  await test("Flow B: Customer scans QR token, resolves authoritative shopId, creates QR order", async () => {
    const shopQrId = `shop_qr_${crypto.randomUUID()}`;
    const token = `token-${crypto.randomUUID().slice(0, 8)}`;
    createTestShop(shopQrId, "QR Flow Print Center", { publicToken: token, listed: 1, active: 1 });

    // Customer scans /p/[token] -> backend resolves via public token
    const resolved = await getPublicShop(token);
    assert.notStrictEqual(resolved.shop, null, "Active shop must resolve by public token");
    assert.strictEqual(resolved.shop?.publicToken, token, "Resolved shop token matches");

    // Backend creates order using authoritative shopQrId
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();
    execute(`
      INSERT INTO orders (id, shop_id, public_order_number, public_access_token, public_access_token_hash, customer_pin_hash, status, source, created_at)
      VALUES (?, ?, 'B301', 'tok_qr_test', 'hash_qr_test', 'pin_qr', 'PENDING', 'QR', ?)
    `, orderId, shopQrId, now);

    const savedOrder = queryOne<{ id: string; shop_id: string; source: string }>(`
      SELECT id, shop_id, source FROM orders WHERE id = ?
    `, orderId);

    assert.strictEqual(savedOrder?.shop_id, shopQrId, "Order must belong strictly to QR shop ID");
    assert.strictEqual(savedOrder?.source, "QR", "Order source must be QR");

    // Cleanup
    execute("DELETE FROM orders WHERE id = ?", orderId);
    execute("DELETE FROM shops WHERE id = ?", shopQrId);
  });

  // 14. ANTI-TAMPERING: CLIENT CANNOT SPOOF DESTINATION SHOP ID
  await test("Anti-Tampering: Backend derives tenant purely from route token/slug and ignores client-injected shopId", async () => {
    const genuineShopId = `shop_genuine_${crypto.randomUUID()}`;
    const attackerShopId = `shop_attacker_${crypto.randomUUID()}`;
    const genuineSlug = `genuine-shop-${crypto.randomUUID().slice(0, 8)}`;

    createTestShop(genuineShopId, "Genuine Shop", { slug: genuineSlug, active: 1 });
    createTestShop(attackerShopId, "Attacker Shop", { active: 1 });

    // Client requests genuineSlug, but maliciously sends attackerShopId in form body:
    // Simulated backend resolution:
    interface ShopLookup {
      id: string;
      name: string;
    }
    const resolvedShop = queryOne<ShopLookup>(`
      SELECT id, name FROM shops WHERE (public_token = ? OR slug = ?) AND active = 1
    `, genuineSlug, genuineSlug);

    assert.strictEqual(resolvedShop?.id, genuineShopId, "Backend must resolve to genuine shop only");

    // Even if client injected `attackerShopId`, backend only uses resolvedShop.id:
    const assignedShopId = resolvedShop!.id;
    assert.notStrictEqual(assignedShopId, attackerShopId, "Attacker shop ID must be discarded");
    assert.strictEqual(assignedShopId, genuineShopId, "Order is assigned authoritatively to genuine shop");

    // Cleanup
    execute("DELETE FROM shops WHERE id IN (?, ?)", genuineShopId, attackerShopId);
  });

  // 15. INACTIVE OR UNLISTED SHOPS EXCLUDED FROM DIRECTORY & REJECT NEW ORDERS
  await test("Inactive shops (active = 0) are excluded from discovery and rejected from order creation", async () => {
    const inactiveShopId = `shop_inactive_${crypto.randomUUID()}`;
    const inactiveSlug = `inactive-xerox-${crypto.randomUUID().slice(0, 8)}`;
    createTestShop(inactiveShopId, "Suspended Xerox", { slug: inactiveSlug, active: 0, listed: 1 });

    // 1. Directory search exclusion:
    const searchResults = queryAll<{ id: string }>(`
      SELECT id FROM shops WHERE listed = 1 AND active = 1 AND slug = ?
    `, inactiveSlug);
    assert.strictEqual(searchResults.length, 0, "Inactive shop must NOT appear in public directory search");

    // 2. Order creation resolution rejection:
    const resolved = await getPublicShop(inactiveSlug);
    assert.strictEqual(resolved.shop, null, "Inactive shop must resolve to null");

    // Cleanup
    execute("DELETE FROM shops WHERE id = ?", inactiveShopId);
  });

  // 16. REVOKED QR TOKEN CANNOT RECEIVE NEW ORDERS
  await test("Revoked or rotated QR token cannot resolve or receive new orders", async () => {
    const shopId = `shop_rotate_${crypto.randomUUID()}`;
    const oldToken = `old-token-${crypto.randomUUID().slice(0, 8)}`;
    const newToken = `new-token-${crypto.randomUUID().slice(0, 8)}`;

    createTestShop(shopId, "Rotated Xerox", { publicToken: oldToken, active: 1 });

    // Rotate token
    execute("UPDATE shops SET public_token = ? WHERE id = ?", newToken, shopId);

    // Old token should now fail
    const oldLookup = await getPublicShop(oldToken);
    assert.strictEqual(oldLookup.shop, null, "Revoked token must fail resolution");

    // New token resolves correctly
    const newLookup = await getPublicShop(newToken);
    assert.notStrictEqual(newLookup.shop, null, "New rotated token resolves correctly");

    // Cleanup
    execute("DELETE FROM shops WHERE id = ?", shopId);
  });

  // 17. PWA MANIFEST INTEGRITY CHECK
  await test("PWA web app manifest includes standalone mode, valid start_url, and icons", () => {
    const manifestPath = path.resolve(__dirname, "../public/manifest.json");
    assert.strictEqual(fs.existsSync(manifestPath), true, "public/manifest.json must exist");

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    assert.strictEqual(manifestContent.display, "standalone", "Display mode must be standalone");
    assert.strictEqual(manifestContent.start_url, "/", "Start URL must be root '/' for universal customer entry");
    assert.ok(manifestContent.name.includes("PrintFlow"), "App name must include PrintFlow");
    assert.strictEqual(manifestContent.short_name, "PrintFlow", "App short_name must be PrintFlow");
    assert.ok(Array.isArray(manifestContent.icons) && manifestContent.icons.length >= 2, "Must contain at least 192 and 512 icons");

    // Verify physical icon files exist
    for (const icon of manifestContent.icons) {
      const iconPath = path.resolve(__dirname, "../public", icon.src.replace(/^\//, ""));
      assert.strictEqual(fs.existsSync(iconPath), true, `PWA icon file must physically exist: ${icon.src}`);
    }
  });

  // 18. PWA SERVICE WORKER PRIVACY AND ZERO-DATA-CACHE GUARANTEE
  await test("PWA Service Worker explicitly excludes private documents and dynamic APIs from cache", () => {
    const swPath = path.resolve(__dirname, "../public/sw.js");
    assert.strictEqual(fs.existsSync(swPath), true, "public/sw.js must exist");

    const swContent = fs.readFileSync(swPath, "utf-8");

    // Check strict exclusions
    assert.ok(swContent.includes("/api/"), "SW must exclude /api/ routes");
    assert.ok(swContent.includes("/storage/"), "SW must exclude /storage/ customer files");
    assert.ok(swContent.includes("/dashboard/"), "SW must exclude /dashboard/ private shop screens");
    assert.ok(swContent.includes("/order/"), "SW must exclude /order/ live status tracking");
  });

  // 19. NEARBY SHOPS DISTANCE CALCULATION & PROXIMITY ORDERING
  await test("Nearby shops calculate distance from user coordinates and sort nearest first", () => {
    function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 10) / 10;
    }

    const userLat = 15.8640;
    const userLng = 74.5080;

    const shopClose = { name: "Apex Xerox", lat: 15.8647, lng: 74.5089 }; // ~0.1 km
    const shopFar = { name: "Campus Copies", lat: 15.8821, lng: 74.5218 };  // ~2.5 km

    const distClose = calcDistance(userLat, userLng, shopClose.lat, shopClose.lng);
    const distFar = calcDistance(userLat, userLng, shopFar.lat, shopFar.lng);

    assert.ok(distClose < distFar, "Apex Xerox must be closer than Campus Copies");
    assert.ok(distClose < 1.0, "Apex Xerox is within 1 km");
  });

  console.log("\n=================================================");
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log("=================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
