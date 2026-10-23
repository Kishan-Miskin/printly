"use client";

import React from "react";
import Link from "next/link";
import {
  Printer,
  QrCode,
  ShieldCheck,
  FileCheck2,
  Lock,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  KeyRound,
  FileText,
} from "lucide-react";

export default function HomePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "16px 24px",
          background: "rgba(9, 9, 11, 0.8)",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "#000" }}>
              <Printer size={20} />
            </div>
            <span style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.03em" }}>
              PrintFlow
            </span>
            <span className="badge" style={{ fontSize: "0.6875rem" }}>B2B SaaS</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/p/apex-prints-demo" className="btn btn-ghost btn-sm" target="_blank">
              Live Customer QR Demo
            </Link>
            <Link href="/login" className="btn btn-secondary btn-sm">
              Operator Sign In
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Register Shop
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: "80px 20px 60px", textAlign: "center" }}>
        <div className="container" style={{ maxWidth: 880 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 9999, background: "var(--badge-bg)", border: "1px solid var(--border)", marginBottom: 24 }}>
            <ShieldCheck size={16} style={{ color: "var(--success)" }} />
            <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Engineered for Physical Counter Safety</span>
          </div>

          <h1 className="text-h1" style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", marginBottom: 20 }}>
            Digital Counter Workflow for Xerox & Print Shops
          </h1>

          <p className="text-muted" style={{ fontSize: "clamp(1rem, 2vw, 1.25rem)", lineHeight: 1.6, marginBottom: 36, maxWidth: 700, margin: "0 auto 36px" }}>
            The end customer scans your unique counter QR code, uploads documents with exact quality preservation, specifies print requirements, and collects documents using a secure 6-digit Pickup PIN.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 48 }}>
            <Link href="/login" className="btn btn-primary btn-lg">
              Open Shop Terminal
              <ArrowRight size={18} />
            </Link>
            <Link href="/p/apex-prints-demo" className="btn btn-secondary btn-lg" target="_blank">
              Test Customer Scan Experience
            </Link>
          </div>

          {/* Interactive Flow Diagram */}
          <div
            className="card"
            style={{
              padding: "24px 20px",
              background: "rgba(255, 255, 255, 0.02)",
              borderColor: "var(--border)",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 16 }}>
              CORE COUNTER FLOW
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: 12,
              }}
            >
              {[
                { step: "1. SCAN", desc: "Customer scans shop QR" },
                { step: "2. UPLOAD", desc: "PDF, Word, or JPG" },
                { step: "3. SPECS", desc: "B&W/Color & Special Notes" },
                { step: "4. ORDER ID", desc: "PF-48291 + 6-digit PIN" },
                { step: "5. PRINT", desc: "Shop prints original" },
                { step: "6. VERIFY", desc: "PIN verification at counter" },
                { step: "7. HANDOVER", desc: "Correct documents delivered" },
              ].map((item, idx) => (
                <div key={idx} className="card-subtle" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.875rem", color: "var(--primary)" }}>{item.step}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Core Architectural Pillars */}
      <section style={{ padding: "60px 20px", background: "var(--bg-subtle)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 className="text-h2" style={{ fontSize: "2rem", marginBottom: 10 }}>
              Zero Friction. Maximum Security.
            </h2>
            <p className="text-muted" style={{ maxWidth: 600, margin: "0 auto" }}>
              Tailored specifically for busy printing shop operations where speed, document integrity, and privacy are paramount.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {/* Pillar 1 */}
            <div className="card">
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", width: "fit-content", marginBottom: 16 }}>
                <KeyRound size={24} style={{ color: "var(--success)" }} />
              </div>
              <h3 className="text-h3" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
                Pickup PIN Handover Security
              </h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16 }}>
                Prevents accidental wrong-document handovers. Knowing an Order ID alone is never sufficient. The shop operator must enter the customer&apos;s 6-digit Pickup PIN, verified server-side with rate limiting, before an order can be completed.
              </p>
              <div className="badge badge-ready">Cryptographic PIN Verification</div>
            </div>

            {/* Pillar 2 */}
            <div className="card">
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", width: "fit-content", marginBottom: 16 }}>
                <FileCheck2 size={24} style={{ color: "#3b82f6" }} />
              </div>
              <h3 className="text-h3" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
                Untouched Original Document Preservation
              </h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16 }}>
                Customer originals are NEVER downscaled, compressed, converted to WebP, or rebuilt. The downloadable print file downloaded by the shop has the exact byte-level SHA-256 integrity of the customer&apos;s original submission.
              </p>
              <div className="badge badge-accepted">Exact Byte Preservation</div>
            </div>

            {/* Pillar 3 */}
            <div className="card">
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", width: "fit-content", marginBottom: 16 }}>
                <Lock size={24} style={{ color: "#c084fc" }} />
              </div>
              <h3 className="text-h3" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
                Isolated Multi-Tenant Architecture
              </h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16 }}>
                Every shop is an isolated tenant. Customers scanning Shop A&apos;s QR code can only create orders for Shop A. Shop A can never access Shop B&apos;s customers, orders, files, or audit logs. Object-level authorization prevents IDOR.
              </p>
              <div className="badge badge-printing">Tenant Isolation Guaranteed</div>
            </div>

            {/* Pillar 4 */}
            <div className="card">
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", width: "fit-content", marginBottom: 16 }}>
                <Clock size={24} style={{ color: "var(--warning)" }} />
              </div>
              <h3 className="text-h3" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
                Automatic Document Retention & Deletion
              </h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16 }}>
                Uploaded customer files are ephemeral. Completed print jobs automatically delete customer documents from physical storage after 24 hours according to shop retention policy, protecting customer privacy.
              </p>
              <div className="badge badge-pending">Privacy-by-Design</div>
            </div>

            {/* Pillar 5 */}
            <div className="card">
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", width: "fit-content", marginBottom: 16 }}>
                <QrCode size={24} style={{ color: "var(--text)" }} />
              </div>
              <h3 className="text-h3" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
                One-Click Counter Posters
              </h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16 }}>
                Generate high-resolution vector QR posters directly from the dashboard. Print, laminate, and stick to your shop counter in 60 seconds with clear instructions for walk-in customers.
              </p>
              <div className="badge">Printable Vector SVG & PNG</div>
            </div>

            {/* Pillar 6 */}
            <div className="card">
              <div style={{ padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", width: "fit-content", marginBottom: 16 }}>
                <FileText size={24} style={{ color: "#f59e0b" }} />
              </div>
              <h3 className="text-h3" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
                Dedicated Special Requirements
              </h3>
              <p className="text-muted" style={{ fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 16 }}>
                Multiline customer instructions preserved verbatim: &ldquo;Print pages 2-5 only. First page in color, rest B&W. Staple in top corner.&rdquo; Prominently displayed to shop operators to prevent printing mistakes.
              </p>
              <div className="badge">Per-File & Order-Level Notes</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: "auto", borderTop: "1px solid var(--border)", padding: "32px 20px", textAlign: "center", fontSize: "0.8125rem", color: "var(--text-dim)" }}>
        <div className="container">
          <p>© 2026 PrintFlow SaaS. Production Multi-Tenant Platform for Local Xerox & Digital Print Shops.</p>
        </div>
      </footer>
    </div>
  );
}
