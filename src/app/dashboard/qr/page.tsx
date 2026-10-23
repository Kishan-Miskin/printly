"use client";

import React, { useState, useEffect } from "react";
import {
  QrCode,
  Printer,
  Download,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Check,
  AlertTriangle,
  Wifi,
  Globe,
  Info,
} from "lucide-react";

interface QRResponse {
  shopName: string;
  publicToken: string;
  publicUrl: string;
  targetHost: string;
  primaryLanIp: string;
  port: string;
  lanIps: Array<{ name: string; address: string; isWifi: boolean }>;
  qrDataUrl: string;
  qrSvg: string;
}

export default function CounterQRPage() {
  const [data, setData] = useState<QRResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [selectedHost, setSelectedHost] = useState<string>("");
  const [customHostInput, setCustomHostInput] = useState<string>("");

  const fetchQR = async (overrideHost?: string) => {
    setLoading(true);
    try {
      let url = "/api/shop/qr";
      const hostToUse = overrideHost !== undefined ? overrideHost : selectedHost;
      if (hostToUse) {
        url += `?customHost=${encodeURIComponent(hostToUse)}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok) {
        setData(json);
        if (!selectedHost && json.targetHost) {
          setSelectedHost(json.targetHost);
        }
      }
    } catch (err) {
      console.error("Failed to fetch QR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQR();
  }, []);

  const handleApplyHost = (host: string) => {
    setSelectedHost(host);
    fetchQR(host);
  };

  const handleCopyLink = () => {
    if (!data) return;
    navigator.clipboard.writeText(data.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPNG = () => {
    if (!data) return;
    const link = document.createElement("a");
    link.href = data.qrDataUrl;
    link.download = `${data.shopName.toLowerCase().replace(/\s+/g, "-")}-counter-qr.png`;
    link.click();
  };

  const handleDownloadSVG = () => {
    if (!data) return;
    const blob = new Blob([data.qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.shopName.toLowerCase().replace(/\s+/g, "-")}-counter-qr.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRegenerateQR = async () => {
    if (!confirm("Are you sure you want to regenerate your shop QR code? Any previously printed posters will stop accepting new orders.")) {
      return;
    }

    setRegenerating(true);
    try {
      const res = await fetch("/api/shop/qr", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        alert("QR code regenerated! Please print a new counter poster.");
        await fetchQR();
      } else {
        alert(json.error || "Failed to regenerate QR");
      }
    } catch {
      alert("Error regenerating QR");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading && !data) {
    return <div style={{ padding: 40, textAlign: "center" }} className="text-muted">Loading Counter QR...</div>;
  }

  if (!data) {
    return <div style={{ padding: 40, textAlign: "center" }} className="text-muted">Unable to load QR data.</div>;
  }

  return (
    <div>
      {/* Title & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }} className="no-print">
        <div>
          <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
            Counter QR & Printable Poster
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Place this QR at your Xerox counter. Customers scan with their phone camera to submit print jobs.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={16} />
            Print Counter Poster
          </button>
          <button className="btn btn-secondary" onClick={handleDownloadPNG}>
            <Download size={16} />
            Download PNG
          </button>
          <button className="btn btn-secondary" onClick={handleDownloadSVG}>
            <Download size={16} />
            Download SVG
          </button>
        </div>
      </div>

      {/* Mobile Wi-Fi Network Advisory Banner */}
      <div
        className="card no-print"
        style={{
          background: "rgba(59, 130, 246, 0.06)",
          border: "1px solid rgba(59, 130, 246, 0.25)",
          marginBottom: 24,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Wifi size={20} style={{ color: "#60a5fa", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#bfdbfe", marginBottom: 4 }}>
              Connecting from Mobile Phone (Wi-Fi vs Cellular)
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#d1d5db", lineHeight: 1.5, marginBottom: 10 }}>
              Phones scanning a QR code cannot open <code>localhost</code> because on a mobile device, localhost refers to the phone itself.
              PrintFlow automatically generated this QR code using your computer&apos;s Wi-Fi network address:{" "}
              <strong style={{ color: "var(--primary)", fontFamily: "var(--font-mono)" }}>{data.publicUrl}</strong>.
            </p>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              ✓ <strong>For local testing:</strong> Ensure your phone is connected to the same Wi-Fi network as this PC.<br />
              ✓ <strong>For mobile data (4G/5G) or production:</strong> Enter a public domain or tunnel URL below.
            </div>
          </div>
        </div>
      </div>

      {/* Screen View Container */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="no-print">
        {/* Counter Poster Preview Card */}
        <div
          style={{
            background: "#ffffff",
            color: "#000000",
            borderRadius: "var(--radius-lg)",
            padding: 36,
            textAlign: "center",
            boxShadow: "var(--shadow-lg)",
            border: "2px solid #e4e4e7",
          }}
        >
          <div style={{ fontSize: "0.8125rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.15em", color: "#71717a", marginBottom: 8 }}>
            SCAN • UPLOAD • PRINT
          </div>

          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
            {data.shopName}
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#52525b", marginBottom: 20 }}>
            Direct Digital Printing from Your Phone
          </p>

          {/* Large High-Res QR code */}
          <div style={{ display: "inline-block", padding: 16, background: "#ffffff", border: "3px solid #000000", borderRadius: 16, marginBottom: 20 }}>
            <img
              src={data.qrDataUrl}
              alt="Counter Print QR"
              style={{ width: 220, height: 220, display: "block" }}
            />
          </div>

          <div style={{ fontSize: "0.75rem", color: "#71717a", fontFamily: "var(--font-mono)", marginBottom: 20, wordBreak: "break-all" }}>
            {data.publicUrl}
          </div>

          {/* 4 Simple Steps */}
          <div style={{ textAlign: "left", background: "#f4f4f5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: "0.8125rem", color: "#18181b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              HOW IT WORKS:
            </div>
            <ol style={{ fontSize: "0.8125rem", color: "#27272a", paddingLeft: 18, lineHeight: 1.6 }}>
              <li><strong>Scan QR</strong> with your phone camera</li>
              <li><strong>Upload documents</strong> (PDF, Word, JPG, PNG)</li>
              <li><strong>Get Order ID + Pickup PIN</strong> instantly</li>
              <li><strong>Collect at counter</strong> using your PIN</li>
            </ol>
          </div>

          <div style={{ fontSize: "0.75rem", color: "#71717a", fontWeight: 600 }}>
            No app download • No account registration required
          </div>
        </div>

        {/* Technical Details & Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Target Network Host Selector */}
          <div className="card">
            <h3 className="text-h3" style={{ fontSize: "1.0625rem", marginBottom: 8 }}>
              QR Code Network Address
            </h3>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 14 }}>
              Choose which network address the QR code should point to:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {data.lanIps.map((ip) => {
                const hostVal = `${ip.address}:${data.port}`;
                const isSelected = data.targetHost === hostVal;
                return (
                  <button
                    key={ip.address}
                    type="button"
                    onClick={() => handleApplyHost(hostVal)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "var(--radius-md)",
                      background: isSelected ? "var(--badge-bg)" : "var(--bg-subtle)",
                      border: isSelected ? "1px solid var(--primary)" : "1px solid var(--border)",
                      color: "var(--text)",
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                        {ip.name} {ip.isWifi && "(Wi-Fi Recommended)"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                        http://{hostVal}/p/{data.publicToken}
                      </div>
                    </div>
                    {isSelected && <span className="badge badge-ready">Active</span>}
                  </button>
                );
              })}
            </div>

            {/* Custom Host / Tunnel input */}
            <div>
              <label className="form-label" style={{ fontSize: "0.75rem" }}>
                Or Use Custom Domain / Tunnel URL (e.g. ngrok or production domain)
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="form-input font-mono"
                  style={{ fontSize: "0.8125rem" }}
                  placeholder="e.g. print.yourshop.com or abc.ngrok-free.app"
                  value={customHostInput}
                  onChange={(e) => setCustomHostInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!customHostInput.trim()}
                  onClick={() => handleApplyHost(customHostInput.trim())}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-h3" style={{ fontSize: "1.0625rem", marginBottom: 12 }}>
              Public Counter Link
            </h3>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                readOnly
                className="form-input font-mono"
                value={data.publicUrl}
                style={{ fontSize: "0.8125rem" }}
              />
              <button className="btn btn-secondary" onClick={handleCopyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <a
              href={data.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ display: "inline-flex", gap: 6 }}
            >
              <span>Test Customer Experience in New Tab</span>
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Regeneration Security Box */}
          <div className="card" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "var(--warning)" }}>
              <AlertTriangle size={18} />
              <h3 className="text-h3" style={{ fontSize: "1rem" }}>
                Regenerate QR Code
              </h3>
            </div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 16 }}>
              If your printed poster is damaged or you need to invalidate old ordering links, you can regenerate your shop token. Previous QR posters will immediately become inactive.
            </p>

            <button
              className="btn btn-danger btn-sm"
              disabled={regenerating}
              onClick={handleRegenerateQR}
            >
              <RefreshCw size={14} />
              {regenerating ? "Regenerating..." : "Regenerate Counter QR Token"}
            </button>
          </div>
        </div>
      </div>

      {/* Print-Only Poster Layout */}
      <div
        className="print-only"
        style={{
          display: "none",
          width: "100%",
          maxWidth: "800px",
          margin: "0 auto",
          padding: "40px",
          textAlign: "center",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#52525b", marginBottom: 12 }}>
          PRINTFLOW DIGITAL COUNTER
        </div>

        <h1 style={{ fontSize: "42px", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8, color: "#000" }}>
          {data.shopName}
        </h1>
        <p style={{ fontSize: "20px", color: "#3f3f46", marginBottom: 36 }}>
          Scan to print documents directly from your phone
        </p>

        <div style={{ display: "inline-block", padding: "24px", border: "6px solid #000000", borderRadius: "24px", marginBottom: 36 }}>
          <img
            src={data.qrDataUrl}
            alt="PrintFlow Counter QR"
            style={{ width: "360px", height: "360px", display: "block" }}
          />
        </div>

        <div style={{ maxWidth: "560px", margin: "0 auto 36px", textAlign: "left", background: "#f4f4f5", padding: "24px", borderRadius: "16px", border: "2px solid #e4e4e7" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: 12, color: "#000" }}>
            HOW TO PRINT:
          </div>
          <ol style={{ fontSize: "16px", lineHeight: 1.8, color: "#18181b", paddingLeft: "24px" }}>
            <li>Open camera and <strong>scan the QR code</strong></li>
            <li>Upload PDF, Word document, or Photos</li>
            <li>Select color, paper size, and add special instructions</li>
            <li>Receive your <strong>Order ID + 6-digit Pickup PIN</strong></li>
            <li>Show your PIN at the counter to collect your prints</li>
          </ol>
        </div>

        <div style={{ fontSize: "16px", fontWeight: 700, color: "#71717a" }}>
          Zero App Required • Private & Encrypted • Original Quality Preserved
        </div>
      </div>
    </div>
  );
}
