import type { Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";

export const metadata = {
  title: "dress-up",
  description: "personal wardrobe",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fafafa",
          color: "#111",
          WebkitTextSizeAdjust: "100%",
        }}
      >
        {children}
        {/* Spacer so page content isn't hidden behind the fixed bottom nav on mobile */}
        <div aria-hidden="true" className="bottom-nav-spacer" />
        <BottomNav />
      </body>
    </html>
  );
}
