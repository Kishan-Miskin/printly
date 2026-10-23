import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrintFlow — Multi-Tenant SaaS for Local Xerox & Print Shops",
  description: "Secure, tamper-proof print workflow. Scan QR, upload documents with exact quality preservation, obtain Order ID & Pickup PIN, and verify handover.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
