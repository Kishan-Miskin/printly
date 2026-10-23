"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Shield, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail("owner@demo-xerox.com");
    setPassword("Password123!");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 16px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "var(--radius-md)", background: "var(--badge-bg)", border: "1px solid var(--border)", marginBottom: 16 }}>
            <Printer size={32} style={{ color: "var(--primary)" }} />
          </div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 6 }}>
            PrintFlow Portal
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Authenticated terminal for Xerox & Print Shop operators
          </p>
        </div>

        {/* Demo Fast Login Banner */}
        <div
          style={{
            background: "rgba(59, 130, 246, 0.08)",
            border: "1px solid rgba(59, 130, 246, 0.25)",
            borderRadius: "var(--radius-md)",
            padding: "12px 16px",
            marginBottom: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#93c5fd" }}>Try Demo Shop Owner</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>owner@demo-xerox.com</div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fillDemoCredentials}
            style={{ fontSize: "0.75rem", padding: "4px 10px" }}
          >
            Auto-Fill
          </button>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleLogin}>
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
              <label className="form-label">Operator Email</label>
              <input
                type="email"
                required
                className="form-input"
                placeholder="operator@shop.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                required
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
                  Verifying Credentials...
                </>
              ) : (
                <>
                  Sign In to Terminal
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center", fontSize: "0.875rem" }}>
            <span className="text-muted">New printing shop? </span>
            <Link href="/register" style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "underline" }}>
              Register Your Shop
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: "0.75rem", color: "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Shield size={14} />
          <span>Tenant Isolated • Cryptographic PIN Protection</span>
        </div>
      </div>
    </div>
  );
}
