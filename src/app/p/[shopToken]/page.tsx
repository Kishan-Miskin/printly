"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  Printer,
  ChevronRight,
  Trash2,
  Clock,
  ShieldCheck,
  FileCheck,
  Loader2,
  Info,
} from "lucide-react";

interface ShopData {
  name: string;
  phone: string | null;
  address: string | null;
  hours: string | null;
  isOpen: boolean;
  publicToken: string;
  settings: {
    maxFileSizeMb: number;
    maxFilesPerOrder: number;
    allowedFormats: string[];
    paperOptions: string[];
    colorOptions: string[];
    duplexOptions: string[];
  };
}

interface FileWithMeta {
  file: File;
  id: string;
  printColor: "BW" | "COLOR";
  paperSize: "A4" | "A3" | "LEGAL" | "LETTER";
  duplex: "SINGLE" | "DOUBLE";
  copies: number;
  customerRequirements: string;
}

interface SubmittedReceipt {
  orderNumber: string;
  pickupPin: string;
  publicAccessToken: string;
  statusUrl: string;
  documentCount: number;
  shopName: string;
  createdAt: string;
}

export default function CustomerPrintPage() {
  const params = useParams();
  const router = useRouter();
  const shopToken = params?.shopToken as string;

  const [shop, setShop] = useState<ShopData | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [shopError, setShopError] = useState("");

  const [files, setFiles] = useState<FileWithMeta[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerRequirements, setCustomerRequirements] = useState("");
  
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string>("");

  useEffect(() => {
    // Generate an idempotency key on initial load
    idempotencyKeyRef.current = `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    async function loadShop() {
      try {
        const res = await fetch(`/api/public/shops/${shopToken}`);
        const data = await res.json();
        if (!res.ok) {
          setShopError(data.error || "Unable to load shop details");
        } else {
          setShop(data.shop);
        }
      } catch {
        setShopError("Failed to connect to print shop server");
      } finally {
        setLoadingShop(false);
      }
    }
    if (shopToken) {
      loadShop();
    }
  }, [shopToken]);

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles || !shop) return;
    const allowed = ["pdf", "jpg", "jpeg", "png", "docx"];

    const newFiles: FileWithMeta[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const f = selectedFiles[i];
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!allowed.includes(ext)) {
        alert(`Unsupported file format "${ext}". Allowed: PDF, JPG, PNG, DOCX`);
        continue;
      }
      if (files.length + newFiles.length >= shop.settings.maxFilesPerOrder) {
        alert(`Maximum ${shop.settings.maxFilesPerOrder} files allowed per order`);
        break;
      }
      if (f.size > shop.settings.maxFileSizeMb * 1024 * 1024) {
        alert(`File "${f.name}" exceeds the ${shop.settings.maxFileSizeMb}MB limit`);
        continue;
      }

      newFiles.push({
        file: f,
        id: `${f.name}_${Date.now()}_${Math.random()}`,
        printColor: "BW",
        paperSize: "A4",
        duplex: "SINGLE",
        copies: 1,
        customerRequirements: "",
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileMeta = (id: string, updates: Partial<FileWithMeta>) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const handleSubmitOrder = async () => {
    if (files.length === 0) {
      setSubmitError("Please add at least one document to print");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const formData = new FormData();
      formData.append("idempotencyKey", idempotencyKeyRef.current);
      formData.append("customerName", customerName);
      formData.append("customerPhone", customerPhone);
      formData.append("customerRequirements", customerRequirements);

      const filesMeta = files.map((f) => ({
        originalFilename: f.file.name,
        printColor: f.printColor,
        paperSize: f.paperSize,
        duplex: f.duplex,
        copies: f.copies,
        customerRequirements: f.customerRequirements,
      }));

      formData.append("filesMeta", JSON.stringify(filesMeta));

      files.forEach((f) => {
        formData.append("files", f.file);
      });

      const res = await fetch(`/api/public/shops/${shopToken}/orders`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit order");
      }

      setReceipt(data);
      setShowReviewModal(false);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, type: "id" | "pin") => {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  if (loadingShop) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Loader2 className="animate-spin" size={36} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
          <p className="text-muted">Connecting to print shop...</p>
        </div>
      </div>
    );
  }

  if (shopError || !shop) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="card" style={{ borderColor: "var(--danger-border)" }}>
          <AlertCircle size={48} style={{ color: "var(--danger)", margin: "0 auto 16px" }} />
          <h1 className="text-h2" style={{ marginBottom: 12 }}>Unable to Access Shop</h1>
          <p className="text-muted" style={{ marginBottom: 24 }}>{shopError || "The print shop QR code is invalid or expired."}</p>
          <button className="btn btn-secondary" onClick={() => router.push("/")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Shop is Closed Screen
  if (!shop.isOpen) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="card">
          <Clock size={48} style={{ color: "var(--warning)", margin: "0 auto 16px" }} />
          <h1 className="text-h2" style={{ marginBottom: 8 }}>{shop.name}</h1>
          <div className="badge badge-pending" style={{ marginBottom: 20 }}>Currently Closed</div>
          <p className="text-muted" style={{ marginBottom: 8 }}>This Xerox & Print shop is currently closed and not accepting new print jobs.</p>
          {shop.hours && <p className="font-mono text-dim" style={{ marginBottom: 24 }}>Business Hours: {shop.hours}</p>}
          {shop.address && <p className="text-dim" style={{ fontSize: "0.875rem" }}>{shop.address}</p>}
        </div>
      </div>
    );
  }

  // Successful Order Receipt Screen
  if (receipt) {
    return (
      <div className="container-narrow" style={{ paddingTop: 40, paddingBottom: 60 }}>
        <div className="card" style={{ textAlign: "center", borderColor: "var(--success-border)" }}>
          <div style={{ display: "inline-flex", padding: 12, borderRadius: "50%", background: "var(--success-bg)", marginBottom: 16 }}>
            <CheckCircle2 size={40} style={{ color: "var(--success)" }} />
          </div>

          <div className="badge badge-ready" style={{ marginBottom: 12 }}>
            ORDER SUBMITTED
          </div>

          <h1 className="text-h2" style={{ marginBottom: 6 }}>{receipt.shopName}</h1>
          <p className="text-muted" style={{ fontSize: "0.9375rem", marginBottom: 24 }}>
            {receipt.documentCount} {receipt.documentCount === 1 ? "document" : "documents"} queued for processing.
          </p>

          {/* Critical Order ID & PIN Card */}
          <div
            style={{
              background: "#000",
              border: "1px solid #27272a",
              borderRadius: "var(--radius-lg)",
              padding: 24,
              marginBottom: 24,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  COUNTER ORDER ID
                </span>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                  {receipt.orderNumber}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(receipt.orderNumber, "id")}
              >
                <Copy size={14} />
                {copiedId ? "Copied" : "Copy"}
              </button>
            </div>

            <div style={{ borderTop: "1px dashed #27272a", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  PICKUP PIN (REQUIRED AT COUNTER)
                </span>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--success)", fontFamily: "var(--font-mono)", letterSpacing: "0.2em" }}>
                  {receipt.pickupPin}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => copyToClipboard(receipt.pickupPin, "pin")}
              >
                <Copy size={14} />
                {copiedPin ? "Copied" : "Copy PIN"}
              </button>
            </div>
          </div>

          {/* Prominent Counter Warning */}
          <div
            style={{
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: 16,
              marginBottom: 28,
              textAlign: "left",
              display: "flex",
              gap: 12,
            }}
          >
            <ShieldCheck size={22} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: "0.875rem", color: "#fef3c7" }}>
              <strong>IMPORTANT HANDOVER POLICY</strong>
              <p style={{ marginTop: 4, color: "#d1d5db" }}>
                Keep your Order ID and 6-digit Pickup PIN ready. The counter staff will ask for your PIN to verify identity before handing over your printed documents.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => router.push(receipt.statusUrl)}
            >
              Track Live Order Status
              <ChevronRight size={18} />
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Order Submission Form
  return (
    <div className="container-narrow" style={{ paddingTop: 32, paddingBottom: 60 }}>
      {/* Shop Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)" }} />
          <span style={{ fontSize: "0.8125rem", color: "var(--success)", fontWeight: 600 }}>Accepting Print Orders</span>
        </div>
        <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 6 }}>{shop.name}</h1>
        {shop.address && <p className="text-dim" style={{ fontSize: "0.875rem" }}>{shop.address}</p>}
      </div>

      {/* Upload Zone */}
      <div className="card" style={{ marginBottom: 20 }}>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          style={{ display: "none" }}
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed var(--border-focus)",
            borderRadius: "var(--radius-lg)",
            padding: "36px 20px",
            textAlign: "center",
            cursor: "pointer",
            background: "rgba(255, 255, 255, 0.02)",
            transition: "all 0.15s ease",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFileSelect(e.dataTransfer.files);
          }}
        >
          <div style={{ display: "inline-flex", padding: 14, borderRadius: "50%", background: "var(--badge-bg)", marginBottom: 12 }}>
            <Upload size={28} style={{ color: "var(--primary)" }} />
          </div>
          <h2 className="text-h3" style={{ fontSize: "1.0625rem", marginBottom: 6 }}>
            Tap to upload documents or drag & drop
          </h2>
          <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 12 }}>
            Supported formats: <strong>PDF, Word (DOCX), JPG, PNG</strong>
          </p>
          <div style={{ display: "inline-flex", gap: 12, fontSize: "0.75rem", color: "var(--text-dim)" }}>
            <span>Max {shop.settings.maxFileSizeMb}MB/file</span>
            <span>•</span>
            <span>Up to {shop.settings.maxFilesPerOrder} files</span>
            <span>•</span>
            <span>Original Quality Preserved</span>
          </div>
        </div>
      </div>

      {/* Selected Files & Per-File Requirements */}
      {files.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 className="text-h3" style={{ fontSize: "1rem" }}>
              Uploaded Documents ({files.length})
            </h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              + Add More Files
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {files.map((item, index) => {
              const ext = item.file.name.split(".").pop()?.toLowerCase();
              const isPdf = ext === "pdf";
              const isImg = ext === "jpg" || ext === "jpeg" || ext === "png";
              const isDoc = ext === "docx";

              return (
                <div key={item.id} className="card-subtle" style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <div style={{ padding: 8, borderRadius: "var(--radius-sm)", background: "var(--card)" }}>
                      {isPdf && <FileText size={20} style={{ color: "#ef4444" }} />}
                      {isImg && <ImageIcon size={20} style={{ color: "#3b82f6" }} />}
                      {isDoc && <FileCheck size={20} style={{ color: "#2563eb" }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 700 }}>#{index + 1}</span>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.9375rem",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.file.name}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 2 }}>
                        {(item.file.size / (1024 * 1024)).toFixed(2)} MB • {ext?.toUpperCase()}
                      </div>
                    </div>

                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ color: "var(--danger)", padding: 6 }}
                      onClick={() => removeFile(item.id)}
                      title="Remove file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Per-File Print Options Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <label style={{ fontSize: "0.6875rem", color: "var(--text-dim)", display: "block", marginBottom: 3 }}>
                        COLOR
                      </label>
                      <select
                        className="form-select"
                        style={{ padding: "6px 8px", fontSize: "0.8125rem" }}
                        value={item.printColor}
                        onChange={(e) => updateFileMeta(item.id, { printColor: e.target.value as "BW" | "COLOR" })}
                      >
                        <option value="BW">Black & White</option>
                        <option value="COLOR">Color</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.6875rem", color: "var(--text-dim)", display: "block", marginBottom: 3 }}>
                        PAPER SIZE
                      </label>
                      <select
                        className="form-select"
                        style={{ padding: "6px 8px", fontSize: "0.8125rem" }}
                        value={item.paperSize}
                        onChange={(e) => updateFileMeta(item.id, { paperSize: e.target.value as "A4" | "A3" | "LEGAL" | "LETTER" })}
                      >
                        <option value="A4">A4</option>
                        <option value="A3">A3</option>
                        <option value="LEGAL">Legal</option>
                        <option value="LETTER">Letter</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.6875rem", color: "var(--text-dim)", display: "block", marginBottom: 3 }}>
                        SIDES
                      </label>
                      <select
                        className="form-select"
                        style={{ padding: "6px 8px", fontSize: "0.8125rem" }}
                        value={item.duplex}
                        onChange={(e) => updateFileMeta(item.id, { duplex: e.target.value as "SINGLE" | "DOUBLE" })}
                      >
                        <option value="SINGLE">Single-sided</option>
                        <option value="DOUBLE">Double-sided</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: "0.6875rem", color: "var(--text-dim)", display: "block", marginBottom: 3 }}>
                        COPIES
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        className="form-input"
                        style={{ padding: "6px 8px", fontSize: "0.8125rem" }}
                        value={item.copies}
                        onChange={(e) => updateFileMeta(item.id, { copies: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    </div>
                  </div>

                  {/* File Specific Special Requirements */}
                  <div>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: "6px 10px", fontSize: "0.8125rem", background: "var(--card)" }}
                      placeholder="Special instructions for this file (e.g. print pages 2-5 only, do not crop)"
                      value={item.customerRequirements}
                      onChange={(e) => updateFileMeta(item.id, { customerRequirements: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order-Level Special Requirements & Customer Contact */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group">
          <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Order-Level Special Requirements</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>(Optional)</span>
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="e.g. Please staple all documents separately. Keep the first page in color, rest in black and white."
            value={customerRequirements}
            onChange={(e) => setCustomerRequirements(e.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Your Name <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>(Helps at counter)</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rahul Kumar"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              Phone Number <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>(Optional)</span>
            </label>
            <input
              type="tel"
              className="form-input"
              placeholder="e.g. 9876543210"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {submitError && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 16, color: "var(--danger)", fontSize: "0.875rem" }}>
          {submitError}
        </div>
      )}

      {/* Review & Submit Button */}
      <button
        className="btn btn-primary btn-lg btn-block"
        disabled={files.length === 0 || submitting}
        onClick={() => setShowReviewModal(true)}
      >
        Review & Submit Print Order ({files.length} {files.length === 1 ? "file" : "files"})
      </button>

      {/* Review Modal */}
      {showReviewModal && (
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
          <div className="card" style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 className="text-h2" style={{ fontSize: "1.25rem", marginBottom: 8 }}>
              Review Your Print Order
            </h2>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 20 }}>
              Verify your documents and instructions before submitting to <strong>{shop.name}</strong>.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {files.map((f, i) => (
                <div key={f.id} className="card-subtle" style={{ padding: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", marginBottom: 4 }}>
                    {i + 1}. {f.file.name}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {f.printColor === "COLOR" ? "Color" : "B&W"} • {f.paperSize} •{" "}
                    {f.duplex === "DOUBLE" ? "Double-sided" : "Single-sided"} • {f.copies} {f.copies === 1 ? "copy" : "copies"}
                  </div>
                  {f.customerRequirements && (
                    <div style={{ fontSize: "0.75rem", color: "#fef08a", marginTop: 4 }}>
                      Note: &ldquo;{f.customerRequirements}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>

            {customerRequirements && (
              <div style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 20 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Order Requirements
                </div>
                <div style={{ fontSize: "0.875rem" }}>{customerRequirements}</div>
              </div>
            )}

            {customerName && (
              <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 24 }}>
                Customer: <strong>{customerName}</strong> {customerPhone && `(${customerPhone})`}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn btn-secondary btn-block"
                onClick={() => setShowReviewModal(false)}
                disabled={submitting}
              >
                Back to Edit
              </button>
              <button
                className="btn btn-primary btn-block"
                onClick={handleSubmitOrder}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Submitting...
                  </>
                ) : (
                  "Confirm & Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
