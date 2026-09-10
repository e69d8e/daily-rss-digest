"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Next.js Global Error caught exception:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <head>
        <title>页面加载异常 · Daily Briefing</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
                background-color: #fcfbf9;
                color: #1c1917;
                display: flex;
                min-height: 100vh;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
              }
              .card {
                background: #ffffff;
                border: 1px solid #eae6df;
                border-radius: 16px;
                padding: 32px 24px;
                max-width: 440px;
                margin: 20px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0,0,0,0.05);
              }
              .icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                background-color: #fef3c7;
                color: #92400e;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 16px;
                font-size: 24px;
              }
              h1 {
                font-size: 20px;
                font-weight: 700;
                margin: 0 0 8px;
                color: #1c1917;
              }
              p {
                font-size: 13px;
                color: #78716c;
                line-height: 1.6;
                margin: 0 0 24px;
              }
              .btn-group {
                display: flex;
                gap: 10px;
                justify-content: center;
              }
              button {
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
              }
              .btn-primary {
                background-color: #1c1917;
                color: #ffffff;
              }
              .btn-primary:hover {
                background-color: #92400e;
              }
              .btn-secondary {
                background-color: #f5f5f4;
                color: #44403c;
                border: 1px solid #e7e5e4;
              }
              .error-info {
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px dashed #eae6df;
                font-family: monospace;
                font-size: 11px;
                color: #a8a29e;
                word-break: break-all;
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="card">
          <div className="icon">⚠️</div>
          <h1>晨报遇到意外错误</h1>
          <p>页面在客户端初始化时遇到异常。您可以点击重新尝试加载，或刷新浏览器页面。</p>
          <div className="btn-group">
            <button className="btn-primary" onClick={() => reset()}>
              重新加载
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              返回主页
            </button>
          </div>
          {error?.message && (
            <div className="error-info">
              {error.message}
              {error.digest && <div>错误识别码: {error.digest}</div>}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
