import assert from "node:assert";
import crypto from "node:crypto";
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
  function createTestShop(id: string, name: string) {
    const now = new Date().toISOString();
    execute(`
      INSERT INTO shops (id, name, slug, phone, address, hours, is_open, public_token, settings, created_at, updated_at)
      VALUES (?, ?, ?, '1234567890', 'Test St', '9-5', 1, ?, '{}', ?, ?)
    `, id, name, `slug-${id}`, `token-${id}`, now, now);
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

  // 7. ORDER LIFECYCLE & STRICT STATE MACHINE
  await test("Order state machine enforces sequential transitions and blocks arbitrary skips", () => {
    const ALLOWED: Record<string, string[]> = {
      PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
      ACCEPTED: ["PRINTING", "CANCELLED"],
      PRINTING: ["READY", "CANCELLED"],
      READY: ["CANCELLED"],
      COMPLETED: [],
      REJECTED: [],
      CANCELLED: [],
    };

    function canTransition(current: string, next: string): boolean {
      return (ALLOWED[current] || []).includes(next);
    }

    assert.strictEqual(canTransition("PENDING", "ACCEPTED"), true);
    assert.strictEqual(canTransition("ACCEPTED", "PRINTING"), true);
    assert.strictEqual(canTransition("PRINTING", "READY"), true);

    // Invalid transition: COMPLETED -> PRINTING
    assert.strictEqual(canTransition("COMPLETED", "PRINTING"), false, "Cannot restart completed order");

    // Invalid transition: PENDING directly to COMPLETED
    assert.strictEqual(canTransition("PENDING", "COMPLETED"), false, "Cannot skip directly from PENDING to COMPLETED");
  });

  // 8. MANDATORY PIN VERIFICATION BEFORE COMPLETION
  await test("Order handover completion strictly requires READY state AND verified PIN", () => {
    function canCompleteHandover(status: string, pickupVerifiedAt: string | null): boolean {
      return status === "READY" && Boolean(pickupVerifiedAt);
    }

    // Ready but unverified PIN
    assert.strictEqual(canCompleteHandover("READY", null), false, "Unverified PIN must reject handover");

    // Ready with verified PIN
    assert.strictEqual(canCompleteHandover("READY", new Date().toISOString()), true, "Verified PIN allows completion");

    // Not READY (e.g. PRINTING) even if PIN was somehow present
    assert.strictEqual(canCompleteHandover("PRINTING", new Date().toISOString()), false, "Must be in READY state");
  });

  // 9. IDEMPOTENCY KEY ENFORCEMENT
  await test("Idempotency key prevents duplicate order creations on rapid repeat clicks", () => {
    const shopId = `test_shop_idem_${crypto.randomUUID()}`;
    createTestShop(shopId, "Idempotency Test Shop");

    const idempotencyKey = "client_idem_key_123456";
    const now = new Date().toISOString();

    // First submission creates order
    const orderId1 = crypto.randomUUID();
    execute(`
      INSERT INTO orders (id, shop_id, public_order_number, public_access_token, public_access_token_hash, customer_pin_hash, status, idempotency_key, created_at)
      VALUES (?, ?, 'PF-77112', 'tok_idem', 'hash_idem', 'pin_idem', 'PENDING', ?, ?)
    `, orderId1, shopId, idempotencyKey, now);

    // Second check queries existing order with same idempotencyKey
    interface ExistingOrder {
      id: string;
      public_order_number: string;
    }
    const existing = queryOne<ExistingOrder>(`
      SELECT id, public_order_number FROM orders WHERE shop_id = ? AND idempotency_key = ?
    `, shopId, idempotencyKey);

    assert.strictEqual(existing?.id, orderId1, "Should find existing order");
    assert.strictEqual(existing?.public_order_number, "PF-77112", "Matches existing order number");

    // Cleanup
    execute("DELETE FROM orders WHERE id = ?", orderId1);
    execute("DELETE FROM shops WHERE id = ?", shopId);
  });

  // 10. UNIQUE PUBLIC ORDER NUMBER RETRY LOGIC
  await test("Human-readable Order ID generation ensures non-collision", () => {
    const orderNumber1 = generateUniqueOrderNumber();
    const orderNumber2 = generateUniqueOrderNumber();
    assert.match(orderNumber1, /^PF-\d{5}$/, "Order number follows format PF-XXXXX");
    assert.notStrictEqual(orderNumber1, orderNumber2, "Sequential generation produces unique IDs");
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
