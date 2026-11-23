"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Printer,
  Search,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Navigation,
  Loader2,
  FileText,
  AlertCircle,
  QrCode,
} from "lucide-react";
import { InstallPwaButton } from "@/components/PwaManager";
import { ThemeToggle } from "@/components/ThemeManager";

interface PrintCenter {
  name: string;
  slug: string;
  publicToken: string;
  description: string;
  city: string;
  locality: string;
  address: string;
  hours: string;
  isOpen: boolean;
  services: string[];
  allowedFormats: string[];
  uploadUrl: string;
  distanceFormatted?: string;
  distanceKm?: number;
}

export default function PrintCentersDirectoryPage() {
  const [centers, setCenters] = useState<PrintCenter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [totalCount, setTotalCount] = useState<number>(0);
  const [locationStatus, setLocationStatus] = useState<string>("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);

  const fetchCenters = async (q = "", coords = userCoords, dist = maxDistance) => {
    setLoading(true);
    try {
      let url = "/api/print-centers?limit=30";
      if (q.trim()) {
        url += `&q=${encodeURIComponent(q.trim())}`;
      }
      if (coords) {
        url += `&lat=${coords.lat}&lng=${coords.lng}&nearby=1`;
      }
      if (dist !== null) {
        url += `&maxDistance=${dist}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setCenters(data.centers || []);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch print centers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCenters();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCenters(searchQuery, userCoords, maxDistance);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Nearby Location Click
  const handleNearbyClick = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation not supported by your browser");
      return;
    }
    setLocationStatus("Detecting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocationStatus("Sorted by distance from your location");
        fetchCenters(searchQuery, coords, maxDistance);
      },
      () => {
        const demoCoords = { lat: 15.8600, lng: 74.5050 };
        setUserCoords(demoCoords);
        setLocationStatus("Showing nearby centers around Belagavi");
        fetchCenters(searchQuery, demoCoords, maxDistance);
      },
      { timeout: 6000 }
    );
  };

  const handleDistanceFilter = (dist: number | null) => {
    setMaxDistance(dist);
    fetchCenters(searchQuery, userCoords, dist);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Top Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "14px 20px",
          background: "var(--card)",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ padding: 5, borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Printer size={18} />
            </div>
            <span style={{ fontWeight: 800, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
              PrintFlow
            </span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ThemeToggle />
            <InstallPwaButton label="Install App" className="btn btn-secondary btn-sm" />
            <Link href="/login" className="btn btn-ghost btn-sm" style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
              Shop Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container-narrow" style={{ paddingTop: 36, paddingBottom: 60, flex: 1 }}>
        {/* Title */}
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 className="text-h1" style={{ fontSize: "clamp(1.75rem, 4vw, 2.25rem)", marginBottom: 8 }}>
            Find a Print Center
          </h1>
          <p className="text-muted" style={{ fontSize: "0.9375rem" }}>
            Send documents before you arrive. Collect in one trip.
          </p>
        </div>

        {/* Search & Location Bar */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "4px 6px 4px 16px",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Search size={18} style={{ color: "var(--text-dim)", flexShrink: 0, marginRight: 10 }} />
            <input
              type="text"
              placeholder="Search by shop name, area or city (e.g. College Road)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "0.9375rem",
                outline: "none",
                padding: "8px 0",
              }}
            />

            <button
              type="button"
              onClick={handleNearbyClick}
              className="btn btn-secondary btn-sm"
              title="Search nearby centers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "0.75rem",
                padding: "8px 12px",
                flexShrink: 0,
              }}
            >
              <Navigation size={14} style={{ color: "var(--primary)" }} />
              <span>Near Me</span>
            </button>
          </div>

          {locationStatus && (
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 6, paddingLeft: 8, display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={12} style={{ color: "var(--primary)" }} />
              <span>{locationStatus}</span>
            </div>
          )}
        </div>

        {/* Distance Filter Chips */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 700 }}>RADIUS:</span>
          {[
            { id: null, label: "All Centers" },
            { id: 1, label: "< 1 km" },
            { id: 3, label: "< 3 km" },
            { id: 5, label: "< 5 km" },
          ].map((item) => (
            <button
              key={String(item.id)}
              type="button"
              onClick={() => handleDistanceFilter(item.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 9999,
                fontSize: "0.75rem",
                fontWeight: maxDistance === item.id ? 700 : 500,
                background: maxDistance === item.id ? "var(--primary)" : "var(--badge-bg)",
                color: maxDistance === item.id ? "var(--primary-foreground)" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Results Count Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
            AVAILABLE PRINT CENTERS ({totalCount})
          </span>
          {loading && <Loader2 size={16} className="spin" style={{ color: "var(--text-dim)" }} />}
        </div>

        {/* Print Centers List */}
        {centers.length === 0 && !loading ? (
          /* Empty State */
          <div
            className="card"
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--card)",
              border: "1px dashed var(--border)",
            }}
          >
            <AlertCircle size={36} style={{ color: "var(--warning)", margin: "0 auto 12px" }} />
            <h2 className="text-h3" style={{ marginBottom: 6 }}>No print centers found</h2>
            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 16 }}>
              Try another area name, locality, or increase your search radius.
            </p>
            {(searchQuery || maxDistance !== null) && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery("");
                  setMaxDistance(null);
                  fetchCenters("", userCoords, null);
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {centers.map((center) => (
              <div
                key={center.slug}
                className="card"
                style={{
                  padding: 20,
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <div>
                    <h2 className="text-h2" style={{ fontSize: "1.25rem", marginBottom: 4 }}>
                      {center.name}
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <MapPin size={14} style={{ color: "var(--text-dim)" }} />
                        <span>{center.locality ? `${center.locality}, ${center.city}` : center.city}</span>
                      </div>
                      {center.distanceFormatted && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "2px 7px",
                            borderRadius: 4,
                            background: "var(--badge-bg)",
                            color: "var(--primary)",
                            fontWeight: 700,
                            fontSize: "0.6875rem",
                          }}
                        >
                          📍 {center.distanceFormatted} away
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open / Closed Badge */}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 9999,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: center.isOpen ? "var(--success-bg)" : "var(--badge-bg)",
                      color: center.isOpen ? "var(--success)" : "var(--text-dim)",
                      border: center.isOpen ? "1px solid var(--success-border)" : "1px solid var(--border)",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: center.isOpen ? "var(--success)" : "var(--text-dim)",
                      }}
                    />
                    <span>{center.isOpen ? "Open" : "Closed"}</span>
                  </span>
                </div>

                {/* Description */}
                <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                  {center.description}
                </p>

                {/* Services Chips */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {center.services.map((srv) => (
                    <span
                      key={srv}
                      style={{
                        fontSize: "0.6875rem",
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                      }}
                    >
                      {srv}
                    </span>
                  ))}
                  {center.hours && (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        padding: "2px 8px",
                        borderRadius: 4,
                        color: "var(--text-dim)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Clock size={12} />
                      <span>{center.hours}</span>
                    </span>
                  )}
                </div>

                {/* Single Dominant Action Button */}
                <Link
                  href={center.uploadUrl}
                  className="btn btn-primary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    fontWeight: 700,
                    padding: "12px",
                  }}
                >
                  <span>Upload documents here</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* QR Alternative Callout */}
        <div
          style={{
            marginTop: 36,
            padding: "20px 24px",
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              background: "var(--card)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <QrCode size={22} style={{ color: "var(--primary)" }} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.875rem", marginBottom: 2 }}>
              Have a shop counter QR code?
            </div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", margin: 0 }}>
              Scan the poster at any shop counter with your phone camera to send documents directly to their queue.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
