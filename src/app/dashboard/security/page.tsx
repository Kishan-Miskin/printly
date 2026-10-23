"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Download,
  KeyRound,
  FileText,
  UserCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
}

export default function SecurityAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/security/audit-logs");
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
      }
    } catch {
      console.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadgeClass = (action: string) => {
    if (action.includes("SUCCESS") || action.includes("COMPLETED")) return "badge badge-ready";
    if (action.includes("FAILED") || action.includes("LOCKED")) return "badge badge-rejected";
    if (action.includes("DOWNLOAD") || action.includes("ACCESS")) return "badge badge-accepted";
    return "badge";
  };

  return (
    <div>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
            Security & Audit Trail
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Immutable chronological record of logins, file accesses, status transitions, and pickup PIN verifications.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchLogs}>
          <RefreshCw size={14} />
          Refresh Audit Trail
        </button>
      </div>

      {/* Security Architecture Guarantees Card */}
      <div
        className="card"
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--border)",
          marginBottom: 24,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <ShieldCheck size={20} style={{ color: "var(--success)" }} />
          <h2 className="text-h3" style={{ fontSize: "1rem" }}>
            PrintFlow Tenant Isolation & Privacy Guarantees
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
          <div>
            <strong style={{ color: "var(--text)", display: "block", marginBottom: 2 }}>Zero Plaintext PINs:</strong>
            Pickup PINs are cryptographically hashed using bcrypt. Only hashes are stored.
          </div>
          <div>
            <strong style={{ color: "var(--text)", display: "block", marginBottom: 2 }}>Strict Tenant Scoping:</strong>
            All database queries enforce shop_id isolation. Cross-shop access is impossible.
          </div>
          <div>
            <strong style={{ color: "var(--text)", display: "block", marginBottom: 2 }}>Original Byte Preservation:</strong>
            Customer documents are stored untouched in private storage with SHA-256 integrity verification.
          </div>
          <div>
            <strong style={{ color: "var(--text)", display: "block", marginBottom: 2 }}>Automatic Sanitization:</strong>
            Passwords and plaintext PINs are never recorded in audit logs.
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Loader2 className="animate-spin" size={28} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
            <p className="text-muted" style={{ fontSize: "0.875rem" }}>Loading audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p className="text-muted">No security events recorded yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-dim)", textTransform: "uppercase", fontSize: "0.6875rem", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "12px 16px" }}>Timestamp</th>
                  <th style={{ padding: "12px 16px" }}>Action</th>
                  <th style={{ padding: "12px 16px" }}>Target</th>
                  <th style={{ padding: "12px 16px" }}>Operator</th>
                  <th style={{ padding: "12px 16px" }}>Details</th>
                  <th style={{ padding: "12px 16px" }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  let parsedDetails = log.details;
                  try {
                    if (log.details && log.details.startsWith("{")) {
                      parsedDetails = JSON.stringify(JSON.parse(log.details));
                    }
                  } catch {}

                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        <span className={getActionBadgeClass(log.action)}>
                          {log.action}
                        </span>
                      </td>

                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                        {log.resource_type}
                      </td>

                      <td style={{ padding: "12px 16px" }}>
                        {log.user_name ? (
                          <span>{log.user_name}</span>
                        ) : (
                          <span style={{ color: "var(--text-dim)" }}>System / Customer</span>
                        )}
                      </td>

                      <td style={{ padding: "12px 16px", maxWidth: 320, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.details || ""}>
                        {parsedDetails || "—"}
                      </td>

                      <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                        {log.ip_address || "127.0.0.1"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
