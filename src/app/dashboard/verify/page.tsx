"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  KeyRound,
  Loader2,
  PackageCheck,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

interface OrderDetail {
  id: string;
  publicOrderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  customerRequirements: string | null;
  status: string;
  createdAt: string;
  isPickupVerified: boolean;
  files: Array<{
    id: string;
    originalFilename: string;
    printColor: string;
    paperSize: string;
    duplex: string;
    copies: number;
    requirements: string | null;
    downloadUrl: string;
    previewUrl: string;
  }>;
}

function VerifyPickupContent() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get("orderId") || "";

  const [orderQuery, setOrderQuery] = useState(initialOrderId);
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [searchError, setSearchError] = useState("");

  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [completedSuccess, setCompletedSuccess] = useState(false);

  // Auto-lookup if orderId was passed in query params
  useEffect(() => {
    if (initialOrderId) {
      findOrder(initialOrderId);
    }
  }, [initialOrderId]);

  const findOrder = async (targetId?: string) => {
    const query = (targetId || orderQuery).trim().toUpperCase();
    if (!query) return;

    setSearching(true);
    setSearchError("");
    setOrder(null);
    setIsVerified(false);
    setVerifyError("");
    setPin("");
    setCompletedSuccess(false);

    try {
      // Find order by search
      const res = await fetch(`/api/orders?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order search failed");

      const match = data.orders?.find(
        (o: { public_order_number: string }) => o.public_order_number.toUpperCase() === query
      );

      if (!match) {
        setSearchError(`No order found matching "${query}" in this shop.`);
        return;
      }

      // Fetch full order details
      const detailRes = await fetch(`/api/orders/${match.id}`);
      const detailData = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailData.error || "Failed to load order");

      setOrder(detailData.order);
      setIsVerified(Boolean(detailData.order.isPickupVerified));
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "Search error");
    } finally {
      setSearching(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || pin.length !== 6) return;

    setVerifying(true);
    setVerifyError("");

    try {
      const res = await fetch(`/api/orders/${order.id}/pickup/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Incorrect pickup PIN.");
        if (data.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
        return;
      }

      setIsVerified(true);
    } catch {
      setVerifyError("Verification request failed. Check connection.");
    } finally {
      setVerifying(false);
    }
  };

  const handleCompleteHandover = async () => {
    if (!order) return;
    setCompleting(true);

    try {
      const res = await fetch(`/api/orders/${order.id}/complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to complete handover");
        return;
      }

      setCompletedSuccess(true);
      setOrder((prev) => (prev ? { ...prev, status: "COMPLETED" } : null));
    } catch {
      alert("Error completing order");
    } finally {
      setCompleting(false);
    }
  };

  const resetForNextCustomer = () => {
    setOrder(null);
    setOrderQuery("");
    setPin("");
    setIsVerified(false);
    setCompletedSuccess(false);
    setSearchError("");
    setVerifyError("");
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: 10, borderRadius: "50%", background: "var(--badge-bg)", border: "1px solid var(--border)", marginBottom: 12 }}>
          <ShieldCheck size={28} style={{ color: "var(--success)" }} />
        </div>
        <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 6 }}>
          Counter Pickup Verification
        </h1>
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>
          Verify customer identity using their Order ID and 6-digit Pickup PIN to prevent wrong-document handovers.
        </p>
      </div>

      {/* Step 1: Order Lookup */}
      <div className="card" style={{ marginBottom: 24 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            findOrder();
          }}
          style={{ display: "flex", gap: 10 }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: 14, top: 13, color: "var(--text-dim)" }} />
            <input
              type="text"
              required
              className="form-input font-mono"
              style={{ paddingLeft: 40, fontSize: "1.125rem", fontWeight: 700, textTransform: "uppercase" }}
              placeholder="ENTER ORDER ID (E.G. PF-48291)"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value.toUpperCase())}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={searching}>
            {searching ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Searching...
              </>
            ) : (
              "Find Order"
            )}
          </button>
        </form>

        {searchError && (
          <div style={{ marginTop: 12, color: "var(--danger)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={15} />
            <span>{searchError}</span>
          </div>
        )}
      </div>

      {/* Handover Completed Success Message */}
      {completedSuccess && (
        <div className="card" style={{ textAlign: "center", borderColor: "var(--success-border)", marginBottom: 24, padding: 32 }}>
          <CheckCircle2 size={48} style={{ color: "var(--success)", margin: "0 auto 16px" }} />
          <h2 className="text-h2" style={{ color: "var(--success)", marginBottom: 8 }}>
            Handover Completed!
          </h2>
          <p className="text-muted" style={{ marginBottom: 20 }}>
            Order <strong>{order?.publicOrderNumber}</strong> has been safely handed to customer <strong>{order?.customerName || "Customer"}</strong>.
          </p>
          <button className="btn btn-primary" onClick={resetForNextCustomer}>
            Verify Next Customer
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Step 2: Order Found & PIN Verification */}
      {order && !completedSuccess && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Order Identity Card */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase" }}>Found Order</span>
                <div className="order-id-badge" style={{ marginTop: 4 }}>
                  {order.publicOrderNumber}
                </div>
              </div>
              <div className={`badge badge-${order.status.toLowerCase()}`}>
                Status: {order.status}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="card-subtle" style={{ padding: 12 }}>
                <span className="text-dim" style={{ fontSize: "0.75rem" }}>Customer Name</span>
                <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: 2 }}>
                  {order.customerName || "Anonymous Customer"}
                </div>
              </div>
              <div className="card-subtle" style={{ padding: 12 }}>
                <span className="text-dim" style={{ fontSize: "0.75rem" }}>Contact Phone</span>
                <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: 2 }}>
                  {order.customerPhone || "Not provided"}
                </div>
              </div>
            </div>

            {order.customerRequirements && (
              <div style={{ background: "rgba(254, 240, 138, 0.05)", border: "1px solid rgba(254, 240, 138, 0.2)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 16 }}>
                <span style={{ fontSize: "0.75rem", color: "#fef08a", textTransform: "uppercase", fontWeight: 700 }}>
                  Customer Special Requirements:
                </span>
                <p style={{ marginTop: 4, fontSize: "0.875rem" }}>&ldquo;{order.customerRequirements}&rdquo;</p>
              </div>
            )}

            {/* Document Checklist */}
            <div>
              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
                Documents in Print Stack ({order.files.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {order.files.map((file, i) => (
                  <div key={file.id} className="card-subtle" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.8125rem", color: "var(--text-dim)" }}>#{i + 1}</span>
                      <FileText size={16} style={{ color: "var(--text-muted)" }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{file.originalFilename}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                          {file.printColor === "COLOR" ? "Color" : "B&W"} • {file.paperSize} • {file.duplex === "DOUBLE" ? "Double-sided" : "Single-sided"} • {file.copies} copies
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Verification Box */}
          {!isVerified ? (
            <div className="card" style={{ borderColor: "var(--border-focus)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <KeyRound size={22} style={{ color: "var(--warning)" }} />
                <h3 className="text-h3" style={{ fontSize: "1.125rem" }}>
                  Ask Customer for 6-Digit Pickup PIN
                </h3>
              </div>
              <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 20 }}>
                Do NOT hand over documents based only on Order ID. The customer must provide the 6-digit PIN shown on their receipt.
              </p>

              <form onSubmit={handleVerifyPin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    className="form-input font-mono pin-display"
                    style={{ width: "100%", textAlign: "center", letterSpacing: "0.3em" }}
                    placeholder="______"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  />
                </div>

                {verifyError && (
                  <div
                    style={{
                      background: "var(--danger-bg)",
                      border: "1px solid var(--danger-border)",
                      borderRadius: "var(--radius-md)",
                      padding: 12,
                      color: "var(--danger)",
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <ShieldAlert size={16} />
                    <span>{verifyError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={pin.length !== 6 || verifying}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Verifying PIN...
                    </>
                  ) : (
                    "Verify Customer PIN"
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* PIN Verified - Final Handover Checklist */
            <div className="card glow-ready" style={{ background: "rgba(16, 185, 129, 0.04)", borderColor: "var(--success)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <CheckCircle2 size={32} style={{ color: "var(--success)" }} />
                <div>
                  <h3 className="text-h3" style={{ color: "var(--success)", fontSize: "1.25rem" }}>
                    CUSTOMER VERIFIED
                  </h3>
                  <p className="text-muted" style={{ fontSize: "0.875rem" }}>
                    Cryptographic PIN matched. Confirm physical print stack matches before handover.
                  </p>
                </div>
              </div>

              {/* Physical Verification Checklist */}
              <div className="card-subtle" style={{ background: "#000", marginBottom: 20 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.05em" }}>
                  PHYSICAL HANDOVER CHECKLIST
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
                    <span>Printed documents match Order <strong>{order.publicOrderNumber}</strong></span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
                    <span>Special requirements satisfied (&ldquo;{order.customerRequirements || "Standard specs"}&rdquo;)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: "0.875rem", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
                    <span>Handed directly to customer <strong>{order.customerName || "Rahul"}</strong></span>
                  </label>
                </div>
              </div>

              <button
                className="btn btn-success btn-lg btn-block"
                onClick={handleCompleteHandover}
                disabled={completing}
              >
                {completing ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Completing Handover...
                  </>
                ) : (
                  "Complete Order & Confirm Handover"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerifyPickupPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 40 }}>Loading counter terminal...</div>}>
      <VerifyPickupContent />
    </Suspense>
  );
}
