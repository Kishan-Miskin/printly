"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shopName,
          email,
          password,
          phone,
          address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register shop");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", border: "1px solid var(--border)", marginBottom: 16 }}>
            <Printer size={32} style={{ color: "var(--primary)" }} />
          </div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 6 }}>
            Register Your Xerox Shop
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Generate your counter QR code and start accepting digital print orders in minutes.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleRegister}>
            {error && (
              <div
                style={{
                  background: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "var(--radius-md)",
                  padding: 12,
                  marginBottom: 16,
                  color: "var(--danger)",
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Shop / Xerox Business Name</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Metro Xerox & Digital Prints"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Owner Full Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Shop Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Physical Shop Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Shop 2, Campus Market, Main Road"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Owner Login Email</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="owner@yourshop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Create Password (Min 8 characters)</label>
              <input
                type="password"
                required
                minLength={8}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: 8 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Setting Up Shop & QR...
                </>
              ) : (
                <>
                  Create Shop & Generate QR
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center", fontSize: "0.875rem" }}>
            <span className="text-muted">Already registered? </span>
            <Link href="/login" style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "underline" }}>
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
