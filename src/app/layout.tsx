import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import { ConfirmProvider } from "@/components/ui/ConfirmModal";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/components/ui/ThemeContext";
import PolyfillLoader from "@/components/ui/PolyfillLoader";

export const metadata: Metadata = {
  title: "Daily RSS Digest · 每日智汇晨报",
  description:
    "现代化每日多源 RSS 智汇晨报平台，多源去重、深度聚类、AI 提炼、语音晨报与多渠道触达。",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// 阻塞式主题预置脚本：紧跟 <meta name="color-scheme"> 执行，防止首帧闪烁（FOUC）。
// 若用户未覆盖则保持 "light dark" 并跟随操作系统配色偏好。
const themePresetScript = `(function(){try{var t=localStorage.getItem("daily_rss_theme");var m=document.querySelector('meta[name="color-scheme"]');if(t==="midnight"){if(m)m.content="dark";document.documentElement.setAttribute("data-theme","midnight");}else if(t==="paper"||t==="light"){if(m)m.content="light";document.documentElement.setAttribute("data-theme",t);}else{if(m)m.content="light dark";document.documentElement.removeAttribute("data-theme");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themePresetScript }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <a href="#main-content" className="skip-link visually-hidden">
          跳至主要内容
        </a>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <PolyfillLoader />
              <Navbar />
              <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
                {children}
              </main>
              <footer className="border-t border-line py-8 mt-16 text-center text-xs text-ink-muted">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-1">
                  <p className="font-serif font-medium text-ink-2">
                    Daily Briefing · 每日智汇晨报
                  </p>
                  <p className="text-xs text-ink-muted">
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
