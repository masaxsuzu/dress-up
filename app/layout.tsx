import type { Viewport } from "next";
import "./globals.css";

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
      </body>
    </html>
  );
}
