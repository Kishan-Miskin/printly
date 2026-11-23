"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Printer,
  CheckCircle2,
  Clock,
  PackageCheck,
  Search,
  ExternalLink,
  Eye,
  FileText,
  Volume2,
  VolumeX,
  AlertTriangle,
  RefreshCw,
  Info,
  X,
  Download,
  Copy,
  Layers,
  Sparkles,
} from "lucide-react";

interface OrderFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  printColor: string;
  paperSize: string;
  duplex: string;
  copies: number;
  requirements: string | null;
  downloadUrl: string;
  previewUrl: string;
}

interface OrderSummary {
  id: string;
  public_order_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_requirements: string | null;
  status: "PENDING" | "ACCEPTED" | "PRINTING" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED";
  created_at: string;
  accepted_at: string | null;
  printing_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  file_count: number;
  total_copies: number;
  files: OrderFile[];
}

export default function ShopQueuePage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING" | "PRINTING" | "READY" | "COMPLETED">("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeModalOrder, setActiveModalOrder] = useState<OrderSummary | null>(null);

  // Track previous order IDs to play sound on new incoming orders
  const prevPendingIdsRef = useRef<Set<string>>(new Set());

  // Gentle synthesizer chime via Web Audio API (no external asset needed)
  const playNewOrderChime = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio autoplay policy might block if no user interaction yet
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok && data?.orders) {
        const fetchedOrders: OrderSummary[] = data.orders;
        setOrders(fetchedOrders);

        // Check for newly arrived pending orders
        const currentPendingIds = new Set(
          fetchedOrders.filter((o) => o.status === "PENDING").map((o) => o.id)
        );

        if (prevPendingIdsRef.current.size > 0) {
          let hasNew = false;
          for (const id of currentPendingIds) {
            if (!prevPendingIdsRef.current.has(id)) {
              hasNew = true;
              break;
            }
          }
          if (hasNew) {
            playNewOrderChime();
          }
        }
        prevPendingIdsRef.current = currentPendingIds;
      }
    } catch (err) {
      console.error("Failed to load queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000); // 4-second live poll
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Action: Print (Moves PENDING -> PRINTING and opens print document)
  const handlePrint = async (order: OrderSummary) => {
    setActionLoadingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/print`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        // Open the first file preview/download for printing
        if (data.files && data.files.length > 0) {
          window.open(data.files[0].downloadUrl, "_blank");
        }
        await fetchOrders();
      } else {
        alert(data.error || "Could not start printing");
      }
    } catch {
      alert("Error starting print");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Mark Ready (Moves PRINTING -> READY)
  const handleMarkReady = async (order: OrderSummary) => {
    setActionLoadingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY" }),
      });
      if (res.ok) {
        await fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || "Could not mark order ready");
      }
    } catch {
      alert("Error updating order");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Complete (Moves READY -> COMPLETED on counter collection)
  const handleComplete = async (order: OrderSummary) => {
    setActionLoadingId(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/complete`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchOrders();
      } else {
        const data = await res.json();
        alert(data.error || "Could not complete order");
      }
    } catch {
      alert("Error completing order");
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatTimeAgo = (isoDate: string) => {
    const ms = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  // Filtering for active tab and search query
  const pendingOrders = orders.filter((o) => o.status === "PENDING" || o.status === "ACCEPTED");
  const printingOrders = orders.filter((o) => o.status === "PRINTING");
  const readyOrders = orders.filter((o) => o.status === "READY");
  const completedOrders = orders.filter((o) => o.status === "COMPLETED");

  const filterList = (list: OrderSummary[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.public_order_number.toLowerCase().includes(q) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q))
    );
  };

  return (
    <div>
      {/* Top Controls Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
            Print Queue
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Real-time incoming customer print jobs. Exact specifications preserved.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Quick Search */}
          <div style={{ position: "relative", minWidth: 220 }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 11, color: "var(--text-dim)" }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 36, fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}
              placeholder="Search Order ID or Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sound Alert Toggle */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute order chimes" : "Enable order chimes"}
            style={{ display: "inline-flex", gap: 6 }}
          >
            {soundEnabled ? <Volume2 size={16} style={{ color: "var(--success)" }} /> : <VolumeX size={16} />}
            <span>{soundEnabled ? "Chime On" : "Muted"}</span>
          </button>
        </div>
      </div>

      {/* 4-Stage Queue Grid (Designed for busy shop floor) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ================= COLUMN 1: TO PRINT ================= */}
        <div
          style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            padding: 16,
          }}
        >
          {/* Section Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={18} style={{ color: "var(--warning)" }} />
              <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "0.05em" }}>
                TO PRINT
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 12,
                background: pendingOrders.length > 0 ? "var(--warning)" : "var(--badge-bg)",
                color: pendingOrders.length > 0 ? "#000" : "var(--text-muted)",
              }}
            >
              {pendingOrders.length}
            </span>
          </div>

          {/* Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filterList(pendingOrders).length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.875rem" }}>
                No documents waiting to print.
              </div>
            ) : (
              filterList(pendingOrders).map((order) => {
                const mainFile = order.files?.[0];
                const isWorking = actionLoadingId === order.id;

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    {/* Header: Order ID + Customer Name + Time */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                          {order.public_order_number}
                        </div>
                        {order.customer_name ? (
                          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)" }}>
                            {order.customer_name}
                          </div>
                        ) : (
                          <div style={{ fontSize: "0.8125rem", color: "var(--text-dim)" }}>Anonymous</div>
                        )}
                      </div>

                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        {formatTimeAgo(order.created_at)}
                      </span>
                    </div>

                    {/* File & Print Specs right beside each other */}
                    {order.files?.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          background: "var(--bg-subtle)",
                          padding: "10px",
                          borderRadius: "var(--radius-sm)",
                          marginBottom: 8,
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ fontSize: "0.875rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
                          {f.originalFilename}
                        </div>

                        {/* HIGH-VISIBILITY PRINT SPEC BADGES */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
                          {/* Color Badge */}
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: "0.6875rem",
                              fontWeight: 800,
                              background: f.printColor === "COLOR" ? "#ec4899" : "var(--badge-bg)",
                              color: f.printColor === "COLOR" ? "#ffffff" : "var(--text)",
                              border: f.printColor === "COLOR" ? "none" : "1px solid var(--border)",
                            }}
                          >
                            {f.printColor === "COLOR" ? "🌈 COLOR" : "🔲 B&W"}
                          </span>

                          {/* Copies Badge */}
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: "0.6875rem",
                              fontWeight: 800,
                              background: f.copies > 1 ? "var(--warning)" : "var(--badge-bg)",
                              color: f.copies > 1 ? "#000" : "var(--text-muted)",
                              border: f.copies > 1 ? "none" : "1px solid var(--border)",
                            }}
                          >
                            {f.copies > 1 ? `⚠️ ${f.copies} COPIES` : `${f.copies} copy`}
                          </span>

                          {/* Paper Size */}
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              background: "var(--badge-bg)",
                              border: "1px solid var(--border)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {f.paperSize}
                          </span>

                          {/* Duplex */}
                          <span
                            style={{
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: "0.6875rem",
                              fontWeight: 700,
                              background: "var(--badge-bg)",
                              border: "1px solid var(--border)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {f.duplex === "DOUBLE" ? "🔄 Double-sided" : "📄 Single"}
                          </span>
                        </div>

                        {/* File Specific Requirement if any */}
                        {f.requirements && (
                          <div style={{ fontSize: "0.75rem", color: "var(--warning)", marginTop: 4, fontWeight: 700 }}>
                            {f.requirements}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Overall Order Customer Requirement (PROMINENT CALLOUT) */}
                    {(order.customer_requirements || order.files?.some(f => f.requirements)) && (
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          background: "var(--warning-bg)",
                          border: "1px solid var(--warning-border)",
                          borderRadius: "var(--radius-sm)",
                          padding: "8px 10px",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.6875rem", fontWeight: 800, color: "var(--warning)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          <FileText size={12} />
                          <span>CUSTOMER PRINT INSTRUCTIONS:</span>
                        </div>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--text)", marginTop: 2 }}>
                          {order.customer_requirements || order.files?.[0]?.requirements}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons: [ VIEW ], [ HOW TO PRINT ], and [ PRINT ] */}
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      {mainFile && (
                        <a
                          href={mainFile.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "6px 10px" }}
                          title="Preview Document"
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </a>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveModalOrder(order)}
                        style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                        title="View complete customer print instructions"
                      >
                        <Info size={14} />
                        <span>How to Print</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isWorking}
                        onClick={() => handlePrint(order)}
                        style={{ flex: 1, justifyContent: "center", fontWeight: 700 }}
                      >
                        <Printer size={15} />
                        <span>{isWorking ? "..." : "PRINT"}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: PRINTING ================= */}
        <div
          style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            padding: 16,
          }}
        >
          {/* Section Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Printer size={18} style={{ color: "#60a5fa" }} />
              <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "0.05em" }}>
                PRINTING
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 12,
                background: printingOrders.length > 0 ? "rgba(59, 130, 246, 0.2)" : "var(--badge-bg)",
                color: printingOrders.length > 0 ? "#93c5fd" : "var(--text-muted)",
              }}
            >
              {printingOrders.length}
            </span>
          </div>

          {/* Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filterList(printingOrders).length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.875rem" }}>
                Nothing printing right now.
              </div>
            ) : (
              filterList(printingOrders).map((order) => {
                const isWorking = actionLoadingId === order.id;

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: "var(--card)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                          {order.public_order_number}
                        </div>
                        {order.customer_name && (
                          <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{order.customer_name}</div>
                        )}
                      </div>

                      <span className="badge badge-pending" style={{ fontSize: "0.6875rem" }}>
                        Printing...
                      </span>
                    </div>

                    {order.files?.map((f) => (
                      <div key={f.id} style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 4 }}>
                        • {f.originalFilename} ({f.copies} {f.copies === 1 ? "copy" : "copies"}, {f.printColor})
                      </div>
                    ))}

                    {order.customer_requirements && (
                      <div style={{ fontSize: "0.75rem", color: "var(--warning)", marginTop: 4, fontWeight: 700 }}>
                        Note: {order.customer_requirements}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveModalOrder(order)}
                        style={{ padding: "6px 10px" }}
                      >
                        <Info size={14} />
                        <span>Specs</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isWorking}
                        onClick={() => handleMarkReady(order)}
                        style={{
                          flex: 1,
                          justifyContent: "center",
                          background: "var(--success)",
                          color: "#000",
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>{isWorking ? "Updating..." : "MARK READY"}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: READY ================= */}
        <div
          style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            padding: 16,
          }}
        >
          {/* Section Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PackageCheck size={18} style={{ color: "var(--success)" }} />
              <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "0.05em" }}>
                READY
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 12,
                background: readyOrders.length > 0 ? "var(--success-bg)" : "var(--badge-bg)",
                color: readyOrders.length > 0 ? "var(--success)" : "var(--text-muted)",
              }}
            >
              {readyOrders.length}
            </span>
          </div>

          {/* Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filterList(readyOrders).length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.875rem" }}>
                No completed prints at the counter.
              </div>
            ) : (
              filterList(readyOrders).map((order) => {
                const isWorking = actionLoadingId === order.id;

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: "var(--card)",
                      border: "1px solid var(--success-border)",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: "1.375rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--success)" }}>
                          {order.public_order_number}
                        </div>
                        {order.customer_name && (
                          <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{order.customer_name}</div>
                        )}
                      </div>

                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {formatTimeAgo(order.ready_at || order.created_at)}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 12 }}>
                      {order.file_count} {order.file_count === 1 ? "document" : "documents"} · Ready for pickup
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={isWorking}
                      onClick={() => handleComplete(order)}
                      style={{ width: "100%", justifyContent: "center", fontWeight: 700 }}
                    >
                      <CheckCircle2 size={16} />
                      <span>{isWorking ? "Completing..." : "COMPLETE"}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= COLUMN 4: DONE ================= */}
        <div
          style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            padding: 16,
          }}
        >
          {/* Section Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle2 size={18} style={{ color: "var(--text-dim)" }} />
              <span style={{ fontWeight: 800, fontSize: "0.9375rem", letterSpacing: "0.05em" }}>
                DONE
              </span>
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "2px 8px",
                borderRadius: 12,
                background: "var(--badge-bg)",
                color: "var(--text-dim)",
              }}
            >
              {completedOrders.length}
            </span>
          </div>

          {/* Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filterList(completedOrders).length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontSize: "0.875rem" }}>
                No completed history today.
              </div>
            ) : (
              filterList(completedOrders).slice(0, 10).map((order) => (
                <div
                  key={order.id}
                  className="card-subtle"
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                      {order.public_order_number}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {order.customer_name || "Guest"}
                    </div>
                  </div>

                  <span className="badge" style={{ fontSize: "0.6875rem" }}>
                    Picked up
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ================= DETAILED HOW TO PRINT MODAL ================= */}
      {activeModalOrder && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setActiveModalOrder(null)}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              padding: 24,
              maxWidth: 540,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.75rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                    {activeModalOrder.public_order_number}
                  </span>
                  <span className="badge badge-pending">
                    {activeModalOrder.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Customer: <strong>{activeModalOrder.customer_name || "Anonymous Walk-in"}</strong> {activeModalOrder.customer_phone && `(${activeModalOrder.customer_phone})`}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setActiveModalOrder(null)}
                style={{ padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Operator Quick Checklist / How to Print */}
            <div
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "16px 18px",
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Printer size={15} style={{ color: "var(--primary)" }} />
                <span>EXACT HOW-TO-PRINT SPECIFICATIONS</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--card)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Color Mode</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: activeModalOrder.files?.[0]?.printColor === "COLOR" ? "#ec4899" : "var(--text)" }}>
                    {activeModalOrder.files?.[0]?.printColor === "COLOR" ? "🌈 Full Color" : "🔲 Black & White"}
                  </div>
                </div>

                <div style={{ background: "var(--card)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Total Copies</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 800, color: (activeModalOrder.files?.[0]?.copies || 1) > 1 ? "var(--warning)" : "var(--text)" }}>
                    {activeModalOrder.files?.[0]?.copies || 1} {(activeModalOrder.files?.[0]?.copies || 1) === 1 ? "Copy" : "Copies"}
                  </div>
                </div>

                <div style={{ background: "var(--card)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Paper Size</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 800 }}>
                    {activeModalOrder.files?.[0]?.paperSize || "A4"}
                  </div>
                </div>

                <div style={{ background: "var(--card)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)", textTransform: "uppercase" }}>Sides / Duplex</div>
                  <div style={{ fontSize: "0.9375rem", fontWeight: 800 }}>
                    {activeModalOrder.files?.[0]?.duplex === "DOUBLE" ? "🔄 Double-sided" : "📄 Single-sided"}
                  </div>
                </div>
              </div>

              {/* Customer Notes */}
              {(activeModalOrder.customer_requirements || activeModalOrder.files?.some(f => f.requirements)) && (
                <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--warning-bg)", border: "1px solid var(--warning-border)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "var(--warning)", textTransform: "uppercase" }}>
                    Customer Special Instructions:
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", marginTop: 4 }}>
                    &ldquo;{activeModalOrder.customer_requirements || activeModalOrder.files?.[0]?.requirements}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Files List */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 8 }}>
                UPLOADED DOCUMENTS ({activeModalOrder.files?.length || 0})
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {activeModalOrder.files?.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "var(--bg-subtle)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: 10 }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.originalFilename}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                        {Math.round(f.sizeBytes / 1024)} KB · {f.printColor} · {f.paperSize} · {f.copies} {f.copies === 1 ? "copy" : "copies"}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <a
                        href={f.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "6px 10px" }}
                      >
                        <Eye size={14} />
                        <span>Preview</span>
                      </a>
                      <a
                        href={f.downloadUrl}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "6px 10px" }}
                        title="Download Original Byte-Preserved File"
                      >
                        <Download size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons inside modal */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveModalOrder(null)}
                style={{ flex: 1, justifyContent: "center" }}
              >
                Close
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const target = activeModalOrder;
                  setActiveModalOrder(null);
                  handlePrint(target);
                }}
                style={{ flex: 2, justifyContent: "center", fontWeight: 700 }}
              >
                <Printer size={16} />
                <span>Open File & Start Print</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
