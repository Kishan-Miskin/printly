"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  PackageCheck,
  ShieldCheck,
  AlertCircle,
  FileText,
  X,
  Loader2,
  RefreshCw,
  Hash,
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

interface OrderDetail {
  id: string;
  publicOrderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  customerRequirements: string | null;
  status: string;
  createdAt: string;
  acceptedAt: string | null;
  printingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  isPickupVerified: boolean;
  files: Array<{
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    printColor: string;
    paperSize: string;
    duplex: string;
    copies: number;
    requirements: string | null;
    downloadUrl: string;
    previewUrl: string;
  }>;
}

export default function ShopOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [activeStatus, setActiveStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let url = `/api/orders?status=${activeStatus}`;
      if (searchQuery.trim()) {
        url += `&q=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders || []);
        setCounts(data.counts || {});
      }
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeStatus, searchQuery]);

  const openOrderDetail = async (orderId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedOrder(data.order);
      }
    } catch {
      alert("Failed to load order details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update status");
      } else {
        await fetchOrders();
        await openOrderDetail(orderId);
      }
    } catch {
      alert("Network error updating status");
    } finally {
      setActionLoading(false);
    }
  };

  const statusTabs = [
    { key: "ALL", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "ACCEPTED", label: "Accepted" },
    { key: "PRINTING", label: "Printing" },
    { key: "READY", label: "Ready" },
    { key: "COMPLETED", label: "Completed" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
            Order Management
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Search, process, inspect originals, and manage print workflows
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={fetchOrders}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Controls: Filter Tabs + Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {/* Status Tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {statusTabs.map((tab) => {
            const count = counts[tab.key] || 0;
            const active = activeStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveStatus(tab.key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  fontSize: "0.8125rem",
                  fontWeight: active ? 700 : 500,
                  borderRadius: "var(--radius-md)",
                  background: active ? "var(--primary)" : "var(--badge-bg)",
                  color: active ? "var(--primary-foreground)" : "var(--text-muted)",
                  border: active ? "none" : "1px solid var(--border)",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    padding: "1px 6px",
                    borderRadius: 9999,
                    background: active ? "rgba(0, 0, 0, 0.2)" : "var(--card)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Counter Search Input */}
        <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-dim)" }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 36, fontSize: "0.875rem" }}
            placeholder="Search Order ID, name, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Order List Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Loader2 className="animate-spin" size={28} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
            <p className="text-muted" style={{ fontSize: "0.875rem" }}>Loading orders...</p>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <p className="text-muted">No orders found matching the criteria.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-dim)", fontSize: "0.75rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 18px" }}>Order ID</th>
                  <th style={{ padding: "12px 18px" }}>Customer</th>
                  <th style={{ padding: "12px 18px" }}>Documents</th>
                  <th style={{ padding: "12px 18px" }}>Status</th>
                  <th style={{ padding: "12px 18px" }}>Requirements</th>
                  <th style={{ padding: "12px 18px", textAlign: "right" }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => openOrderDetail(order.id)}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
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
                      {order.file_count} {order.file_count === 1 ? "file" : "files"} ({order.total_copies || order.file_count} copies)
                    </td>

                    <td style={{ padding: "14px 18px" }}>
                      <span className={`badge badge-${order.status.toLowerCase()}`}>
                        {order.status}
                      </span>
                    </td>

                    <td style={{ padding: "14px 18px", maxWidth: 220 }}>
                      {order.customer_requirements ? (
                        <div style={{ fontSize: "0.8125rem", color: "#fef08a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          &ldquo;{order.customer_requirements}&rdquo;
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>None</span>
                      )}
                    </td>

                    <td style={{ padding: "14px 18px", textAlign: "right" }}>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); openOrderDetail(order.id); }}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
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
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Order Inspection</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                  <div className="order-id-badge" style={{ fontSize: "1.25rem" }}>
                    {selectedOrder.publicOrderNumber}
                  </div>
                  <span className={`badge badge-${selectedOrder.status.toLowerCase()}`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Customer Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="card-subtle" style={{ padding: 12 }}>
                <span className="text-dim" style={{ fontSize: "0.75rem" }}>Customer Name</span>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{selectedOrder.customerName || "Anonymous"}</div>
              </div>
              <div className="card-subtle" style={{ padding: 12 }}>
                <span className="text-dim" style={{ fontSize: "0.75rem" }}>Phone</span>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{selectedOrder.customerPhone || "Not provided"}</div>
              </div>
            </div>

            {/* Order Special Requirements */}
            {selectedOrder.customerRequirements && (
              <div style={{ background: "rgba(254, 240, 138, 0.05)", border: "1px solid rgba(254, 240, 138, 0.2)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 20 }}>
                <span style={{ fontSize: "0.75rem", color: "#fef08a", textTransform: "uppercase", fontWeight: 700 }}>
                  Order-Level Special Requirements:
                </span>
                <p style={{ marginTop: 4, fontSize: "0.875rem" }}>&ldquo;{selectedOrder.customerRequirements}&rdquo;</p>
              </div>
            )}

            {/* Document Cards with Original Download and SHA-256 */}
            <div style={{ marginBottom: 24 }}>
              <h3 className="text-h3" style={{ fontSize: "1rem", marginBottom: 12 }}>
                Uploaded Documents ({selectedOrder.files.length})
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedOrder.files.map((file, i) => (
                  <div key={file.id} className="card-subtle" style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
                          {i + 1}. {file.originalFilename}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                          {(file.sizeBytes / (1024 * 1024)).toFixed(2)} MB • {file.mimeType}
                        </div>
                      </div>

                      {/* Download Original & Preview Buttons */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <a
                          href={file.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          title="Open inline preview"
                        >
                          <Eye size={14} />
                          Preview
                        </a>
                        <a
                          href={file.downloadUrl}
                          className="btn btn-primary btn-sm"
                          title="Download untouched original file for printing"
                        >
                          <Download size={14} />
                          Download Original
                        </a>
                      </div>
                    </div>

                    {/* Print Specs */}
                    <div style={{ display: "flex", gap: 12, fontSize: "0.75rem", background: "var(--card)", padding: "6px 10px", borderRadius: "var(--radius-sm)", marginBottom: 8 }}>
                      <span><strong>Mode:</strong> {file.printColor === "COLOR" ? "Color" : "B&W"}</span>
                      <span>•</span>
                      <span><strong>Size:</strong> {file.paperSize}</span>
                      <span>•</span>
                      <span><strong>Sides:</strong> {file.duplex === "DOUBLE" ? "Double" : "Single"}</span>
                      <span>•</span>
                      <span><strong>Copies:</strong> {file.copies}</span>
                    </div>

                    {/* Per-file instructions */}
                    {file.requirements && (
                      <div style={{ fontSize: "0.75rem", color: "#fef08a", marginBottom: 6 }}>
                        Special Note: &ldquo;{file.requirements}&rdquo;
                      </div>
                    )}

                    {/* SHA-256 Hash */}
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Hash size={12} />
                      <span>SHA-256: {file.sha256}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Action Buttons */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                {selectedOrder.status === "PENDING" && (
                  <button
                    className="btn btn-primary"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder.id, "ACCEPTED")}
                  >
                    Accept Order
                  </button>
                )}

                {selectedOrder.status === "ACCEPTED" && (
                  <button
                    className="btn btn-primary"
                    style={{ background: "#a855f7" }}
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder.id, "PRINTING")}
                  >
                    Start Printing
                  </button>
                )}

                {selectedOrder.status === "PRINTING" && (
                  <button
                    className="btn btn-success"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder.id, "READY")}
                  >
                    Mark Ready for Pickup
                  </button>
                )}

                {selectedOrder.status === "READY" && (
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      setSelectedOrder(null);
                      router.push(`/dashboard/verify?orderId=${selectedOrder.publicOrderNumber}`);
                    }}
                  >
                    <ShieldCheck size={16} />
                    Verify Customer PIN & Complete Handover
                  </button>
                )}
              </div>

              {selectedOrder.status !== "COMPLETED" && selectedOrder.status !== "CANCELLED" && (
                <button
                  className="btn btn-danger btn-sm"
                  disabled={actionLoading}
                  onClick={() => {
                    if (confirm("Are you sure you want to cancel this order?")) {
                      handleUpdateStatus(selectedOrder.id, "CANCELLED");
                    }
                  }}
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .order-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
      `}</style>
    </div>
  );
}
