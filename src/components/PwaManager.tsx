"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaContextType {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  promptInstall: () => Promise<boolean>;
  showIosGuide: boolean;
  setShowIosGuide: (show: boolean) => void;
}

const PwaContext = createContext<PwaContextType>({
  canInstall: false,
  isInstalled: false,
  isIos: false,
  promptInstall: async () => false,
  showIosGuide: false,
  setShowIosGuide: () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err);
        });
    }

    // 2. Check if already running in standalone display mode
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      if (isStandalone) {
        setIsInstalled(true);
      }

      // Check for iOS
      const ua = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(ua);
      if (isApple && !isStandalone) {
        setIsIos(true);
      }
    }

    // 3. Listen for Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    // 4. Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
      console.log("[PWA] PrintFlow was installed successfully");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (isIos) {
      setShowIosGuide(true);
      return false;
    }

    if (!deferredPrompt) {
      return false;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return (
    <PwaContext.Provider
      value={{
        canInstall,
        isInstalled,
        isIos,
        promptInstall,
        showIosGuide,
        setShowIosGuide,
      }}
    >
      {children}

      {/* iOS Install Helper Modal */}
      {showIosGuide && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setShowIosGuide(false)}
        >
          <div
            style={{
              background: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "var(--radius-xl)",
              padding: 24,
              maxWidth: 420,
              width: "100%",
              marginBottom: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: "1.125rem" }}>Install PrintFlow on iPhone</div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                style={{ color: "var(--text-dim)", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-muted" style={{ fontSize: "0.875rem", marginBottom: 16 }}>
              Install PrintFlow on your home screen for instant access to print centers:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#27272a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Share size={18} style={{ color: "#60a5fa" }} />
                </div>
                <div style={{ fontSize: "0.875rem" }}>
                  1. Tap the <strong>Share</strong> button in Safari toolbar
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#27272a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PlusSquare size={18} style={{ color: "#34d399" }} />
                </div>
                <div style={{ fontSize: "0.875rem" }}>
                  2. Scroll down and tap <strong>Add to Home Screen</strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowIosGuide(false)}
              style={{ width: "100%", justifyContent: "center" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </PwaContext.Provider>
  );
}

// Subtle In-App Install Button component
export function InstallPwaButton({
  label = "Install App",
  className = "btn btn-secondary btn-sm",
  style,
}: {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { canInstall, isIos, isInstalled, promptInstall, setShowIosGuide } = usePwa();

  if (isInstalled) return null;
  if (!canInstall && !isIos) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (isIos) {
          setShowIosGuide(true);
        } else {
          promptInstall();
        }
      }}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}
    >
      <Download size={14} />
      <span>{label}</span>
    </button>
  );
}
