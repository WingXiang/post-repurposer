import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import "./globals.css";

// 自託管 Noto Sans TC（繁中最佳化）+ swap，移除外部 CDN 阻塞 —— 釐清規格 E5
const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-sans-tc",
  preload: false,
});

export const metadata: Metadata = {
  title: "跨平台貼文改編器｜Wing 數位顧問 AI 工具組",
  description:
    "一篇內容，貼一次，自動產出 Facebook、Instagram、LinkedIn、Threads、電子報的最佳版本。",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${notoSansTC.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
