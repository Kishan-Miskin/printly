"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  X,
  Clock,
  AlertCircle,
  Loader2,
  PackageCheck,
  Printer,
  Copy,
  ExternalLink,
  MapPin,
  Sparkles,
  Navigation,
  Paperclip,
} from "lucide-react";

import Link from "next/link";
import { InstallPwaButton } from "@/components/PwaManager";
import { ThemeToggle } from "@/components/ThemeManager";

export interface PublicShopData {
  name: string;
  phone: string | null;
  address: string | null;
  hours: string | null;
  isOpen: boolean;
  publicToken: string;
  slug?: string;
  settings: {
    maxFileSizeMb: number;
    maxFilesPerOrder: number;
    allowedFormats: string[];
    paperOptions: string[];
    colorOptions: string[];
    duplexOptions: string[];
  };
}

interface SelectedFile {
  file: File;
  id: string;
  sizeFormatted: string;
}

interface SubmittedReceipt {
  orderNumber: string;
  pickupPin: string;
  publicAccessToken: string;
  statusUrl: string;
  documentCount: number;
  shopName: string;
}

interface NearbyShopItem {
  name: string;
  slug: string;
  publicToken: string;
  locality: string;
  city: string;
  isOpen: boolean;
  distanceFormatted: string;
  uploadUrl: string;
}

