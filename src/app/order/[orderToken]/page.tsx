"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Printer,
  PackageCheck,
  AlertCircle,
  ShieldAlert,
  Loader2,
  FileText,
  MapPin,
  Phone,
} from "lucide-react";

interface PublicOrder {
  orderNumber: string;
  status: "PENDING" | "ACCEPTED" | "PRINTING" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED";
  customerName: string | null;
  customerRequirements: string | null;
  createdAt: string;
  acceptedAt: string | null;
  printingAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  shop: {
    name: string;
    phone: string | null;
    address: string | null;
    hours: string | null;
  };
  files: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    printColor: string;
    paperSize: string;
    duplex: string;
    copies: number;
    requirements: string | null;
  }>;
}

export default function CustomerOrderStatusPage() {
  const params = useParams();
  const orderToken = params?.orderToken as string;

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/public/orders/${orderToken}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Order not found");
      } else {
        setOrder(data.order);
      }
    } catch {
      setError("Failed to fetch order status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderToken) {
      fetchStatus();
      // Poll every 5 seconds while order is active
      const interval = setInterval(() => {
        fetchStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [orderToken]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="animate-spin" size={36} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
          <p className="text-muted">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="card" style={{ borderColor: "var(--danger-border)" }}>
          <AlertCircle size={48} style={{ color: "var(--danger)", margin: "0 auto 16px" }} />
          <h1 className="text-h2" style={{ marginBottom: 12 }}>Order Not Found</h1>
          <p className="text-muted">{error || "This order link may be invalid or expired."}</p>
        </div>
      </div>
    );
  }

  const steps = [
    { key: "PENDING", label: "Submitted", desc: "Waiting for shop acceptance" },
    { key: "ACCEPTED", label: "Accepted", desc: "Queued for printing" },
    { key: "PRINTING", label: "Printing", desc: "Machine running" },
    { key: "READY", label: "Ready for Pickup", desc: "Visit counter" },
    { key: "COMPLETED", label: "Completed", desc: "Handover finished" },
  ];

  const statusOrder = ["PENDING", "ACCEPTED", "PRINTING", "READY", "COMPLETED"];
  const currentIndex = statusOrder.indexOf(order.status);
  const isTerminal = order.status === "REJECTED" || order.status === "CANCELLED";

  return (
    <div className="container-narrow" style={{ paddingTop: 36, paddingBottom: 60 }}>
      {/* Top Shop Info */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <span className="text-dim" style={{ fontSize: "0.8125rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          PRINT ORDER TRACKER
        </span>
        <h1 className="text-h1" style={{ fontSize: "1.75rem", marginTop: 4, marginBottom: 8 }}>
          {order.shop.name}
        </h1>
        {order.shop.address && (
          <p className="text-dim" style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MapPin size={14} />
            {order.shop.address}
          </p>
        )}
      </div>

      {/* Prominent READY Banner */}
      {order.status === "READY" && (
        <div
          className="card glow-ready"
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "2px solid var(--success)",
            marginBottom: 24,
            textAlign: "center",
            padding: 28,
          }}
        >
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--success-bg)", marginBottom: 12 }}>
            <PackageCheck size={40} style={{ color: "var(--success)" }} />
          </div>
          <h2 className="text-h2" style={{ color: "var(--success)", marginBottom: 6 }}>
            YOUR DOCUMENTS ARE READY!
          </h2>
          <p className="text-muted" style={{ marginBottom: 20 }}>
            Please visit the counter and present your Order ID and 6-digit Pickup PIN to collect your prints.
          </p>

          <div style={{ display: "inline-block", background: "#000", border: "1px solid #3f3f46", padding: "10px 24px", borderRadius: "var(--radius-md)" }}>
            <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", display: "block" }}>
              ORDER ID
            </span>
            <span style={{ fontSize: "1.75rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              {order.orderNumber}
            </span>
          </div>
        </div>
      )}

      {/* COMPLETED Banner */}
      {order.status === "COMPLETED" && (
        <div
          className="card"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--border)",
            marginBottom: 24,
            textAlign: "center",
            padding: 24,
          }}
        >
          <CheckCircle2 size={36} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
          <h2 className="text-h2" style={{ fontSize: "1.25rem", marginBottom: 6 }}>
            Order Completed & Handed Over
          </h2>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Documents have been safely collected at the counter. Uploaded files will be automatically deleted according to the retention policy.
          </p>
        </div>
      )}

      {/* Order Status Timeline */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Order Number</span>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>{order.orderNumber}</div>
          </div>
          <div className={`badge badge-${order.status.toLowerCase()}`}>
            {order.status}
          </div>
        </div>

        {!isTerminal ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map((step, idx) => {
              const isDone = currentIndex >= idx;
              const isCurrent = currentIndex === idx;

              return (
                <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: isCurrent ? "var(--primary)" : isDone ? "var(--success)" : "var(--badge-bg)",
                      color: isCurrent ? "#000" : isDone ? "#000" : "var(--text-dim)",
                      border: isDone || isCurrent ? "none" : "1px solid var(--border)",
                      flexShrink: 0,
                    }}
                  >
                    {isDone && !isCurrent ? "✓" : idx + 1}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9375rem", color: isCurrent ? "var(--text)" : isDone ? "var(--text)" : "var(--text-dim)" }}>
                      {step.label}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-dim)" }}>{step.desc}</div>
                  </div>

                  {isCurrent && (
                    <span className="badge badge-pending" style={{ fontSize: "0.6875rem" }}>
                      In Progress
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", padding: 14, color: "var(--danger)" }}>
            <ShieldAlert size={20} style={{ marginBottom: 6 }} />
            <div style={{ fontWeight: 600 }}>This order has been {order.status.toLowerCase()}</div>
          </div>
        )}
      </div>

      {/* Documents Summary */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="text-h3" style={{ fontSize: "1rem", marginBottom: 12 }}>
          Documents in Order ({order.files.length})
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {order.files.map((file, i) => (
            <div key={i} className="card-subtle" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <FileText size={20} style={{ color: "var(--text-muted)", marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{file.filename}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {file.printColor === "COLOR" ? "Color" : "B&W"} • {file.paperSize} • {file.duplex === "DOUBLE" ? "Double-sided" : "Single-sided"} • {file.copies} copies
                </div>
                {file.requirements && (
                  <div style={{ fontSize: "0.75rem", color: "#fef08a", marginTop: 4 }}>
                    Note: &ldquo;{file.requirements}&rdquo;
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {order.customerRequirements && (
          <div style={{ marginTop: 16, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
              Order Requirements
            </div>
            <div style={{ fontSize: "0.875rem" }}>{order.customerRequirements}</div>
          </div>
        )}
      </div>

      {/* Customer Reminder */}
      <div className="card-subtle" style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 8 }}>
          Need assistance with this order? Contact the counter directly:
        </div>
        {order.shop.phone && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: "0.9375rem" }}>
            <Phone size={14} />
            {order.shop.phone}
          </div>
        )}
      </div>
    </div>
  );
}
