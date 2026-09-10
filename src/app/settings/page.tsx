"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Rss,
  Layers,
  Sparkles,
  Send,
  ArrowLeft,
  Settings as SettingsIcon,
  RefreshCw,
  Lock,
  KeyRound,
  ShieldAlert,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import FeedsSettingsTab from "@/components/settings/FeedsSettingsTab";
import ChannelsSettingsTab from "@/components/settings/ChannelsSettingsTab";
import AiSettingsTab from "@/components/settings/AiSettingsTab";
import NotificationsSettingsTab from "@/components/settings/NotificationsSettingsTab";

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = searchParams.get("tab") || "feeds";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
      })
      .catch((e) => {
        console.warn(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    // 检查是否开启 ADMIN_PASSWORD 鉴权
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
        } else {
          setLoading(false);
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
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/settings?tab=${tabId}`);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!passwordInput.trim()) return;

    setAuthSubmitting(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "密码错误，请重新输入");

      setAuthStatus((prev) => ({ ...prev, authenticated: true }));
      setPasswordInput("");
      setLoading(true);
      loadSettings();
    } catch (err: any) {
      setAuthError(err.message || "密码错误");
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setAuthStatus((prev) => ({ ...prev, authenticated: false }));
  };

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
      setTimeout(() => setSaveSuccess(false), 3000);
      loadSettings();
    } catch (e: any) {
      alert(`保存失败: ${e.message}`);
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

  // 1. 如果正在校验权限中
  if (authStatus.loading) {
    return (
      <div className="max-w-md mx-auto my-24 p-8 text-center text-stone-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-700" />
        <div className="text-xs">加载安全策略中...</div>
      </div>
    );
  }

  // 2. 如果开启了 ADMIN_PASSWORD 且当前未通过验证：展示优雅的安全访问密码锁
  if (authStatus.required && !authStatus.authenticated) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white rounded-2xl border border-[#eae6df] p-6 sm:p-8 shadow-md space-y-5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-stone-900">
              设置中心 · 管理访问验证
            </h2>
            <p className="text-xs text-stone-500 leading-relaxed">
              当前站点已在云端启用了管理保护。请输入管理员访问密码以解锁配置面板。
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="password"
                  placeholder="请输入 ADMIN_PASSWORD"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-white"
                />
                <KeyRound className="w-4 h-4 text-stone-400 absolute right-3 top-3" />
              </div>
              {authError && (
                <p className="text-[11px] text-rose-600 mt-1.5">{authError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={authSubmitting || !passwordInput.trim()}
              className="w-full py-2.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {authSubmitting ? "校验中..." : "解锁进入设置中心"}
            </button>
          </form>

          <div className="pt-2 border-t border-stone-100 text-center">
            <Link
              href="/"
              className="text-xs text-stone-500 hover:text-stone-900 transition-colors inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>返回今日晨报主页</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. 已通过验证或无需验证时展示设置内容
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 未开启管理密码时的公网防泄露安全提醒条 */}
      {!authStatus.required && (
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <span className="leading-relaxed">
              <strong>公网安全建议</strong>：当前尚未配置 <code className="font-mono px-1 py-0.5 rounded bg-amber-100/80 text-amber-950">ADMIN_PASSWORD</code>，公网环境下任何访客均可查看此设置页。建议在云端环境变量中配置密码以开启访问锁。
            </span>
          </div>
        </div>
      )}

      {/* 头部导航与返回 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#eae6df]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eae6df] bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 hover:text-stone-950 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回今日晨报</span>
          </Link>

          <div>
            <h1 className="font-serif-title text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-amber-800" />
              <span>设置中心</span>
              {authStatus.required && (
                <span className="text-[11px] font-sans font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>管理员已验证</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              统一管理 RSS 订阅源、定制频道过滤规则、配置 AI 模型参数与推送渠道。
            </p>
          </div>
        </div>

        {authStatus.required && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-stone-500 hover:text-stone-900 hover:bg-stone-50 text-xs font-medium self-start sm:self-auto transition-colors cursor-pointer"
            title="退出管理员身份"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>锁定 / 退出</span>
          </button>
        )}
      </div>

      {/* 选项卡切换 Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-[#eae6df] pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 font-medium text-xs transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-stone-900 text-stone-900 font-semibold"
                  : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? "text-stone-900" : "text-stone-400"
                }`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 选项卡内容区 */}
      <div className="pt-2">
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
        <div className="max-w-md mx-auto my-24 text-center text-xs text-stone-400">
          加载设置中心...
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
