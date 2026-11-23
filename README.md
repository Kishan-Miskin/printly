# PrintFlow — Multi-Tenant SaaS for Local Xerox & Print Shops

> **SCAN → UPLOAD → ADD REQUIREMENTS → SUBMIT → GET ORDER ID + PIN → SHOP PROCESSES → VERIFY CUSTOMER → HAND OVER CORRECT DOCUMENTS**

PrintFlow is a production-grade multi-tenant platform tailored specifically for local Xerox, photocopy, and digital printing shops. It prioritizes **document integrity, privacy-by-design, tenant isolation, secure file handling, human-readable order identification, and preventing wrong-document handovers**.

---

## 🚀 Quick Start (Local Run)

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (10/10 tests)
npm test

# 3. Start local development server
npm run dev

# 4. Production build test
npm run build
```

### Pre-Seeded Demo Credentials
- **Shop Terminal URL**: [http://localhost:3000/login](http://localhost:3000/login)
- **Demo Customer Counter Scan Link**: [http://localhost:3000/p/apex-prints-demo](http://localhost:3000/p/apex-prints-demo)
- **Sample Pre-Seeded Ready Order**: `PF-48291` (Pickup PIN: `739284`)

---

## 🛡️ Core Business & Security Architecture

### 1. Customer Experience (< 60s, Zero-Login)
- **No Account Required**: Customers do not need an account, password, app download, or email confirmation.
- **Scan & Upload**: Customer scans the shop counter QR code (`/p/[shopToken]`).
- **Supported Formats**: PDF, Word (DOCX), JPEG, PNG with server-side magic byte / signature validation.
- **Print Specifications**:
  - Color mode (Black & White / Color)
  - Paper size (A4, A3, Legal, Letter)
  - Sides (Single-sided / Double-sided)
  - Copies count
  - Per-file instructions (e.g. *"Print pages 2–5 only"*)
  - Order-level special requirements (e.g. *"Staple each document separately. First page in color, rest B&W."*)
- **Submission Output**:
  - Unique human-readable counter Order ID: `PF-48291`
  - Cryptographically secure 6-digit Pickup PIN: `739284`
  - Unguessable high-entropy status URL: `/order/[token]`

### 2. Original Quality Preservation
- **Bit-for-Bit Exactness**: Downloaded original files are byte-for-byte identical to the customer upload (`SHA-256(upload) === SHA-256(download)`).
- **Zero Compression**: Images are NEVER downscaled, converted to WebP, recompressed, or altered.
- **Zero Alteration**: PDFs are never rasterized or stripped. DOCX containers remain completely intact.

### 3. Handover Safety & Pickup PIN Protection
- The shop operator **CANNOT** complete an order based on Order ID alone.
- Dedicated counter screen (`/dashboard/verify`) requires typing the customer's 6-digit PIN.
- Verification is performed on the backend using Bcrypt against `orders.customer_pin_hash`.
- **Lockout Mechanism**: Maximum 5 failed attempts within 15 minutes before the order is temporarily locked.
- Only orders in `READY` status with verified PINs can be transitioned to `COMPLETED`.

### 4. Tenant Isolation & IDOR Protection
- Every database entity contains `shop_id`.
- Session cookies (`printflow_session`) derive the authenticated tenant on the server.
- Object-level authorization checks: `order.shop_id === session.shop_id` and `file.shop_id === session.shop_id`.
- Cross-tenant requests return `404 Not Found` or `403 Forbidden`.

### 5. Automatic Document Retention & Privacy
- Ephemeral customer storage: Completed print jobs automatically delete customer files after 24 hours (configurable in Settings).
- Background cleanup worker: `POST /api/cron/cleanup` permanently purges expired physical files and marks metadata deleted.

---

## 📁 Repository Structure

```
printly/
├── data/                             # SQLite WAL database (printflow.db)
├── storage/                          # Private file storage (isolated from web root)
│   └── shops/{shop_id}/orders/{order_id}/files/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/                 # Login, Register, Logout, Me
│   │   │   ├── cron/cleanup/         # Ephemeral document retention worker
│   │   │   ├── orders/               # Orders list, details, status, PIN verify, complete
│   │   │   │   └── [id]/files/       # Authorized original file downloads & previews
│   │   │   ├── public/               # Customer QR endpoint & live status page
│   │   │   ├── security/audit-logs/  # Immutable security audit trail
│   │   │   ├── shop/                 # Shop profile, settings, QR generator
│   │   │   └── staff/                # Staff management (Owner vs Staff RBAC)
│   │   ├── dashboard/                # Shop operator portal
│   │   │   ├── orders/               # Full order inspection drawer & downloads
│   │   │   ├── qr/                   # Counter QR poster layout (Print / SVG / PNG)
│   │   │   ├── security/             # Audit logs view
│   │   │   ├── settings/             # Open/Closed switch, business hours, retention
│   │   │   ├── staff/                # Member invitations
│   │   │   └── verify/               # Counter pickup verification screen
│   │   ├── order/[orderToken]/       # Customer live order progress tracker
│   │   ├── p/[shopToken]/            # Customer mobile-first print upload interface
│   │   ├── login/                    # Shop operator authentication
│   │   ├── register/                 # New shop registration
│   │   ├── globals.css               # Monochromatic high-contrast design system
│   │   ├── layout.tsx                # Root layout
│   │   └── page.tsx                  # SaaS marketing homepage & interactive journey
│   ├── lib/
│   │   ├── auth.ts                   # Session resolution, bcrypt, RBAC
│   │   ├── db.ts                     # Database connection, schemas, typed helpers
│   │   ├── security.ts               # Magic bytes, SHA-256, PIN hashing, rate limiter
│   │   ├── storage.ts                # Private storage engine & path safety
│   │   ├── validation.ts             # Zod input schemas
│   │   └── seed.ts                   # Automated seed for instant local testing
│   └── types/                        # Ambient type declarations
└── tests/
    └── suite.ts                      # 10 automated test suites covering core safety rules
