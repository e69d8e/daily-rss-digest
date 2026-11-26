"use client";

import React, { useId, useState } from "react";
import {
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

interface AiConfigState {
  provider: string;
  apiFormat?: string;
  apiKey: string;
  hasApiKey?: boolean;
  isEnvKey?: boolean;
  baseURL: string;
  model: string;
  temperature: number;
}

interface AiSettingsTabProps {
  ai: AiConfigState;
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
  const baseUrlId = useId();
  const modelId = useId();
  const apiKeyId = useId();
  const apiKeyHintId = useId();
  const tempId = useId();
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
      setAi((prev: AiConfigState) => ({
        ...prev,
        provider: "deepseek",
        apiFormat: "chat_completions",
        baseURL: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
      }));
    } else if (provider === "openai") {
      setAi((prev: AiConfigState) => ({
        ...prev,
        provider: "openai",
        apiFormat: "chat_completions",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      }));
    } else if (provider === "claude") {
      setAi((prev: AiConfigState) => ({
        ...prev,
        provider: "claude",
        apiFormat: "messages",
        baseURL: "https://api.anthropic.com/v1",
        model: "claude-3-5-sonnet-20241022",
      }));
    } else if (provider === "ollama") {
      setAi((prev: AiConfigState) => ({
        ...prev,
        provider: "ollama",
        apiFormat: "chat_completions",
        baseURL: "http://localhost:11434/v1",
        model: "qwen2.5:7b",
        apiKey: "ollama",
      }));
    } else {
      setAi((prev: AiConfigState) => ({ ...prev, provider: "custom" }));
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
    } catch (err) {
      setTestResult({
        success: false,
        error: err instanceof Error ? err.message : "网络请求异常",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave();
  };

  const tempDescriptor =
    ai.temperature <= 0.3
      ? "严谨稳定"
      : ai.temperature >= 0.7
      ? "创意发散"
      : "均衡推荐";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-base font-bold text-ink">
            AI 聚类提炼引擎配置
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            默认未配置 API Key 时系统会自动启用本地智能提炼引擎，填写后将享受完整 LLM 聚类、打分与洞察。
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing || saving}
            className="min-h-[34px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-line-strong/70 bg-card text-ink-2 hover:text-ink text-xs font-semibold hover:bg-subtle transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {testing ? (
              <RefreshCw
                className="w-3.5 h-3.5 motion-safe:animate-spin text-brand"
                aria-hidden="true"
              />
            ) : (
              <Zap className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
            )}
            <span>{testing ? "测试中..." : "测试连通性"}</span>
          </button>

          <button
            type="submit"
            disabled={saving || testing}
            className="min-h-[34px] flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{saving ? "保存中..." : "保存 AI 配置"}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div
          role="status"
          className="p-3 bg-success-soft border border-success-border rounded-xl text-xs font-medium text-success flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>AI 引擎配置已成功同步持久化！</span>
        </div>
      )}

      {testResult && (
        <div
          role={testResult.success ? "status" : "alert"}
          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
            testResult.success
              ? "bg-success-soft border-success-border text-success"
              : "bg-danger-soft border-danger-border text-danger"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2
              className="w-4 h-4 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="w-4 h-4 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <div className="flex-1">
            <div className="font-semibold flex items-center gap-2 flex-wrap">
              <span>
                {testResult.success ? "连通测试成功！" : "连通测试失败"}
              </span>
              {testResult.latencyMs !== undefined && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-card/70 border border-success-border">
                  耗时 {testResult.latencyMs}ms
                </span>
              )}
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {testResult.success ? testResult.message : testResult.error}
            </p>
          </div>
        </div>
      )}

      {/* 预设提供商快速切换 */}
      <fieldset className="border-0 p-0 m-0 space-y-2">
        <legend className="block text-xs font-semibold text-ink-2 mb-2">
          推荐模型提供商快捷预设
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            { id: "deepseek", name: "DeepSeek", desc: "高性价比首选" },
            { id: "openai", name: "OpenAI", desc: "GPT-4o mini" },
            { id: "claude", name: "Claude", desc: "Anthropic Messages" },
            { id: "ollama", name: "Ollama 本地", desc: "私有化零成本" },
            { id: "custom", name: "自定义 / 其他", desc: "兼容协议" },
          ].map((p) => {
            const isSelected = ai.provider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => handleProviderPreset(p.id)}
                className={`p-3 rounded-xl border text-start transition-colors cursor-pointer ${
                  isSelected
                    ? "border-brand-border bg-brand-soft/60 text-ink shadow-2xs font-semibold ring-1 ring-brand-border"
                    : "border-line hover:border-line-strong text-ink-2 bg-card hover:bg-subtle"
                }`}
              >
                <div className="text-xs">{p.name}</div>
                <div className="text-[11px] text-ink-muted font-normal mt-0.5">
                  {p.desc}
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* API 协议规范格式选择：使用原生 radio + :has(:checked) 替代可点击 <div> */}
      <fieldset className="bg-card p-5 rounded-xl border border-line space-y-3">
        <legend className="text-xs font-semibold text-ink px-1">
          API 请求协议格式 (API Format)
        </legend>
        <p className="text-xs text-ink-muted">
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
              <label
                key={fmt.id}
                className="cursor-pointer p-3.5 rounded-xl border border-line bg-subtle/60 hover:border-line-strong has-[:checked]:border-brand-border has-[:checked]:bg-brand-soft/45 has-[:checked]:ring-1 has-[:checked]:ring-brand-border has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand transition-colors block"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-ink flex items-center gap-2">
                    <input
                      type="radio"
                      name="apiFormat"
                      value={fmt.id}
                      checked={isSelected}
                      onChange={() =>
                        setAi((prev: AiConfigState) => ({
                          ...prev,
                          apiFormat: fmt.id,
                        }))
                      }
                      className="cursor-pointer"
                    />
                    <span>{fmt.name}</span>
                  </span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                      isSelected
                        ? "bg-brand text-white"
                        : "bg-muted-surface text-ink-2"
                    }`}
                  >
                    {fmt.badge}
                  </span>
                </div>
                <p className="text-xs text-ink-2 leading-snug mt-1">
                  {fmt.desc}
                </p>
                <div className="mt-2 text-[11px] font-mono text-ink-muted bg-card px-2 py-1 rounded border border-line">
                  {fmt.pathHint}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card p-5 rounded-xl border border-line">
        <div>
          <label
            htmlFor={baseUrlId}
            className="block text-xs font-semibold text-ink-2 mb-1.5"
          >
            API Base URL (端点根地址)
          </label>
          <input
            id={baseUrlId}
            name="baseURL"
            type="url"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            value={ai.baseURL}
            onChange={(e) => setAi({ ...ai, baseURL: e.target.value })}
            placeholder="https://api.deepseek.com/v1"
            className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink"
          />
        </div>

        <div>
          <label
            htmlFor={modelId}
            className="block text-xs font-semibold text-ink-2 mb-1.5"
          >
            模型名称 (Model Name)
          </label>
          <input
            id={modelId}
            name="model"
            type="text"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            value={ai.model}
            onChange={(e) => setAi({ ...ai, model: e.target.value })}
            placeholder="deepseek-chat / gpt-4o-mini / claude-3-5-sonnet-20241022"
            className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink"
          />
        </div>

        {/* API Key 关键安全脱敏区域 */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <label
              htmlFor={apiKeyId}
              className="block text-xs font-semibold text-ink-2"
            >
              API Key (密钥安全脱敏保护)
            </label>
            <div className="flex items-center gap-1.5">
              {ai.isEnvKey && (
                <span className="text-xs font-medium text-success bg-success-soft border border-success-border px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  <span>云端环境变量已注入 (安全防泄露)</span>
                </span>
              )}
              {!ai.isEnvKey && ai.hasApiKey && (
                <span className="text-xs font-medium text-ink-2 bg-subtle border border-line px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Lock className="w-3 h-3 text-ink-muted" aria-hidden="true" />
                  <span>已保存并脱敏保护</span>
                </span>
              )}
            </div>
          </div>

          <p
            id={apiKeyHintId}
            className="text-xs text-ink-muted mb-2 leading-relaxed"
          >
            接口绝不向浏览器明文输出原始密钥；云端部署时建议直接在环境变量中配置{" "}
            <code className="text-ink-2 font-mono">AI_API_KEY</code>。
          </p>

          <div className="relative">
            <input
              id={apiKeyId}
              name="apiKey"
              type={showApiKey ? "text" : "password"}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              aria-describedby={apiKeyHintId}
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
              className="w-full ps-3 pe-24 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink disabled:bg-subtle disabled:text-ink-muted"
            />
            <div className="absolute end-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {ai.hasApiKey && !ai.isEnvKey && (
                <button
                  type="button"
                  onClick={() =>
                    setAi({ ...ai, apiKey: "__CLEAR__", hasApiKey: false })
                  }
                  className="text-xs text-ink-muted hover:text-danger px-2 py-1 rounded hover:bg-subtle transition-colors cursor-pointer"
                >
                  清除
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                aria-pressed={showApiKey}
                aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                className="min-h-[28px] min-w-[28px] text-ink-muted hover:text-ink p-1 rounded hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 采样温度滑块：遵循 slider 指南，跨浏览器分离轨道/滑块伪元素并同步进度变量 */}
        <div className="sm:col-span-2 max-w-md">
          <div className="flex items-center justify-between gap-2 mb-1">
            <label
              htmlFor={tempId}
              className="text-xs font-semibold text-ink-2"
            >
              采样温度 (Temperature)
            </label>
            <output
              htmlFor={tempId}
              className="text-xs font-mono text-brand-ink bg-brand-soft border border-brand-border/60 px-2 py-0.5 rounded-md"
            >
              {ai.temperature.toFixed(1)} · {tempDescriptor}
            </output>
          </div>
          <input
            id={tempId}
            name="temperature"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={ai.temperature}
            aria-valuetext={`${ai.temperature.toFixed(1)}，${tempDescriptor}`}
            onChange={(e) =>
              setAi({ ...ai, temperature: parseFloat(e.target.value) })
            }
            style={
              {
                "--attr-min": 0,
                "--attr-max": 1,
                "--control-value": ai.temperature,
              } as React.CSSProperties
            }
            className="mwg-slider"
          />
          <div className="flex justify-between text-[11px] text-ink-muted font-mono -mt-1">
            <span>0.0 严谨</span>
            <span>0.5 均衡</span>
            <span>1.0 发散</span>
          </div>
        </div>
      </div>
    </form>
  );
}
