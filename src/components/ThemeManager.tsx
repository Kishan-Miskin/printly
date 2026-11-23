"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Sun, Moon, Laptop, ChevronDown, Check } from "lucide-react";

export type ThemeMode = "system" | "light" | "dark";

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: "system",
  resolvedTheme: "dark",
  setThemeMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = (localStorage.getItem("printflow-theme") as ThemeMode) || "system";
      if (saved === "light" || saved === "dark" || saved === "system") {
        setThemeModeState(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      let active: "light" | "dark" = "dark";
      if (themeMode === "system") {
        active = mediaQuery.matches ? "dark" : "light";
      } else {
        active = themeMode;
      }

      setResolvedTheme(active);
      document.documentElement.setAttribute("data-theme", active);
      document.documentElement.style.colorScheme = active;

      try {
        localStorage.setItem("printflow-theme", themeMode);
      } catch {}
    };

    applyTheme();

    const handleMediaChange = () => {
      if (themeMode === "system") {
        applyTheme();
      }
    };

    mediaQuery.addEventListener("change", handleMediaChange);
    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, [themeMode, mounted]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, resolvedTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({
  className = "btn btn-ghost btn-sm",
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = () => {
    if (themeMode === "system") {
      return <Laptop size={15} style={{ color: "var(--text-muted)" }} />;
    }
    if (themeMode === "light") {
      return <Sun size={15} style={{ color: "#d97706" }} />;
    }
    return <Moon size={15} style={{ color: "#818cf8" }} />;
  };

  const getLabel = () => {
    if (themeMode === "system") return "System";
    if (themeMode === "light") return "Off-White";
    return "Dark";
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className={className}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle theme"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8125rem",
          fontWeight: 600,
          border: "1px solid var(--border)",
          background: "var(--card)",
          color: "var(--text)",
        }}
      >
        {getIcon()}
        {showLabel && <span>{getLabel()}</span>}
        <ChevronDown size={12} style={{ opacity: 0.6 }} />
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 6px)",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 4,
              minWidth: 150,
              zIndex: 999,
              boxShadow: "var(--shadow-md)",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {[
              { id: "system" as ThemeMode, label: "System Default", icon: Laptop },
              { id: "light" as ThemeMode, label: "Off-White (Light)", icon: Sun },
              { id: "dark" as ThemeMode, label: "Dark Mode", icon: Moon },
            ].map((opt) => {
              const Icon = opt.icon;
              const isSelected = themeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setThemeMode(opt.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8125rem",
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "var(--text)" : "var(--text-muted)",
                    background: isSelected ? "var(--bg-subtle)" : "transparent",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={14} style={{ color: isSelected ? "var(--primary)" : "inherit" }} />
                    <span>{opt.label}</span>
                  </div>
                  {isSelected && <Check size={14} style={{ color: "var(--primary)" }} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
