"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Printer,
  Search,
  MapPin,
  Clock,
  ArrowRight,
  QrCode,
  Sparkles,
  Download,
  AlertCircle,
  Loader2,
  CheckCircle2,
  FileUp,
  Navigation,
} from "lucide-react";
import { InstallPwaButton, usePwa } from "@/components/PwaManager";
import { ThemeToggle } from "@/components/ThemeManager";

interface PrintCenter {
  name: string;
  slug: string;
  publicToken: string;
  description: string;
  city: string;
  locality: string;
  hours: string;
  isOpen: boolean;
  services: string[];
  uploadUrl: string;
  distanceFormatted?: string;
  distanceKm?: number;
}

export default function HomePage() {
  const [centers, setCenters] = useState<PrintCenter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [locationStatus, setLocationStatus] = useState<string>("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const { canInstall, isIos, isInstalled, promptInstall, setShowIosGuide } = usePwa();

  const fetchCenters = async (q = "", coords = userCoords, maxDist = distanceFilter) => {
    setLoading(true);
    try {
      let url = "/api/print-centers?limit=6";
      if (q.trim()) {
        url += `&q=${encodeURIComponent(q.trim())}`;
      }
      if (coords) {
        url += `&lat=${coords.lat}&lng=${coords.lng}&nearby=1`;
      }
      if (maxDist !== null) {
        url += `&maxDistance=${maxDist}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setCenters(data.centers || []);
      }
    } catch (err) {
      console.error("Failed to load centers:", err);
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
      fetchCenters(searchQuery, userCoords, distanceFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is not supported by your browser");
      return;
    }
    setLocationStatus("Detecting location...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoords(coords);
        setLocationStatus("Sorted by distance from your location");
        fetchCenters(searchQuery, coords, distanceFilter);
      },
      () => {
        // Fallback default coordinates for Belagavi demo area
        const demoCoords = { lat: 15.8600, lng: 74.5050 };
        setUserCoords(demoCoords);
        setLocationStatus("Showing nearby centers around Belagavi");
        fetchCenters(searchQuery, demoCoords, distanceFilter);
      },
      { timeout: 5000 }
    );
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      {/* Top Navbar */}
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
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "var(--primary-foreground)" }}>
              <Printer size={18} />
            </div>
            <span style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.03em" }}>
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

      {/* Hero: Customer Discovery & Direct Start */}
      <main className="container-narrow" style={{ paddingTop: 36, paddingBottom: 60, flex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 12px",
              borderRadius: 9999,
              background: "var(--badge-bg)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--primary)",
              marginBottom: 16,
            }}
          >
            <Sparkles size={14} />
            <span>Send once. Come once. Done.</span>
          </div>

          <h1 className="text-h1" style={{ fontSize: "clamp(2rem, 5vw, 2.75rem)", marginBottom: 12 }}>
            Send documents to a print center
          </h1>
          <p className="text-muted" style={{ fontSize: "clamp(0.9375rem, 2vw, 1.0625rem)", maxWidth: 520, margin: "0 auto" }}>
            Upload before you arrive. We&apos;ll notify you when your documents are ready for counter pickup.
          </p>
        </div>

        {/* Live Search Input & Near Me Button */}
        <div style={{ marginBottom: 20 }}>
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
            <Search size={18} style={{ color: "var(--text-dim)", marginRight: 10, flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search a print center (e.g. Apex Xerox, College Road)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: "0.9375rem",
                outline: "none",
                padding: "10px 0",
              }}
            />
            {loading && <Loader2 size={16} className="spin" style={{ color: "var(--text-dim)", marginRight: 8 }} />}

            <button
              type="button"
              onClick={handleNearMe}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "8px 12px" }}
              title="Find shops nearest to your current location"
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

        {/* Nearby / Popular Section */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
              {searchQuery ? "SEARCH RESULTS" : "NEARBY PRINT CENTERS"}
            </span>

            <Link href="/print-centers" style={{ fontSize: "0.8125rem", color: "var(--primary)", fontWeight: 600 }}>
              View all centers →
            </Link>
          </div>

          {centers.length === 0 && !loading ? (
            <div
              className="card"
              style={{
                padding: "40px 24px",
                textAlign: "center",
                border: "1px dashed var(--border)",
              }}
            >
              <AlertCircle size={32} style={{ color: "var(--warning)", margin: "0 auto 12px" }} />
              <h2 className="text-h3" style={{ fontSize: "1.125rem", marginBottom: 6 }}>No print centers found</h2>
              <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 16 }}>
                Try another shop name, area or clear your search term.
              </p>
              {searchQuery && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSearchQuery("")}
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {centers.map((center) => (
                <div
                  key={center.slug}
                  className="card"
                  style={{
                    padding: "18px 20px",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <h2 className="text-h2" style={{ fontSize: "1.125rem", marginBottom: 3 }}>
                        {center.name}
                      </h2>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={13} style={{ color: "var(--text-dim)" }} />
                          <span>{center.locality ? `${center.locality}, ${center.city}` : center.city}</span>
                        </div>
                        {center.distanceFormatted && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: "2px 6px",
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

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "3px 8px",
                        borderRadius: 9999,
                        fontSize: "0.6875rem",
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

                  <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                    {center.description}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {center.services.slice(0, 3).map((srv) => (
                        <span
                          key={srv}
                          style={{
                            fontSize: "0.6875rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--bg-subtle)",
                            border: "1px solid var(--border)",
                            color: "var(--text-dim)",
                          }}
                        >
                          {srv}
                        </span>
                      ))}
                    </div>

                    {/* Direct 1-tap Upload CTA */}
                    <Link
                      href={center.uploadUrl}
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700, padding: "8px 16px" }}
                    >
                      <span>Upload here</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section: Have a shop QR? */}
        <div
          className="card"
          style={{
            padding: "20px 24px",
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 24,
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
            <div style={{ fontWeight: 700, fontSize: "0.9375rem", marginBottom: 2 }}>
              Have a shop counter QR code?
            </div>
            <p className="text-muted" style={{ fontSize: "0.8125rem", margin: 0 }}>
              Scan the poster at any shop counter with your phone camera to send documents directly to their queue.
            </p>
          </div>
        </div>

        {/* Subtle PWA Install Banner */}
        {(!isInstalled && (canInstall || isIos)) && (
          <div
            style={{
              padding: "14px 18px",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Download size={16} style={{ color: "var(--primary)" }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                Print faster next time. Install PrintFlow on your phone.
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (isIos) {
                  setShowIosGuide(true);
                } else {
                  promptInstall();
                }
              }}
              style={{ fontSize: "0.75rem", padding: "6px 14px" }}
            >
              Install App
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--border)",
          padding: "24px 20px",
          textAlign: "center",
          fontSize: "0.8125rem",
          color: "var(--text-dim)",
          background: "var(--bg-subtle)",
        }}
      >
        <div className="container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span>© 2026 PrintFlow. Fast, account-free document printing.</span>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <Link href="/print-centers" style={{ color: "var(--text-muted)" }}>
              Print Centers
            </Link>
            <Link href="/login" style={{ color: "var(--text-muted)" }}>
              Operator Terminal
            </Link>
            <Link href="/register" style={{ color: "var(--text-muted)" }}>
              Register Shop
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