export default function CustomerPrintForm({
  shopToken,
  initialShop,
  source = "QR",
}: {
  shopToken: string;
  initialShop: PublicShopData | null;
  source?: "QR" | "DIRECTORY";
}) {
  const router = useRouter();
  const shop = initialShop;

  // Selected files
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print settings (defaults first: B&W, 1 copy, A4, Single-sided, All pages)
  const [copies, setCopies] = useState<number>(1);
  const [printColor, setPrintColor] = useState<"BW" | "COLOR">("BW");
  const [paperSize, setPaperSize] = useState<"A4" | "A3" | "LEGAL">("A4");
  const [duplex, setDuplex] = useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [pageSelection, setPageSelection] = useState<"ALL" | "CUSTOM">("ALL");
  const [customPages, setCustomPages] = useState<string>("");
  const [finishing, setFinishing] = useState<"NONE" | "STAPLE" | "SPIRAL" | "LAMINATE">("NONE");
  const [additionalRequirements, setAdditionalRequirements] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");

  // UI state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>("");
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  // Nearby Shops modal state
  const [showNearbyModal, setShowNearbyModal] = useState<boolean>(false);
  const [nearbyShops, setNearbyShops] = useState<NearbyShopItem[]>([]);
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false);

  // Live order status after submission
  const [liveStatus, setLiveStatus] = useState<string>("PENDING");
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const idempotencyKeyRef = useRef<string>(
    `idem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (selected: FileList | null) => {
    if (!selected || !shop) return;
    const allowed = shop.settings?.allowedFormats || ["pdf", "jpg", "jpeg", "png", "docx"];
    const maxMb = shop.settings?.maxFileSizeMb || 20;
    const maxFiles = shop.settings?.maxFilesPerOrder || 10;

    const newFiles: SelectedFile[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected[i];
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!allowed.includes(ext)) {
        alert(`"${f.name}" is not supported. Please choose a PDF, Word, or image file.`);
        continue;
      }
      if (files.length + newFiles.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files per print request.`);
        break;
      }
      if (f.size > maxMb * 1024 * 1024) {
        alert(`"${f.name}" exceeds the ${maxMb}MB size limit.`);
        continue;
      }
      newFiles.push({
        file: f,
        id: `${f.name}_${Date.now()}_${Math.random()}`,
        sizeFormatted: formatFileSize(f.size),
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Fetch Nearby Shops for drawer/modal
  const fetchNearbyShops = async () => {
    setShowNearbyModal(true);
    setLoadingNearby(true);
    try {
      const res = await fetch("/api/print-centers?limit=8");
      const data = await res.json();
      if (res.ok && data.centers) {
        setNearbyShops(data.centers);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingNearby(false);
    }
  };

  // Submit order
  const handleSubmit = async () => {
    if (files.length === 0) {
      setSubmitError("Please add a document first");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const formData = new FormData();
      formData.append("idempotencyKey", idempotencyKeyRef.current);
      formData.append("source", source);
      formData.append("customerName", customerName.trim());

      // Construct clear natural language requirements
      const requirementsParts: string[] = [];
      if (pageSelection === "CUSTOM" && customPages.trim()) {
        requirementsParts.push(`Pages: ${customPages.trim()}`);
      }
      if (finishing !== "NONE") {
        if (finishing === "STAPLE") requirementsParts.push("Staple top-left");
        if (finishing === "SPIRAL") requirementsParts.push("Spiral binding");
        if (finishing === "LAMINATE") requirementsParts.push("Lamination");
      }
      if (additionalRequirements.trim()) {
        requirementsParts.push(additionalRequirements.trim());
      }
      const finalRequirements = requirementsParts.join(" • ");

      formData.append("customerRequirements", finalRequirements);

      // Construct per-file metadata (sensible defaults)
      const filesMeta = files.map((f) => ({
        originalFilename: f.file.name,
        printColor,
        paperSize,
        duplex,
        copies,
        customerRequirements: finalRequirements,
      }));

      formData.append("filesMeta", JSON.stringify(filesMeta));
      files.forEach((f) => formData.append("files", f.file));

      const res = await fetch(`/api/public/shops/${shopToken}/orders`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send document. Please try again.");
      }

      setReceipt(data);
      setLiveStatus("PENDING");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Live polling for order status after submission
  useEffect(() => {
    if (!receipt?.publicAccessToken) return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/public/orders/${receipt.publicAccessToken}`);
        const data = await res.json();
        if (res.ok && data?.order?.status) {
          setLiveStatus(data.order.status);
        }
      } catch {
        // Silently tolerate temporary network drops
      }
    };

    const interval = setInterval(pollStatus, 4000);
    return () => clearInterval(interval);
  }, [receipt?.publicAccessToken]);

  const copyOrderId = () => {
    if (!receipt) return;
    navigator.clipboard.writeText(receipt.orderNumber);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // 1. Shop not found
  if (!shop) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="card" style={{ padding: 36 }}>
          <AlertCircle size={40} style={{ color: "var(--danger)", margin: "0 auto 12px" }} />
          <h1 className="text-h2" style={{ marginBottom: 8 }}>Print Center Not Found</h1>
          <p className="text-muted" style={{ fontSize: "0.9375rem", marginBottom: 20 }}>
            This print center link or QR code is inactive or invalid.
          </p>
          <Link href="/print-centers" className="btn btn-primary btn-sm">
            Find Available Print Centers
          </Link>
        </div>
      </div>
    );
  }

  // 2. Shop is closed
  if (!shop.isOpen) {
    return (
      <div className="container-narrow" style={{ paddingTop: 80, textAlign: "center" }}>
        <div className="card" style={{ padding: 36 }}>
          <Clock size={40} style={{ color: "var(--warning)", margin: "0 auto 12px" }} />
          <h1 className="text-h2" style={{ marginBottom: 4 }}>{shop.name}</h1>
          <div className="badge badge-pending" style={{ margin: "10px auto 16px" }}>Currently Closed</div>
          <p className="text-muted" style={{ fontSize: "0.9375rem", marginBottom: 8 }}>
            We are not accepting print requests right now.
          </p>
          {shop.hours && (
            <p className="font-mono text-dim" style={{ fontSize: "0.8125rem", marginTop: 8 }}>
              Hours: {shop.hours}
            </p>
          )}
          <div style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchNearbyShops}
            >
              <MapPin size={14} />
              <span>View Other Nearby Centers</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Sent Successfully / Receipt Screen
  if (receipt) {
    const isReady = liveStatus === "READY";
    const isPrinting = liveStatus === "PRINTING";
    const isCompleted = liveStatus === "COMPLETED";

    return (
      <div className="container-narrow" style={{ paddingTop: 36, paddingBottom: 60 }}>
        {/* Top Bar on Receipt */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Link href="/" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            ← Home
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThemeToggle />
            <InstallPwaButton label="Install App" className="btn btn-ghost btn-sm" />
          </div>
        </div>

        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "36px 24px",
            border: isReady ? "2px solid var(--success)" : "1px solid var(--border)",
            background: isReady ? "rgba(16, 185, 129, 0.04)" : "var(--card)",
          }}
        >
          {/* Status Header */}
          <div style={{ marginBottom: 20 }}>
            {isReady ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--success-bg)",
                  color: "var(--success)",
                  marginBottom: 12,
                }}
              >
                <PackageCheck size={32} />
              </div>
            ) : isPrinting ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                  marginBottom: 12,
                }}
              >
                <Printer size={32} />
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "var(--badge-bg)",
                  color: "var(--text)",
                  marginBottom: 12,
                }}
              >
                <Check size={28} />
              </div>
            )}

            <div
              style={{
                fontSize: "0.8125rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: isReady ? "var(--success)" : "var(--text-muted)",
                marginBottom: 4,
              }}
            >
              {isCompleted
                ? "COLLECTED"
                : isReady
                ? "READY FOR PICKUP"
                : isPrinting
                ? "PRINTING NOW"
                : "SENT SUCCESSFULLY"}
            </div>

            <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 2 }}>
              {isReady ? "Your print is ready." : "Request received."}
            </h1>
            <p className="text-muted" style={{ fontSize: "0.9375rem" }}>
              {isReady
                ? `Collect at ${receipt.shopName}`
                : isPrinting
                ? "The shop is printing your documents."
                : "You can leave now. We'll tell you when your print is ready."}
            </p>
          </div>

          {/* Prominent Human Order ID */}
          <div
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px 24px",
              maxWidth: 360,
              margin: "0 auto 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <span className="text-dim" style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                ORDER ID
              </span>
              <div style={{ fontSize: "2.25rem", fontWeight: 800, fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
                {receipt.orderNumber}
              </div>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={copyOrderId}
              style={{ display: "inline-flex", gap: 6 }}
            >
              <Copy size={14} />
              {copiedId ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Action buttons on receipt */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
            <Link
              href={receipt.statusUrl}
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center", fontWeight: 700 }}
            >
              <span>View live order tracker</span>
              <ExternalLink size={16} />
            </Link>

            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setReceipt(null);
                setFiles([]);
                setCustomerName("");
                setAdditionalRequirements("");
              }}
            >
              Send Another Document
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Primary Customer Screen: Document upload + Clear Print Options
  return (
    <div className="container-narrow" style={{ paddingTop: 36, paddingBottom: 60 }}>
      {/* Top Navbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link
          href="/print-centers"
          style={{ fontSize: "0.8125rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          ← All Print Centers
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchNearbyShops}
            style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <MapPin size={13} style={{ color: "var(--primary)" }} />
            <span>Nearby Shops</span>
          </button>
          <ThemeToggle />
          <InstallPwaButton label="Install" className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", fontSize: "0.75rem" }} />
        </div>
      </div>

      {/* Center Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 6 }}>
          {shop.name}
        </h1>
        <p className="text-muted" style={{ fontSize: "0.9375rem" }}>
          Upload your document and choose how you want it printed.
        </p>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        style={{ display: "none" }}
        onChange={(e) => {
          handleFileSelect(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Primary Interaction Area */}
      {files.length === 0 ? (
        /* Zero files state: Clean, massive tap target */
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "var(--radius-xl)",
            padding: "54px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: "var(--card)",
            transition: "all 0.2s ease",
            marginBottom: 20,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--primary)";
            e.currentTarget.style.background = "var(--card-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--card)";
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              marginBottom: 16,
            }}
          >
            <Plus size={32} />
          </div>

          <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: 6 }}>
            Add document
          </div>

          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            PDF, Word (.docx) or image (PNG, JPG)
          </p>
        </div>
      ) : (
        /* Document Selected State: Rich, Clear Print Options */
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          {/* Selected Documents List */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                {files.length === 1 ? "1 DOCUMENT READY" : `${files.length} DOCUMENTS READY`}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: "0.8125rem", color: "var(--primary)", padding: "4px 8px" }}
              >
                + Add more
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((item) => (
                <div
                  key={item.id}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Check size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "0.9375rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.file.name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                        {item.sizeFormatted} · Untouched original
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    style={{ color: "var(--text-dim)", padding: 6, display: "flex", alignItems: "center" }}
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ================= HOW TO PRINT (CLEAR & EXPLICIT OPTIONS) ================= */}
          <div
            style={{
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "20px 18px",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
              <Printer size={18} style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                How to print your document
              </span>
            </div>

            {/* 1. Color Choice (Big, visual radio cards) */}
            <div>
              <label className="form-label" style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
                Color Mode
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPrintColor("BW")}
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    border: printColor === "BW" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: printColor === "BW" ? "var(--card)" : "transparent",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--text)" }}>
                    🔲 Black & White
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Standard printouts
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintColor("COLOR")}
                  style={{
                    padding: "12px",
                    borderRadius: "var(--radius-md)",
                    border: printColor === "COLOR" ? "2px solid #ec4899" : "1px solid var(--border)",
                    background: printColor === "COLOR" ? "var(--card)" : "transparent",
                    textAlign: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: "0.9375rem", color: printColor === "COLOR" ? "#ec4899" : "var(--text)" }}>
                    🌈 Full Color
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                    Vibrant certificates & photos
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Number of Copies (Stepper + Quick Chips) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label className="form-label" style={{ fontSize: "0.8125rem", margin: 0 }}>
                  Number of Copies
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 5, 10].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCopies(preset)}
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: "0.75rem",
                        fontWeight: copies === preset ? 800 : 500,
                        background: copies === preset ? "var(--primary)" : "var(--badge-bg)",
                        color: copies === preset ? "var(--primary-foreground)" : "var(--text-muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--card)" }}>
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  style={{ padding: "8px 16px", fontSize: "1.125rem", fontWeight: 700 }}
                >
                  −
                </button>
                <span style={{ padding: "8px 20px", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1rem", minWidth: 50, textAlign: "center" }}>
                  {copies}
                </span>
                <button
                  type="button"
                  onClick={() => setCopies((c) => Math.min(999, c + 1))}
                  style={{ padding: "8px 16px", fontSize: "1.125rem", fontWeight: 700 }}
                >
                  +
                </button>
              </div>
            </div>

            {/* 3. Sides / Duplex & Paper Size in two columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label" style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
                  Sides
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setDuplex("SINGLE")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: duplex === "SINGLE" ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: duplex === "SINGLE" ? "var(--card)" : "transparent",
                      color: "var(--text)",
                      fontWeight: duplex === "SINGLE" ? 700 : 500,
                      fontSize: "0.8125rem",
                      textAlign: "left",
                    }}
                  >
                    📄 Single-sided
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplex("DOUBLE")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: duplex === "DOUBLE" ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: duplex === "DOUBLE" ? "var(--card)" : "transparent",
                      color: "var(--text)",
                      fontWeight: duplex === "DOUBLE" ? 700 : 500,
                      fontSize: "0.8125rem",
                      textAlign: "left",
                    }}
                  >
                    🔄 Back-to-Back
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
                  Paper Size
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setPaperSize("A4")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: paperSize === "A4" ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: paperSize === "A4" ? "var(--card)" : "transparent",
                      color: "var(--text)",
                      fontWeight: paperSize === "A4" ? 700 : 500,
                      fontSize: "0.8125rem",
                      textAlign: "left",
                    }}
                  >
                    A4 (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaperSize("A3")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: paperSize === "A3" ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: paperSize === "A3" ? "var(--card)" : "transparent",
                      color: "var(--text)",
                      fontWeight: paperSize === "A3" ? 700 : 500,
                      fontSize: "0.8125rem",
                      textAlign: "left",
                    }}
                  >
                    A3 (Large)
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Page Range */}
            <div>
              <label className="form-label" style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
                Pages to Print
              </label>
              <div style={{ display: "flex", gap: 8, marginBottom: pageSelection === "CUSTOM" ? 8 : 0 }}>
                <button
                  type="button"
                  onClick={() => setPageSelection("ALL")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: pageSelection === "ALL" ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: pageSelection === "ALL" ? "var(--card)" : "transparent",
                    color: "var(--text)",
                    fontWeight: pageSelection === "ALL" ? 700 : 500,
                    fontSize: "0.8125rem",
                  }}
                >
                  All pages
                </button>
                <button
                  type="button"
                  onClick={() => setPageSelection("CUSTOM")}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: pageSelection === "CUSTOM" ? "1px solid var(--primary)" : "1px solid var(--border)",
                    background: pageSelection === "CUSTOM" ? "var(--card)" : "transparent",
                    color: "var(--text)",
                    fontWeight: pageSelection === "CUSTOM" ? 700 : 500,
                    fontSize: "0.8125rem",
                  }}
                >
                  Specific pages
                </button>
              </div>

              {pageSelection === "CUSTOM" && (
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1-5, 8, 12-15"
                  value={customPages}
                  onChange={(e) => setCustomPages(e.target.value)}
                  style={{ fontSize: "0.875rem", background: "var(--card)" }}
                />
              )}
            </div>

            {/* 5. Finishing & Binding options */}
            <div>
              <label className="form-label" style={{ fontSize: "0.8125rem", marginBottom: 6 }}>
                Finishing / Binding (Optional)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {[
                  { id: "NONE" as const, label: "None" },
                  { id: "STAPLE" as const, label: "📎 Staple" },
                  { id: "SPIRAL" as const, label: "🌀 Spiral" },
                  { id: "LAMINATE" as const, label: "🛡️ Laminate" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFinishing(f.id)}
                    style={{
                      padding: "6px 8px",
                      borderRadius: "var(--radius-sm)",
                      border: finishing === f.id ? "1px solid var(--primary)" : "1px solid var(--border)",
                      background: finishing === f.id ? "var(--card)" : "transparent",
                      color: "var(--text)",
                      fontWeight: finishing === f.id ? 700 : 500,
                      fontSize: "0.75rem",
                      textAlign: "center",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 6. Special Instructions */}
            <div>
              <label className="form-label" style={{ fontSize: "0.8125rem", marginBottom: 4 }}>
                Special Instructions for the Shop (Optional)
              </label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="e.g. Cover page in color, remaining B&W; staple top-left corner..."
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                style={{ fontSize: "0.8125rem", resize: "none", background: "var(--card)" }}
              />
            </div>
          </div>

          {/* Customer Name */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: "0.8125rem" }}>
              Your Name for Counter Pickup (Optional)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rahul / Alex"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ fontSize: "0.875rem" }}
            />
          </div>

          {/* ================= LIVE PRINT SUMMARY CALLOUT ================= */}
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: "0.8125rem",
            }}
          >
            <FileText size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700 }}>Summary: </span>
              <span>
                {printColor === "COLOR" ? "Full Color" : "Black & White"} · {copies} {copies === 1 ? "copy" : "copies"} · {paperSize} · {duplex === "DOUBLE" ? "Double-sided" : "Single-sided"} {pageSelection === "CUSTOM" && customPages ? `· Pages ${customPages}` : "· All pages"} {finishing !== "NONE" && `· ${finishing}`}
              </span>
            </div>
          </div>

          {submitError && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--danger)",
                fontSize: "0.875rem",
                marginBottom: 16,
              }}
            >
              {submitError}
            </div>
          )}

          {/* ONE DOMINANT ACTION BUTTON */}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={submitting || files.length === 0}
            onClick={handleSubmit}
            style={{
              width: "100%",
              justifyContent: "center",
              fontSize: "1.0625rem",
              fontWeight: 700,
              padding: "16px",
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Sending document...</span>
              </>
            ) : (
              <span>SEND FOR PRINT</span>
            )}
          </button>
        </div>
      )}

      {/* Reassuring footer notice */}
      <div style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.8125rem" }}>
        No account needed • Original quality preserved
      </div>

      {/* ================= NEARBY SHOPS DRAWER / MODAL ================= */}
      {showNearbyModal && (
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
          onClick={() => setShowNearbyModal(false)}
        >
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-xl)",
              padding: 24,
              maxWidth: 480,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={20} style={{ color: "var(--primary)" }} />
                <h3 className="text-h3" style={{ fontSize: "1.125rem", margin: 0 }}>Nearby Print Centers</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNearbyModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 16 }}>
              Find and send your documents to another print center near you:
            </p>

            {loadingNearby ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <Loader2 size={24} className="spin" style={{ margin: "0 auto", color: "var(--text-dim)" }} />
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {nearbyShops.map((item) => (
                  <div
                    key={item.slug}
                    style={{
                      padding: 14,
                      background: "var(--bg-subtle)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{item.locality}, {item.city}</span>
                        {item.distanceFormatted && (
                          <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                            • {item.distanceFormatted} away
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={item.uploadUrl}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: "0.75rem", padding: "6px 12px" }}
                    >
                      Switch
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { CustomerPrintForm as PrintOrderForm };
