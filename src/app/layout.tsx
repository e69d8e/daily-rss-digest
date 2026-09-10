import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { ConfirmProvider } from "@/components/ui/ConfirmModal";

export const metadata: Metadata = {
  title: "Daily RSS Digest · 每日智汇晨报",
  description: "现代化每日多源 RSS 智汇晨报平台，多源去重、深度聚类、AI 提炼、语音晨报与多渠道触达。",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col bg-[#fcfbf9] text-stone-900 selection:bg-amber-100 selection:text-amber-900">
        <ConfirmProvider>
          <Navbar />
          <div className="flex-1">{children}</div>
          <footer className="border-t border-[#eae6df] py-8 mt-16 text-center text-xs text-stone-400">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="font-serif">Daily Briefing · 每日智汇晨报</p>
            </div>
          </footer>
        </ConfirmProvider>
      </body>
    </html>
  );
}