```

---

## 🧪 Test Suite Results

Run tests anytime with:
```bash
npm test
```

All 10 safety suites pass with 100% compliance:
- `✓ Original file byte preservation (SHA-256 match)`
- `✓ Magic-byte validation rejects forged executables and accepts valid formats`
- `✓ Pickup PIN generation, hashing, and verification`
- `✓ Wrong customer cannot verify another customer's order`
- `✓ PIN verification locks after 5 consecutive failed attempts`
- `✓ Cross-tenant isolation: Shop A cannot access Shop B order (IDOR Defense)`
- `✓ Order state machine enforces sequential transitions and blocks arbitrary skips`
- `✓ Order handover completion strictly requires READY state AND verified PIN`
- `✓ Idempotency key prevents duplicate order creations on rapid repeat clicks`
- `✓ Human-readable Order ID generation ensures non-collision`

---

## 🏭 Production Deployment Runbook

### Environment Variables (.env)
```env
PORT=3000
NODE_ENV=production
CRON_SECRET=super-secret-random-key-for-retention-worker
```

### Steps to Onboard the First Xerox Shop
1. Deploy the Next.js production build (`npm run build && npm run start`).
2. Navigate to `/register` and enter the shop name (e.g. *"City Xerox & Digital Prints"*), owner name, email, and password.
3. Once registered, navigate to **Counter QR & Poster** (`/dashboard/qr`).
4. Click **Print Counter Poster**. Print on an A4 sheet, laminate it, and paste it on the counter table.
5. Walk-in customers scan the QR code with their mobile phone cameras, upload documents, and receive their **Order ID** and **6-Digit Pickup PIN**.
6. When the customer reaches the counter, staff searches the Order ID, asks for the Pickup PIN, clicks **Verify**, and hands over the verified documents!
