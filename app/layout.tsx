import type { Metadata } from "next";
import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const notoSerifTC = Noto_Serif_TC({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-serif-tc-google",
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans-tc-google",
  display: "swap",
});

export const metadata: Metadata = {
  title: "劇本對練 — 一個人也能把對手戲練好",
  description:
    "不用約時間、不用拜託朋友陪你讀本。系統幫你念其他角色的台詞，你只負責把自己的演出來。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-TW"
      className={`${notoSerifTC.variable} ${notoSansTC.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
