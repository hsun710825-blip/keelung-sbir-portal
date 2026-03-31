import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "基隆市地方型 SBIR 申請系統",
    template: "%s | 基隆市地方型 SBIR 申請系統",
  },
  description:
    "基隆市政府地方型產業創新研發推動計畫（地方型 SBIR）線上申請與計畫書撰寫系統，協助轄內中小企業申請創新技術與創新服務研發補助、促進地方產業升級與在地發展。",
  keywords: ["基隆", "SBIR", "地方創生", "研發補助", "產業創新", "中小企業補助", "基隆市政府"],
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "/",
    siteName: "基隆市地方型 SBIR 申請系統",
    title: "基隆市地方型 SBIR 申請系統",
    description:
      "基隆市政府地方型產業創新研發推動計畫線上申請與計畫書撰寫，支援在地企業創新研發與產業升級。",
  },
  twitter: {
    card: "summary_large_image",
    title: "基隆市地方型 SBIR 申請系統",
    description:
      "基隆市政府地方型產業創新研發推動計畫線上申請與計畫書撰寫，支援在地企業創新研發與產業升級。",
  },
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
