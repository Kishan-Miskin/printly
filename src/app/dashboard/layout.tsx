"use client";

import React, { useState, useEffect } from "react";
import Link from "next/navigation";
import { usePathname, useRouter } from "next/navigation";
import {
  Printer,
  LayoutDashboard,
  FileCheck2,
  QrCode,
  Settings,
  Users,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeManager";

interface AuthState {
  user: { id: string; name: string; email: string };
  shop: { id: string; name: string; slug: string; public_token: string; is_open: boolean };
  role: "SHOP_OWNER" | "SHOP_STAFF";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (!res.ok || !data.authenticated) {
          router.push("/login");
        } else {
          setAuth(data);
        }
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p className="text-muted">Loading shop terminal...</p>
      </div>
    );
  }

  if (!auth) return null;

  const navItems = [
    { href: "/dashboard", label: "Print Queue", icon: Printer },
    { href: "/dashboard/qr", label: "Shop Link & Poster", icon: QrCode },
    { href: "/dashboard/settings", label: "Settings", icon: Settings },
    { href: "/dashboard/staff", label: "Staff", icon: Users },
    { href: "/dashboard/security", label: "Security & Audit", icon: ShieldAlert },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Sidebar Desktop */}
      <aside
        style={{
          width: 260,
          background: "var(--card)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
        className="no-print"
      >
        {/* Shop Header */}
        <div style={{ padding: "24px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ padding: 6, borderRadius: "var(--radius-sm)", background: "var(--primary)", color: "#000" }}>
              <Printer size={20} />
            </div>
            <div style={{ fontWeight: 800, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
              PrintFlow
            </div>
          </div>
          <div style={{ fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {auth.shop.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: auth.shop.is_open ? "var(--success)" : "var(--danger)" }} />
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              {auth.shop.is_open ? "Counter Open" : "Counter Paused"}
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <nav style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--primary)" : "var(--text-muted)",
                  background: active ? "var(--badge-bg)" : "transparent",
                  border: active ? "1px solid var(--border)" : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={18} style={{ color: active ? "var(--primary)" : "var(--text-dim)" }} />
                  <span>{item.label}</span>
                </div>
              </a>
            );
          })}
        </nav>

        {/* Theme & Public QR Link Quick Access */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontWeight: 600 }}>Theme</span>
            <ThemeToggle />
          </div>

          <a
            href={`/p/${auth.shop.public_token}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            <span>Customer Scan Link</span>
            <ExternalLink size={12} />
          </a>
        </div>

        {/* User profile & logout */}
        <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{auth.user.name}</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-dim)" }}>{auth.role === "SHOP_OWNER" ? "Owner" : "Staff"}</div>
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            style={{ padding: 6, color: "var(--text-dim)" }}
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowX: "hidden" }}>
        {/* Mobile Header */}
        <header
          style={{
            padding: "16px 20px",
            background: "var(--card)",
            borderBottom: "1px solid var(--border)",
            display: "none",
            alignItems: "center",
            justifyContent: "space-between",
          }}
          className="no-print mobile-header"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Printer size={20} />
            <span style={{ fontWeight: 800 }}>{auth.shop.name}</span>
          </div>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="btn btn-ghost btn-sm">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div style={{ background: "var(--card)", borderBottom: "1px solid var(--border)", padding: 12 }} className="no-print">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  fontSize: "0.875rem",
                  color: pathname === item.href ? "var(--primary)" : "var(--text-muted)",
                }}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </a>
            ))}
            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm btn-block"
              style={{ marginTop: 8, justifyContent: "flex-start", gap: 10 }}
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>
        )}

        <main style={{ flex: 1, padding: "28px 24px", maxWidth: 1300, width: "100%", margin: "0 auto" }}>
          {children}
        </main>
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          aside {
            display: none !important;
          }
          .mobile-header {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
