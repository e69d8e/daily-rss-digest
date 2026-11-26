"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Rss,
  Layers,
  Sparkles,
  Send,
  ArrowLeft,
  Settings as SettingsIcon,
  Lock,
  ShieldAlert,
  LogOut,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import FeedsSettingsTab from "@/components/settings/FeedsSettingsTab";
import ChannelsSettingsTab from "@/components/settings/ChannelsSettingsTab";
import AiSettingsTab from "@/components/settings/AiSettingsTab";
import NotificationsSettingsTab from "@/components/settings/NotificationsSettingsTab";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ScrollFadeContainer from "@/components/ui/ScrollFadeContainer";
import { useToast } from "@/components/ui/Toast";

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") || "feeds";
  const tablistRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 访问鉴权状态
  const [authStatus, setAuthStatus] = useState<{
    required: boolean;
    authenticated: boolean;
    loading: boolean;
  }>({
    required: false,
    authenticated: true,
    loading: true,
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  // AI & Notification Data
  const [ai, setAi] = useState({
    provider: "deepseek",
    apiFormat: "chat_completions",
    apiKey: "",
    hasApiKey: false,
    isEnvKey: false,
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    temperature: 0.4,
  });

  const [notify, setNotify] = useState({
    feishuWebhook: "",
    wecomWebhook: "",
    telegramBotToken: "",
    telegramChatId: "",
    discordWebhook: "",
    smtpHost: "",
    smtpPort: 465,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    emailRecipients: "",
    enableFeishu: false,
    enableWecom: false,
    enableTelegram: false,
    enableDiscord: false,
    enableEmail: false,
  });

  const loadSettings = () => {
    fetch("/api/settings")
      .then((res) => {
        if (res.status === 401) {
          setAuthStatus((prev) => ({ ...prev, authenticated: false }));
          throw new Error("请先验证管理员密码");
        }
        return res.json();
      })
      .then((data) => {
        if (data.ai) setAi((prev) => ({ ...prev, ...data.ai }));
        if (data.notification)
          setNotify((prev) => ({ ...prev, ...data.notification }));
      })
      .catch((e) => {
        console.warn(e);
      });
  };

  useEffect(() => {
    fetch("/api/auth")
      .then((res) => res.json())
      .then((data) => {
        setAuthStatus({
          required: Boolean(data.required),
          authenticated: Boolean(data.authenticated),
          loading: false,
        });
        if (!data.required || data.authenticated) {
          loadSettings();
        }
      })
      .catch(() => {
        setAuthStatus((prev) => ({ ...prev, loading: false }));
        loadSettings();
      });
  }, []);

  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams, activeTab]);

  // 选中标签变化时将其滚动到可见区域
  useEffect(() => {
    const activeBtn = tablistRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    activeBtn?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/settings?tab=${tabId}`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passwordInput.trim();
    if (!trimmed) {
      setAuthError("请输入管理员访问密码后再解锁。");
      passwordInputRef.current?.focus();
      return;
    }

    setAuthSubmitting(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "密码错误，请重新输入");

      setAuthStatus((prev) => ({ ...prev, authenticated: true }));
      setPasswordInput("");
      setShowPassword(false);
      loadSettings();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "密码错误");
      passwordInputRef.current?.focus();
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthStatus((prev) => ({ ...prev, authenticated: false }));
  };

  const { toast } = useToast();

  const handleSaveSystemConfig = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ai, notification: notify }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存失败");
      }
      setSaveSuccess(true);
      toast.success("系统配置已成功保存！");
      setTimeout(() => setSaveSuccess(false), 3000);
      loadSettings();
    } catch (e) {
      toast.error(`保存失败: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "feeds", label: "订阅源与 OPML", icon: Rss },
    { id: "channels", label: "频道规则与定制", icon: Layers },
    { id: "ai", label: "AI 提炼引擎", icon: Sparkles },
    { id: "notifications", label: "多端推送分发", icon: Send },
  ];

  // 键盘漫游焦点回退（按回车/空格激活，避免切 Tab 时频繁触发 URL 变更与数据请求）
  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab =
        tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[
          nextIdx
        ];
      targetTab?.focus();
    }
  };

  // 1. 正在校验权限中
  if (authStatus.loading) {
    return (
      <div className="max-w-md mx-auto my-24 p-8 text-center text-ink-muted flex flex-col items-center gap-3">
        <LoadingSpinner label="正在加载安全策略" size="md" />
        <div className="text-xs">加载安全策略中...</div>
      </div>
    );
  }

  // 2. 开启了 ADMIN_PASSWORD 且未通过验证：符合 autofill-sign-in-form 的登录表单
  if (authStatus.required && !authStatus.authenticated) {
    const describedByIds = [
      "admin-password-hint",
      authError ? "admin-password-error" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="max-w-md mx-auto my-12 sm:my-16 px-4">
        <div className="bg-card rounded-2xl border border-line p-6 sm:p-8 shadow-md space-y-5">
          <div className="w-12 h-12 rounded-xl bg-brand-soft border border-brand-border/60 text-brand-ink flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" aria-hidden="true" />
          </div>

          <div className="text-center space-y-1">
            <h1 className="font-serif-title text-lg font-bold text-ink">
              设置中心 · 管理访问验证
            </h1>
            <p
              id="admin-password-hint"
              className="text-xs text-ink-muted leading-relaxed"
            >
              当前站点已在云端启用管理保护。请输入管理员密码（ADMIN_PASSWORD）以解锁配置面板。
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            method="post"
            aria-label="管理员登录验证"
            className="space-y-4"
            noValidate
          >
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                管理员密码 <span aria-hidden="true" className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  autoFocus
                  aria-invalid={authError ? "true" : "false"}
                  aria-describedby={describedByIds}
                  placeholder="请输入 ADMIN_PASSWORD"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError("");
                  }}
                  className="mwg-field-control w-full ps-3 pe-11 py-2.5 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  aria-describedby="toggle-admin-password-warning"
                  className="min-h-[32px] min-w-[32px] absolute end-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Eye className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
                <span
                  id="toggle-admin-password-warning"
                  className="visually-hidden"
                >
                  注意：开启后将在屏幕上明文显示密码。
                </span>
              </div>

              {authError && (
                <p
                  id="admin-password-error"
                  role="alert"
                  className="text-xs text-danger mt-2 flex items-center gap-1.5"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{authError}</span>
                </p>
              )}
            </div>

            {/* 遵循 forms 指南：不在校验前禁用提交按钮，仅在提交中禁用防重复提交 */}
            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full min-h-[40px] py-2.5 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {authSubmitting ? "校验中..." : "解锁进入设置中心"}
            </button>
          </form>

          <div className="pt-2 border-t border-line text-center">
            <Link
              href="/"
              className="text-xs text-ink-muted hover:text-ink transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>返回今日晨报主页</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const focusgroupAttrs = {
    focusgroup: "tablist nomemory",
  } as Record<string, string>;

  // 3. 已通过验证或无需验证时展示设置内容
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {!authStatus.required && (
        <div
          role="note"
          className="p-3.5 rounded-xl bg-warning-soft border border-warning-border text-xs text-warning flex items-start sm:items-center justify-between gap-3"
        >
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert
              className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0"
              aria-hidden="true"
            />
            <span className="leading-relaxed text-ink-2">
              <strong className="text-ink">公网安全建议</strong>：当前尚未配置{" "}
              <code className="font-mono px-1 py-0.5 rounded bg-brand-soft text-brand-ink">
                ADMIN_PASSWORD
              </code>
              ，公网环境下任何访客均可查看此设置页。建议在云端环境变量中配置密码以开启访问锁。
            </span>
          </div>
        </div>
      )}

      {/* 头部导航与返回 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-line">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/"
            className="min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold text-ink-2 hover:bg-subtle hover:text-ink transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>返回今日晨报</span>
          </Link>

          <div>
            <h1 className="font-serif-title text-2xl font-bold text-ink tracking-tight flex items-center gap-2 flex-wrap">
              <SettingsIcon
                className="w-5 h-5 text-brand"
                aria-hidden="true"
              />
              <span>设置中心</span>
              {authStatus.required && (
                <span className="text-xs font-sans font-medium text-success bg-success-soft border border-success-border px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  <span>管理员已验证</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-ink-muted mt-0.5">
              统一管理 RSS 订阅源、定制频道过滤规则、配置 AI 模型参数与推送渠道。
            </p>
          </div>
        </div>

        {authStatus.required && (
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-ink-muted hover:text-ink hover:bg-subtle text-xs font-medium self-start sm:self-auto transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span>锁定 / 退出</span>
          </button>
        )}
      </div>

      {/* 选项卡切换 Bar（focusgroup tablist + 边框选中指示 + 渐隐边缘滚动提示） */}
      <ScrollFadeContainer
        containerRef={tablistRef}
        itemCount={tabs.length}
        role="tablist"
        aria-label="设置分类"
        {...focusgroupAttrs}
        className="flex items-center gap-1 border-b border-line"
      >
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const startAttr = isActive
            ? ({ focusgroupstart: "" } as Record<string, string>)
            : {};
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              {...startAttr}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={`mwg-tab min-h-[40px] flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? "text-brand" : "text-ink-muted"}`}
                aria-hidden="true"
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </ScrollFadeContainer>

      {/* 选项卡内容区 */}
      <div
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        className="pt-2"
      >
        {activeTab === "feeds" && <FeedsSettingsTab />}
        {activeTab === "channels" && <ChannelsSettingsTab />}
        {activeTab === "ai" && (
          <AiSettingsTab
            ai={ai}
            setAi={setAi}
            onSave={handleSaveSystemConfig}
            saving={saving}
            saveSuccess={saveSuccess}
          />
        )}
        {activeTab === "notifications" && (
          <NotificationsSettingsTab
            notify={notify}
            setNotify={setNotify}
            onSave={handleSaveSystemConfig}
            saving={saving}
            saveSuccess={saveSuccess}
          />
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto my-24 text-center text-xs text-ink-muted flex flex-col items-center gap-3">
          <LoadingSpinner label="正在加载设置中心" size="md" />
          <span>加载设置中心...</span>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
