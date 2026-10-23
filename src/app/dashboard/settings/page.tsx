"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Store,
  Clock,
  ShieldCheck,
  FileCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function ShopSettingsPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [retentionHours, setRetentionHours] = useState(24);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(20);
  const [maxFilesPerOrder, setMaxFilesPerOrder] = useState(10);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/shop");
        const data = await res.json();
        if (res.ok && data.shop) {
          setName(data.shop.name || "");
          setPhone(data.shop.phone || "");
          setAddress(data.shop.address || "");
          setHours(data.shop.hours || "");
          setIsOpen(Boolean(data.shop.is_open));
          if (data.shop.settings) {
            setRetentionHours(data.shop.settings.retention_hours || 24);
            setMaxFileSizeMb(data.shop.settings.max_file_size_mb || 20);
            setMaxFilesPerOrder(data.shop.settings.max_files_per_order || 10);
          }
        }
      } catch {
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          address,
          hours,
          is_open: isOpen,
          settings: {
            retention_hours: Number(retentionHours),
            max_file_size_mb: Number(maxFileSizeMb),
            max_files_per_order: Number(maxFilesPerOrder),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update settings");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }} className="text-muted">Loading settings...</div>;
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Title */}
      <div style={{ marginBottom: 28 }}>
        <h1 className="text-h1" style={{ fontSize: "1.75rem", marginBottom: 4 }}>
          Shop Settings
        </h1>
        <p className="text-muted" style={{ fontSize: "0.875rem" }}>
          Configure business profile, counter operating status, and document retention rules.
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {saveSuccess && (
          <div style={{ background: "var(--success-bg)", border: "1px solid var(--success-border)", borderRadius: "var(--radius-md)", padding: 12, color: "var(--success)", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>Settings saved successfully</span>
          </div>
        )}

        {error && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-md)", padding: 12, color: "var(--danger)", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Counter Open / Closed Switch */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="text-h3" style={{ fontSize: "1.0625rem", marginBottom: 4 }}>
                Counter Acceptance Status
              </h2>
              <p className="text-muted" style={{ fontSize: "0.8125rem" }}>
                {isOpen ? "Shop is OPEN and accepting incoming customer uploads." : "Shop is CLOSED. Customers scanning the QR will see opening hours."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={isOpen ? "btn btn-success" : "btn btn-danger"}
              style={{ minWidth: 110 }}
            >
              {isOpen ? "OPEN" : "CLOSED"}
            </button>
          </div>
        </div>

        {/* Shop Business Profile */}
        <div className="card">
          <h2 className="text-h3" style={{ fontSize: "1.0625rem", marginBottom: 16 }}>
            Shop Information
          </h2>

          <div className="form-group">
            <label className="form-label">Shop Name</label>
            <input
              type="text"
              required
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Counter Phone</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Operating Hours</label>
              <input
                type="text"
                className="form-input"
                placeholder="9:00 AM - 9:00 PM"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Physical Counter Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="Shop No. 4, College Road..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
        </div>

        {/* Document Retention & Storage Policy */}
        <div className="card">
          <h2 className="text-h3" style={{ fontSize: "1.0625rem", marginBottom: 6 }}>
            Document Retention & Privacy Policy
          </h2>
          <p className="text-muted" style={{ fontSize: "0.8125rem", marginBottom: 16 }}>
            PrintFlow prioritizes document privacy. Customer files are automatically and permanently deleted from disk after the retention period.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Retention (Hours)</label>
              <input
                type="number"
                min="1"
                max="720"
                className="form-input"
                value={retentionHours}
                onChange={(e) => setRetentionHours(parseInt(e.target.value) || 24)}
              />
              <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginTop: 4 }}>
                Auto-delete after completion
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Max File Size (MB)</label>
              <input
                type="number"
                min="1"
                max="100"
                className="form-input"
                value={maxFileSizeMb}
                onChange={(e) => setMaxFileSizeMb(parseInt(e.target.value) || 20)}
              />
              <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginTop: 4 }}>
                Per individual file
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Max Files / Order</label>
              <input
                type="number"
                min="1"
                max="30"
                className="form-input"
                value={maxFilesPerOrder}
                onChange={(e) => setMaxFilesPerOrder(parseInt(e.target.value) || 10)}
              />
              <span style={{ fontSize: "0.6875rem", color: "var(--text-dim)", marginTop: 4 }}>
                Per customer submission
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Saving Changes...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
