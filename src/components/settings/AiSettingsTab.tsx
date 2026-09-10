"use client";

import { useState } from "react";
import {
  Sparkles,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Zap,
  AlertCircle,
  RefreshCw,
  Lock,
  ShieldCheck,
} from "lucide-react";

interface AiSettingsTabProps {
  ai: {
    provider: string;
    apiFormat?: string;
    apiKey: string;
    hasApiKey?: boolean;
    isEnvKey?: boolean;
    baseURL: string;
    model: string;
    temperature: number;
  };
  setAi: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => Promise<void>;
  saving: boolean;
  saveSuccess: boolean;
}

export default function AiSettingsTab({
  ai,
  setAi,
  onSave,
  saving,
  saveSuccess,
}: AiSettingsTabProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
  } | null>(null);

  const currentApiFormat = ai.apiFormat || "chat_completions";

  const handleProviderPreset = (provider: string) => {
    if (provider === "deepseek") {
      setAi((prev: any) => ({
        ...prev,
        provider: "deepseek",
        apiFormat: "chat_completions",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      }));
    } else if (provider === "openai") {
      setAi((prev: any) => ({
        ...prev,
        provider: "openai",
        apiFormat: "chat_completions",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      }));
    } else if (provider === "claude") {
      setAi((prev: any) => ({
        ...prev,
        provider: "claude",
        apiFormat: "messages",
        baseURL: "https://api.anthropic.com/v1",
        model: "claude-3-5-sonnet-20241022",
      }));
    } else if (provider === "ollama") {
      setAi((prev: any) => ({
        ...prev,
        provider: "ollama",
        apiFormat: "chat_completions",
        baseURL: "http://localhost:11434/v1",
        model: "qwen2.5:7b",
        apiKey: "ollama",
      }));
    } else {
      setAi((prev: any) => ({ ...prev, provider: "custom" }));
    }
  };

  const handleTestConnection = async () => {
    if (!ai.hasApiKey && (!ai.apiKey || !ai.apiKey.trim())) {
      setTestResult({
        success: false,
        error: "请先填写 API Key (密钥) 再进行连通性测试",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiFormat: currentApiFormat,
          apiKey: ai.apiKey,
          baseURL: ai.baseURL,
          model: ai.model,
          temperature: ai.temperature,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "连接测试失败");
      }

      setTestResult({
        success: true,
        latencyMs: data.latencyMs,
        message: data.message || "连通成功！模型响应正常",
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || "网络请求异常",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#eae6df]">
        <div>
          <h3 className="text-base font-bold text-stone-900">
            AI 聚类提炼引擎配置
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            默认未配置 API Key 时系统会自动启用本地智能提炼引擎，填写后将享受完整 LLM 聚类、打分与洞察。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleTestConnection}
            disabled={testing || saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors shadow-2xs disabled:opacity-50"
            title="测试当前 API 设置是否可用"
          >
            {testing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{testing ? "测试中..." : "测试连通性"}</span>
          </button>

          <button
            onClick={onSave}
            disabled={saving || testing}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "保存中..." : "保存 AI 配置"}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>AI 引擎配置已成功同步持久化！</span>
        </div>
      )}

      {testResult && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
            testResult.success
              ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
              : "bg-rose-50/80 border-rose-200 text-rose-900"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2">
              <span>{testResult.success ? "连通测试成功！" : "连通测试失败"}</span>
              {testResult.latencyMs !== undefined && (
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                  耗时 {testResult.latencyMs}ms
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-90 mt-0.5">
              {testResult.success ? testResult.message : testResult.error}
            </p>
          </div>
        </div>
      )}

      {/* 预设提供商快速切换 */}
      <div>
        <label className="block text-xs font-semibold text-stone-700 mb-2">
          推荐模型提供商快捷预设
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { id: "deepseek", name: "DeepSeek", desc: "高性价比首选" },
            { id: "openai", name: "OpenAI", desc: "GPT-4o mini" },
            { id: "claude", name: "Claude", desc: "Anthropic Messages" },
            { id: "ollama", name: "Ollama 本地", desc: "私有化零成本" },
            { id: "custom", name: "自定义 / 其他", desc: "兼容协议" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProviderPreset(p.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                ai.provider === p.id
                  ? "border-stone-900 bg-stone-50 text-stone-900 shadow-2xs font-semibold ring-1 ring-stone-900"
                  : "border-stone-200 hover:border-stone-400 text-stone-600 bg-white"
              }`}
            >
              <div className="text-xs">{p.name}</div>
              <div className="text-[10px] text-stone-400 font-normal">{p.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* API 协议规范格式选择 */}
      <div className="bg-white p-5 rounded-xl border border-[#eae6df] space-y-3">
        <label className="block text-xs font-semibold text-stone-900">
          API 请求协议格式 (API Format)
        </label>
        <p className="text-[11px] text-stone-500">
          根据所选的大模型服务商或代理中转接口，选择对应的通信协议结构：
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {[
            {
              id: "chat_completions",
              name: "Chat Completions",
              badge: "主流标准",
              desc: "OpenAI / DeepSeek / Ollama / 智谱 / 通用中转",
              pathHint: "POST /v1/chat/completions",
            },
            {
              id: "response",
              name: "Response",
              badge: "OpenAI 最新",
              desc: "OpenAI 现代化 Responses API 规范",
              pathHint: "POST /v1/responses",
            },
            {
              id: "messages",
              name: "Messages",
              badge: "Claude 原生",
              desc: "Anthropic Claude 原生 Messages API 规范",
              pathHint: "POST /v1/messages",
            },
          ].map((fmt) => {
            const isSelected = currentApiFormat === fmt.id;
            return (
              <div
                key={fmt.id}
                onClick={() => setAi((prev: any) => ({ ...prev, apiFormat: fmt.id }))}
                className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? "border-amber-700 bg-amber-50/40 shadow-xs ring-1 ring-amber-700"
                    : "border-stone-200 hover:border-stone-300 bg-stone-50/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <span>{fmt.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      isSelected
                        ? "bg-amber-800 text-white"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {fmt.badge}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 leading-snug mt-1">
                  {fmt.desc}
                </p>
                <div className="mt-2 text-[10px] font-mono text-stone-400 bg-white/80 px-2 py-1 rounded border border-stone-200/80">
                  {fmt.pathHint}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-xl border border-[#eae6df]">
        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            API Base URL (端点根地址)
          </label>
          <input
            type="text"
            value={ai.baseURL}
            onChange={(e) => setAi({ ...ai, baseURL: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            模型名称 (Model Name)
          </label>
          <input
            type="text"
            value={ai.model}
            onChange={(e) => setAi({ ...ai, model: e.target.value })}
            placeholder="deepseek-chat / gpt-4o-mini / claude-3-5-sonnet-20241022"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-white"
          />
        </div>

        {/* API Key 关键安全脱敏区域 */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-stone-700">
              API Key (密钥安全脱敏保护)
            </label>
            <div className="flex items-center gap-1.5">
              {ai.isEnvKey && (
                <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>云端环境变量已注入 (安全防泄露)</span>
                </span>
              )}
              {!ai.isEnvKey && ai.hasApiKey && (
                <span className="text-[11px] font-medium text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3 text-stone-500" />
                  <span>已保存并脱敏保护</span>
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <input
              type={showApiKey ? "text" : "password"}
              value={ai.apiKey}
              onChange={(e) =>
                setAi({
                  ...ai,
                  apiKey: e.target.value,
                  hasApiKey: Boolean(e.target.value),
                })
              }
              placeholder={
                ai.hasApiKey
                  ? "密钥已安全就绪（如需更换，请直接输入新 Key）"
                  : "sk-..."
              }
              disabled={ai.isEnvKey}
              className="w-full pl-3 pr-24 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-white disabled:bg-stone-50 disabled:text-stone-500"
            />
            <div className="absolute right-2 top-2 flex items-center gap-1">
              {ai.hasApiKey && !ai.isEnvKey && (
                <button
                  type="button"
                  onClick={() =>
                    setAi({ ...ai, apiKey: "__CLEAR__", hasApiKey: false })
                  }
                  className="text-[11px] text-stone-400 hover:text-rose-600 px-1.5 py-0.5 rounded hover:bg-stone-100 transition-colors"
                  title="清空当前保存的密钥"
                >
                  清除
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
                title={showApiKey ? "隐藏内容" : "显示内容"}
              >
                {showApiKey ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
            🛡️ <strong>云端安全防泄露机制</strong>：接口绝不向浏览器明文输出原始密钥。在 Netlify 云端部署时，强烈建议直接在平台的 <strong>Environment Variables</strong> 中配置 <code className="text-stone-600 font-mono">AI_API_KEY</code>，密钥将全生命周期留存在服务端，公网绝不暴露。
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-700 mb-1">
            采样温度 (Temperature: {ai.temperature})
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={ai.temperature}
            onChange={(e) =>
              setAi({ ...ai, temperature: parseFloat(e.target.value) })
            }
            className="w-full accent-stone-900"
          />
        </div>
      </div>
    </div>
  );
}
