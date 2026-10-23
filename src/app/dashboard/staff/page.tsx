"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface StaffMember {
  membership_id: string;
  user_id: string;
  name: string;
  email: string;
  role: "SHOP_OWNER" | "SHOP_STAFF";
  created_at: string;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"SHOP_STAFF" | "SHOP_OWNER">("SHOP_STAFF");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff");
      const data = await res.json();
      if (res.ok) {
        setStaff(data.staff || []);
      }
    } catch {
      console.error("Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add staff");
      }

      setShowAddModal(false);
      setName("");
      setEmail("");
      setPassword("");
      await fetchStaff();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error adding staff");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveStaff = async (membershipId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this shop?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/staff?id=${membershipId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to remove staff");
      } else {
        await fetchStaff();
      }
    } catch {
      alert("Error removing staff");
    }
  };

  return (
    <div style={{ maxWidth: 840 }}>
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
            Shop Staff & Operators
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Manage counter operators and their permissions for this shop.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={16} />
          Add Staff Member
        </button>
      </div>

      {/* Staff List Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }} className="text-muted">Loading staff...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                <th style={{ padding: "12px 18px" }}>Name</th>
                <th style={{ padding: "12px 18px" }}>Email</th>
                <th style={{ padding: "12px 18px" }}>Role</th>
                <th style={{ padding: "12px 18px" }}>Joined</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.membership_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "14px 18px", fontWeight: 600 }}>{member.name}</td>
                  <td style={{ padding: "14px 18px", color: "var(--text-muted)" }}>{member.email}</td>
                  <td style={{ padding: "14px 18px" }}>
                    <span className={member.role === "SHOP_OWNER" ? "badge badge-accepted" : "badge"}>
                      {member.role === "SHOP_OWNER" ? "Owner" : "Staff"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right" }}>
                    {member.role !== "SHOP_OWNER" && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--danger)" }}
                        onClick={() => handleRemoveStaff(member.membership_id, member.name)}
                        title="Remove staff access"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 440 }}>
            <h2 className="text-h2" style={{ fontSize: "1.25rem", marginBottom: 6 }}>
              Add Counter Operator
            </h2>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 20 }}>
              Create login credentials for counter staff to process orders and verify pickups.
            </p>

            <form onSubmit={handleAddStaff}>
              {error && (
                <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", padding: 10, color: "var(--danger)", fontSize: "0.8125rem", marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Amit Verma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Login Email</label>
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
                <label className="form-label">Temporary Password</label>
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

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "SHOP_STAFF" | "SHOP_OWNER")}
                >
                  <option value="SHOP_STAFF">Staff (Process orders & verify pickups)</option>
                  <option value="SHOP_OWNER">Owner (Full administrative access)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-block" disabled={adding}>
                  {adding ? "Adding..." : "Add Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
