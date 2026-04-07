import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
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

const siteUrl = "https://www.keelungsbir.tw";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "115年度基隆市地方型 SBIR 計畫申請系統",
    template: "%s | 115年度基隆市地方型 SBIR 計畫申請系統",
  },
  description:
    "提供基隆市在地企業線上申請地方型產業創新研發推動計畫 (SBIR) 之專屬入口平台。",
  keywords: ["基隆", "SBIR", "地方創生", "研發補助", "產業創新", "中小企業補助", "基隆市政府"],
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon.png?v=2", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico?v=2" }],
  },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    url: "/",
    siteName: "115年度基隆市地方型 SBIR 計畫申請系統",
    title: "115年度基隆市地方型 SBIR 計畫申請系統",
    description: "提供基隆市在地企業線上申請地方型產業創新研發推動計畫 (SBIR) 之專屬入口平台。",
    images: [
      {
        url: new URL("/og-image.jpg", siteUrl).toString(),
        width: 1200,
        height: 630,
        alt: "115年度基隆市地方型 SBIR 計畫申請系統",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "115年度基隆市地方型 SBIR 計畫申請系統",
    description: "提供基隆市在地企業線上申請地方型產業創新研發推動計畫 (SBIR) 之專屬入口平台。",
    images: [new URL("/og-image.jpg", siteUrl).toString()],
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
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <GoogleAnalytics gaId="G-BML2TT19VK" />
      </body>
    </html>
  );
}
