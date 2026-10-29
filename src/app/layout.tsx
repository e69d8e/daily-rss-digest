import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { ConfirmProvider } from "@/components/ui/ConfirmModal";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeContext";

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

// 阻塞式主题预置：在首帧绘制前从 localStorage 恢复用户主题，避免深色用户刷新时闪现纸质亮色（FOUC）。
// 与 ThemeContext 的存储 key 与合法值保持一致。
const themePresetScript = `(function(){try{var t=localStorage.getItem("daily_rss_theme");if(t==="light"||t==="midnight")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="paper" suppressHydrationWarning>
      <body className="min-h-screen flex flex-col selection:bg-amber-100 selection:text-amber-900 transition-colors duration-200">
        <script dangerouslySetInnerHTML={{ __html: themePresetScript }} />
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Navbar />
              <div className="flex-1">{children}</div>
              <footer className="border-t border-[#eae6df] py-8 mt-16 text-center text-xs text-stone-400">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-1">
                  <p className="font-serif font-medium text-stone-600">Daily Briefing · 每日智汇晨报</p>
                  <p className="text-[11px] text-stone-400/80">
                    多源聚合 · 智能聚类 · AI 深度提炼 · 语音早报伴读
                  </p>
                </div>
              </footer>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
