"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Printer,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  ArrowRight,
  ShieldCheck,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface OrderSummary {
  id: string;
  public_order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_requirements: string | null;
  status: "PENDING" | "ACCEPTED" | "PRINTING" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED";
  created_at: string;
  file_count: number;
  total_copies: number;
}

export default function DashboardOverviewPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        setCounts(data.counts || {});
      }
    } catch (err) {
      console.error("Failed to load dashboard orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 8000); // Live poll
    return () => clearInterval(interval);
  }, []);

  const handleQuickStatusChange = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update status");
      }
    } catch {
      alert("Network error updating status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Route to Counter Verify page with pre-filled Order ID
    router.push(`/dashboard/verify?orderId=${encodeURIComponent(searchQuery.trim().toUpperCase())}`);
  };

  return (
    <div>
      {/* Top Banner with Quick Counter Lookup */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
            Shop Floor Overview
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Live queue of incoming print jobs & counter pickups
          </p>
        </div>

        {/* Counter Quick Lookup Bar */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8, width: "100%", maxWidth: 420 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-dim)" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 36, fontFamily: "var(--font-mono)" }}
              placeholder="Verify Order ID (e.g. PF-48291)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <ShieldCheck size={16} />
            <span>Verify</span>
          </button>
        </form>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600 }}>PENDING</span>
            <Clock size={18} style={{ color: "var(--warning)" }} />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
            {counts.PENDING || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>Awaiting acceptance</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600 }}>PRINTING</span>
            <Printer size={18} style={{ color: "#c084fc" }} />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
            {counts.PRINTING || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>In printer queue</div>
        </div>

        <div className="card glow-ready" style={{ padding: 18, background: "rgba(16, 185, 129, 0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--success)", fontWeight: 700 }}>READY FOR PICKUP</span>
            <PackageCheck size={18} style={{ color: "var(--success)" }} />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--success)" }}>
            {counts.READY || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>PIN required at counter</div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)", fontWeight: 600 }}>COMPLETED</span>
            <CheckCircle2 size={18} style={{ color: "var(--text-dim)" }} />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
            {counts.COMPLETED || 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 4 }}>Verified handovers</div>
        </div>
      </div>

      {/* Live Order Queue Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 className="text-h3" style={{ fontSize: "1.0625rem" }}>Active Print Queue</h2>
            <button onClick={fetchOrders} className="btn btn-ghost btn-sm" title="Refresh queue">
              <RefreshCw size={14} />
            </button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/dashboard/orders")}>
            View All Orders
            <ArrowRight size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Loader2 className="animate-spin" size={28} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
            <p className="text-muted" style={{ fontSize: "0.875rem" }}>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Printer size={36} style={{ color: "var(--text-dim)", margin: "0 auto 12px" }} />
            <h3 className="text-h3" style={{ fontSize: "1rem", marginBottom: 4 }}>No orders yet</h3>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 16 }}>
              Place your counter QR poster so customers can scan and upload documents.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => router.push("/dashboard/qr")}>
              Print Counter Poster
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  <th style={{ padding: "12px 18px" }}>Order ID</th>
                  <th style={{ padding: "12px 18px" }}>Customer</th>
                  <th style={{ padding: "12px 18px" }}>Docs / Copies</th>
                  <th style={{ padding: "12px 18px" }}>Status</th>
                  <th style={{ padding: "12px 18px" }}>Special Requirements</th>
                  <th style={{ padding: "12px 18px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 15).map((order) => {
                  const isPending = order.status === "PENDING";
                  const isAccepted = order.status === "ACCEPTED";
                  const isPrinting = order.status === "PRINTING";
                  const isReady = order.status === "READY";

                  return (
                    <tr
                      key={order.id}
                      style={{ borderBottom: "1px solid var(--border)", transition: "background 0.1s ease" }}
                      className="order-row"
                    >
                      <td style={{ padding: "14px 18px" }}>
                        <span className="order-id-badge" style={{ fontSize: "0.875rem", padding: "3px 8px" }}>
                          {order.public_order_number}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600 }}>{order.customer_name || "Anonymous"}</div>
                        {order.customer_phone && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{order.customer_phone}</div>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <FileText size={15} style={{ color: "var(--text-muted)" }} />
                          <span>
                            {order.file_count} {order.file_count === 1 ? "file" : "files"} ({order.total_copies || order.file_count} copies)
                          </span>
                        </div>
                      </td>

                      <td style={{ padding: "14px 18px" }}>
                        <span className={`badge badge-${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>

                      <td style={{ padding: "14px 18px", maxWidth: 260 }}>
                        {order.customer_requirements ? (
                          <div
                            style={{
                              fontSize: "0.8125rem",
                              color: "#fef08a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={order.customer_requirements}
                          >
                            &ldquo;{order.customer_requirements}&rdquo;
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {isPending && (
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={updatingId === order.id}
                            onClick={() => handleQuickStatusChange(order.id, "ACCEPTED")}
                          >
                            Accept Order
                          </button>
                        )}

                        {isAccepted && (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ background: "#a855f7" }}
                            disabled={updatingId === order.id}
                            onClick={() => handleQuickStatusChange(order.id, "PRINTING")}
                          >
                            Start Printing
                          </button>
                        )}

                        {isPrinting && (
                          <button
                            className="btn btn-success btn-sm"
                            disabled={updatingId === order.id}
                            onClick={() => handleQuickStatusChange(order.id, "READY")}
                          >
                            Mark Ready
                          </button>
                        )}

                        {isReady && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ borderColor: "var(--success-border)", color: "var(--success)" }}
                            onClick={() => router.push(`/dashboard/verify?orderId=${order.public_order_number}`)}
                          >
                            <ShieldCheck size={14} />
                            Verify PIN Handover
                          </button>
                        )}

                        {order.status === "COMPLETED" && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                            Completed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .order-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}
