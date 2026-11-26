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
        <meta name="color-scheme" content="light dark" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5"
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                color-scheme: light dark;
                --bg: #faf8f5;
                --card: #ffffff;
                --border: #dfd9ce;
                --ink: #1c1917;
                --muted: #635c56;
                --accent-bg: #fef3c7;
                --accent-fg: #9a3412;
                --btn-bg: #1c1917;
                --btn-fg: #ffffff;
                --btn-hover: #9a3412;
                --btn2-bg: #f6f4ef;
                --btn2-fg: #44403c;
              }
              @media (prefers-color-scheme: dark) {
                :root {
                  --bg: #111113;
                  --card: #18181b;
                  --border: #303036;
                  --ink: #f4f4f5;
                  --muted: #a1a1aa;
                  --accent-bg: rgba(245, 158, 11, 0.16);
                  --accent-fg: #fcd34d;
                  --btn-bg: #f59e0b;
                  --btn-fg: #18181b;
                  --btn-hover: #fbbf24;
                  --btn2-bg: #27272a;
                  --btn2-fg: #d4d4d8;
                }
              }
              body {
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", sans-serif;
                background-color: var(--bg);
                color: var(--ink);
                display: flex;
                min-height: 100dvh;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
              }
              .card {
                background: var(--card);
                border: 1px solid var(--border);
                border-radius: 1rem;
                padding: 2rem 1.5rem;
                max-width: 27.5rem;
                margin: 1.25rem;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
              }
              .icon {
                width: 3rem;
                height: 3rem;
                border-radius: 0.75rem;
                background-color: var(--accent-bg);
                color: var(--accent-fg);
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1rem;
                font-size: 1.5rem;
              }
              h1 {
                font-size: 1.25rem;
                font-weight: 700;
                margin: 0 0 0.5rem;
                text-wrap: balance;
              }
              p {
                font-size: 0.875rem;
                color: var(--muted);
                line-height: 1.6;
                margin: 0 0 1.5rem;
              }
              .btn-group {
                display: flex;
                gap: 0.625rem;
                justify-content: center;
                flex-wrap: wrap;
              }
              button {
                padding: 0.625rem 1.25rem;
                border-radius: 0.5rem;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                border: 1px solid transparent;
                transition: background-color 0.2s ease, color 0.2s ease;
              }
              button:focus-visible {
                outline: 2px solid var(--accent-fg);
                outline-offset: 2px;
              }
              .btn-primary {
                background-color: var(--btn-bg);
                color: var(--btn-fg);
              }
              .btn-primary:hover {
                background-color: var(--btn-hover);
              }
              .btn-secondary {
                background-color: var(--btn2-bg);
                color: var(--btn2-fg);
                border-color: var(--border);
              }
              .error-info {
                margin-top: 1.25rem;
                padding-top: 1rem;
                border-top: 1px dashed var(--border);
                font-family: monospace;
                font-size: 0.75rem;
                color: var(--muted);
                overflow-wrap: break-word;
              }
            `,
          }}
        />
      </head>
      <body>
        <main className="card">
          <div className="icon" aria-hidden="true">
            ⚠️
          </div>
          <h1>晨报遇到意外错误</h1>
          <p>
            页面在客户端初始化时遇到异常。您可以点击重新尝试加载，或返回首页。
          </p>
          <div className="btn-group">
            <button
              type="button"
              className="btn-primary"
              onClick={() => reset()}
            >
              重新加载
            </button>
            <button
              type="button"
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
        </main>
      </body>
    </html>
  );
}
