"use client";

import React, { useState, useEffect } from "react";
import {
  PackageCheck,
  Printer,
  Check,
  AlertCircle,
  Copy,
  MapPin,
  Clock,
  Phone,
} from "lucide-react";

export interface PublicOrderData {
  orderNumber: string;
  status: "PENDING" | "ACCEPTED" | "PRINTING" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED" | "PRINT_FAILED";
  customerName: string | null;
  customerRequirements: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  printingAt?: string | null;
  readyAt?: string | null;
  completedAt?: string | null;
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

export default function OrderStatusClient({
  orderToken,
  initialOrder,
}: {
  orderToken: string;
  initialOrder: PublicOrderData | null;
}) {
  const [order, setOrder] = useState<PublicOrderData | null>(initialOrder);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

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
      // Keep existing data on intermittent network drop
    }
  };

  useEffect(() => {
    if (orderToken) {
      const interval = setInterval(fetchStatus, 4000);
      return () => clearInterval(interval);
    }
  }, [orderToken]);

  const copyOrderId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!order) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="card" style={{ padding: 32 }}>
          <AlertCircle size={40} style={{ color: "var(--danger)", margin: "0 auto 12px" }} />
          <h1 className="text-h2" style={{ marginBottom: 8 }}>Order Not Found</h1>
          <p className="text-muted">{error || "This order link may be invalid or expired."}</p>
        </div>
      </div>
    );
  }

  const isReady = order.status === "READY";
  const isPrinting = order.status === "PRINTING";
  const isCompleted = order.status === "COMPLETED";
  const isFailed = order.status === "REJECTED" || order.status === "CANCELLED" || order.status === "PRINT_FAILED";

  return (
    <div className="container-narrow" style={{ paddingTop: 36, paddingBottom: 60 }}>
      {/* Top Shop Info */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
          {order.shop.name}
        </h1>
        {order.shop.address && (
          <p className="text-dim" style={{ fontSize: "0.875rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <MapPin size={14} />
            <span>{order.shop.address}</span>
          </p>
        )}
      </div>

      {/* Main Status Card */}
      <div
        className="card"
        style={{
          padding: 28,
          textAlign: "center",
          border: isReady ? "2px solid var(--success)" : "1px solid var(--border)",
          background: isReady ? "rgba(16, 185, 129, 0.04)" : "var(--card)",
          marginBottom: 20,
        }}
      >
        {/* Status Graphic */}
        <div style={{ marginBottom: 16 }}>
          {isReady ? (
            <div
              style={{
                display: "inline-flex",
                padding: 12,
                borderRadius: "50%",
                background: "var(--success-bg)",
                color: "var(--success)",
                marginBottom: 10,
              }}
            >
              <PackageCheck size={36} />
            </div>
          ) : isPrinting ? (
            <div
              style={{
                display: "inline-flex",
                padding: 12,
                borderRadius: "50%",
                background: "rgba(59, 130, 246, 0.15)",
                color: "#60a5fa",
                marginBottom: 10,
              }}
            >
              <Printer size={36} />
            </div>
          ) : isCompleted ? (
            <div
              style={{
                display: "inline-flex",
                padding: 12,
                borderRadius: "50%",
                background: "var(--badge-bg)",
                color: "var(--text-muted)",
                marginBottom: 10,
              }}
            >
              <Check size={36} />
            </div>
          ) : isFailed ? (
            <div
              style={{
                display: "inline-flex",
                padding: 12,
                borderRadius: "50%",
                background: "var(--danger-bg)",
                color: "var(--danger)",
                marginBottom: 10,
              }}
            >
              <AlertCircle size={36} />
            </div>
          ) : (
            <div
              style={{
                display: "inline-flex",
                padding: 12,
                borderRadius: "50%",
                background: "var(--badge-bg)",
                color: "var(--text)",
                marginBottom: 10,
              }}
            >
              <Clock size={36} />
            </div>
          )}

          <h2 className="text-h2" style={{ fontSize: "1.5rem", marginBottom: 4 }}>
            {isReady
              ? "Your print is ready."
              : isPrinting
              ? "Printing now..."
              : isCompleted
              ? "Collected"
              : isFailed
              ? `Order ${order.status.toLowerCase()}`
              : "Request received."}
          </h2>
          <p className="text-muted" style={{ fontSize: "0.9375rem" }}>
            {isReady
              ? "Show your Order ID at the counter to collect."
              : isPrinting
              ? "The shopkeeper has started printing your document."
              : isCompleted
              ? "Thank you! Your documents were safely collected."
              : isFailed
              ? "Please contact the shopkeeper for assistance."
              : "You can leave now. We'll tell you when your print is ready."}
          </p>
        </div>

        {/* Order ID Banner */}
        <div
          style={{
            background: "#000",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            maxWidth: 320,
            margin: "0 auto 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <span className="text-dim" style={{ fontSize: "0.6875rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              ORDER ID
            </span>
            <div style={{ fontSize: "2rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              {order.orderNumber}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={copyOrderId}
            style={{ display: "inline-flex", gap: 6 }}
          >
            <Copy size={14} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {/* 3 Steps indicator */}
        {!isFailed && (
          <div
            style={{
              background: "var(--bg-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              maxWidth: 320,
              margin: "0 auto",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--success)",
                    color: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  ✓
                </div>
                <span style={{ fontSize: "0.875rem", color: "var(--text)", fontWeight: 600 }}>Received</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: isPrinting || isReady || isCompleted ? "var(--success)" : "var(--badge-bg)",
                    color: isPrinting || isReady || isCompleted ? "#000" : "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  {isPrinting || isReady || isCompleted ? "✓" : "2"}
                </div>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: isPrinting ? "#60a5fa" : isReady || isCompleted ? "var(--text)" : "var(--text-dim)",
                    fontWeight: isPrinting ? 700 : 500,
                  }}
                >
                  {isPrinting ? "Printing now..." : "Printing"}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: isReady || isCompleted ? "var(--success)" : "var(--badge-bg)",
                    color: isReady || isCompleted ? "#000" : "var(--text-dim)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  {isReady || isCompleted ? "✓" : "3"}
                </div>
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: isReady ? "var(--success)" : isCompleted ? "var(--text)" : "var(--text-dim)",
                    fontWeight: isReady ? 700 : 500,
                  }}
                >
                  {isReady ? "Ready for pickup!" : "Ready"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Documents attached */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 12 }}>
          DOCUMENTS ({order.files.length})
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.files.map((file, i) => (
            <div
              key={i}
              style={{
                padding: "10px 14px",
                background: "var(--bg-subtle)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 2 }}>
                {file.filename}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                {file.printColor === "COLOR" ? "Color" : "B&W"} · {file.copies} {file.copies === 1 ? "copy" : "copies"} · {file.paperSize} · {file.duplex === "DOUBLE" ? "Double-sided" : "Single-sided"}
              </div>
              {file.requirements && (
                <div style={{ fontSize: "0.75rem", color: "var(--primary)", marginTop: 4 }}>
                  Note: {file.requirements}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
