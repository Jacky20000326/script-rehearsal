import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "劇本對練平台",
  description: "個人化讀本陪練系統",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className="bg-black text-white font-sans">{children}</body>
    </html>
  );
}
