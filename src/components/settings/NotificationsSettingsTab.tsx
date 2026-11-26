"use client";

import React, { useId, useState } from "react";
import { Mail, Save, CheckCircle2 } from "lucide-react";

interface NotificationsSettingsTabProps {
  notify: any;
  setNotify: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => Promise<void>;
  saving: boolean;
  saveSuccess: boolean;
}

export default function NotificationsSettingsTab({
  notify,
  setNotify,
  onSave,
  saving,
  saveSuccess,
}: NotificationsSettingsTabProps) {
  const baseId = useId();
  const [testStatus, setTestStatus] = useState<{
    [key: string]: { loading?: boolean; msg?: string; error?: boolean };
  }>({});

  const switchAttr = { switch: "" } as Record<string, string>;

  const handleTestNotification = async (type: string) => {
    setTestStatus((prev) => ({ ...prev, [type]: { loading: true } }));

    let configPayload: Record<string, unknown> = {};
    if (type === "feishu") configPayload = { url: notify.feishuWebhook };
    if (type === "wecom") configPayload = { url: notify.wecomWebhook };
    if (type === "telegram")
      configPayload = {
        token: notify.telegramBotToken,
        chatId: notify.telegramChatId,
      };
    if (type === "discord") configPayload = { url: notify.discordWebhook };
    if (type === "email")
      configPayload = {
        smtpHost: notify.smtpHost,
        smtpPort: notify.smtpPort,
        smtpUser: notify.smtpUser,
        smtpPass: notify.smtpPass,
        smtpFrom: notify.smtpFrom,
        emailRecipients: notify.emailRecipients,
      };

    try {
      const res = await fetch("/api/test-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, config: configPayload }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发送失败");

      setTestStatus((prev) => ({
        ...prev,
        [type]: {
          loading: false,
          msg: data.message || "测试通过！",
          error: false,
        },
      }));
    } catch (err) {
      setTestStatus((prev) => ({
        ...prev,
        [type]: {
          loading: false,
          msg: err instanceof Error ? err.message : "发送失败",
          error: true,
        },
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-base font-bold text-ink">
            多端推送与分发渠道
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            启用对应渠道后，每日晨报生成时将自动向飞书、企业微信、Telegram、Discord 或邮箱推送。
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="min-h-[34px] flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors shadow-xs disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{saving ? "保存中..." : "保存推送配置"}</span>
        </button>
      </div>

      {saveSuccess && (
        <div
          role="status"
          className="p-3 bg-success-soft border border-success-border rounded-xl text-xs font-medium text-success flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>推送渠道配置已成功同步持久化！</span>
        </div>
      )}

      {/* 1. 飞书 */}
      <fieldset className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-3">
        <legend className="visually-hidden">飞书自定义机器人推送配置</legend>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              {...switchAttr}
              id={`${baseId}-enableFeishu`}
              checked={Boolean(notify.enableFeishu)}
              onChange={(e) =>
                setNotify({ ...notify, enableFeishu: e.target.checked })
              }
            />
            <label
              htmlFor={`${baseId}-enableFeishu`}
              className="text-xs font-bold text-ink cursor-pointer"
            >
              飞书自定义机器人 (Interactive Card)
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleTestNotification("feishu")}
            disabled={testStatus.feishu?.loading || !notify.feishuWebhook}
            className="text-xs text-brand hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.feishu?.loading ? "正在发送测试..." : "发送测试卡片"}
          </button>
        </div>
        <div>
          <label
            htmlFor={`${baseId}-feishuWebhook`}
            className="block text-xs text-ink-muted mb-1"
          >
            飞书 Webhook 地址
          </label>
          <input
            id={`${baseId}-feishuWebhook`}
            name="feishuWebhook"
            type="url"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
            value={notify.feishuWebhook}
            onChange={(e) =>
              setNotify({ ...notify, feishuWebhook: e.target.value })
            }
            className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
          />
        </div>
        {testStatus.feishu?.msg && (
          <div
            role={testStatus.feishu.error ? "alert" : "status"}
            className={`text-xs ${
              testStatus.feishu.error ? "text-danger" : "text-success"
            }`}
          >
            {testStatus.feishu.msg}
          </div>
        )}
      </fieldset>

      {/* 2. 企业微信 */}
      <fieldset className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-3">
        <legend className="visually-hidden">企业微信群机器人推送配置</legend>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              {...switchAttr}
              id={`${baseId}-enableWecom`}
              checked={Boolean(notify.enableWecom)}
              onChange={(e) =>
                setNotify({ ...notify, enableWecom: e.target.checked })
              }
            />
            <label
              htmlFor={`${baseId}-enableWecom`}
              className="text-xs font-bold text-ink cursor-pointer"
            >
              企业微信群机器人 (Markdown)
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleTestNotification("wecom")}
            disabled={testStatus.wecom?.loading || !notify.wecomWebhook}
            className="text-xs text-brand hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.wecom?.loading ? "正在发送测试..." : "发送测试消息"}
          </button>
        </div>
        <div>
          <label
            htmlFor={`${baseId}-wecomWebhook`}
            className="block text-xs text-ink-muted mb-1"
          >
            企业微信 Webhook 地址
          </label>
          <input
            id={`${baseId}-wecomWebhook`}
            name="wecomWebhook"
            type="url"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            value={notify.wecomWebhook}
            onChange={(e) =>
              setNotify({ ...notify, wecomWebhook: e.target.value })
            }
            className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
          />
        </div>
        {testStatus.wecom?.msg && (
          <div
            role={testStatus.wecom.error ? "alert" : "status"}
            className={`text-xs ${
              testStatus.wecom.error ? "text-danger" : "text-success"
            }`}
          >
            {testStatus.wecom.msg}
          </div>
        )}
      </fieldset>

      {/* 3. Telegram */}
      <fieldset className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-3">
        <legend className="visually-hidden">Telegram Bot 推送配置</legend>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              {...switchAttr}
              id={`${baseId}-enableTelegram`}
              checked={Boolean(notify.enableTelegram)}
              onChange={(e) =>
                setNotify({ ...notify, enableTelegram: e.target.checked })
              }
            />
            <label
              htmlFor={`${baseId}-enableTelegram`}
              className="text-xs font-bold text-ink cursor-pointer"
            >
              Telegram Bot 推送
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleTestNotification("telegram")}
            disabled={testStatus.telegram?.loading || !notify.telegramBotToken}
            className="text-xs text-brand hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.telegram?.loading ? "正在发送测试..." : "发送测试消息"}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${baseId}-telegramBotToken`}
              className="block text-xs text-ink-muted mb-1"
            >
              Telegram Bot Token
            </label>
            <input
              id={`${baseId}-telegramBotToken`}
              name="telegramBotToken"
              type="text"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="如 123456:ABC-DEF..."
              value={notify.telegramBotToken}
              onChange={(e) =>
                setNotify({ ...notify, telegramBotToken: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
            />
          </div>
          <div>
            <label
              htmlFor={`${baseId}-telegramChatId`}
              className="block text-xs text-ink-muted mb-1"
            >
              Chat ID
            </label>
            <input
              id={`${baseId}-telegramChatId`}
              name="telegramChatId"
              type="text"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="如 -100123456789 或 个人 ID"
              value={notify.telegramChatId}
              onChange={(e) =>
                setNotify({ ...notify, telegramChatId: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
            />
          </div>
        </div>
        {testStatus.telegram?.msg && (
          <div
            role={testStatus.telegram.error ? "alert" : "status"}
            className={`text-xs ${
              testStatus.telegram.error ? "text-danger" : "text-success"
            }`}
          >
            {testStatus.telegram.msg}
          </div>
        )}
      </fieldset>

      {/* 4. Discord */}
      <fieldset className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-3">
        <legend className="visually-hidden">Discord Webhook 推送配置</legend>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              {...switchAttr}
              id={`${baseId}-enableDiscord`}
              checked={Boolean(notify.enableDiscord)}
              onChange={(e) =>
                setNotify({ ...notify, enableDiscord: e.target.checked })
              }
            />
            <label
              htmlFor={`${baseId}-enableDiscord`}
              className="text-xs font-bold text-ink cursor-pointer"
            >
              Discord Webhook (Rich Embed)
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleTestNotification("discord")}
            disabled={testStatus.discord?.loading || !notify.discordWebhook}
            className="text-xs text-brand hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.discord?.loading ? "正在发送测试..." : "发送测试消息"}
          </button>
        </div>
        <div>
          <label
            htmlFor={`${baseId}-discordWebhook`}
            className="block text-xs text-ink-muted mb-1"
          >
            Discord Webhook 地址
          </label>
          <input
            id={`${baseId}-discordWebhook`}
            name="discordWebhook"
            type="url"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="https://discord.com/api/webhooks/..."
            value={notify.discordWebhook}
            onChange={(e) =>
              setNotify({ ...notify, discordWebhook: e.target.value })
            }
            className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
          />
        </div>
        {testStatus.discord?.msg && (
          <div
            role={testStatus.discord.error ? "alert" : "status"}
            className={`text-xs ${
              testStatus.discord.error ? "text-danger" : "text-success"
            }`}
          >
            {testStatus.discord.msg}
          </div>
        )}
      </fieldset>

      {/* 5. 邮件 Newsletter (SMTP) */}
      <fieldset className="p-4 rounded-xl border border-line bg-card shadow-2xs space-y-3">
        <legend className="visually-hidden">每日邮件 Newsletter SMTP 配置</legend>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              {...switchAttr}
              id={`${baseId}-enableEmail`}
              checked={Boolean(notify.enableEmail)}
              onChange={(e) =>
                setNotify({ ...notify, enableEmail: e.target.checked })
              }
            />
            <label
              htmlFor={`${baseId}-enableEmail`}
              className="text-xs font-bold text-ink inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-ink-2" aria-hidden="true" />
              <span>每日邮件 Newsletter (SMTP 发送)</span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleTestNotification("email")}
            disabled={
              testStatus.email?.loading ||
              !notify.smtpHost ||
              !notify.emailRecipients
            }
            className="text-xs text-brand hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.email?.loading ? "正在发送测试..." : "发送测试邮件"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              htmlFor={`${baseId}-smtpHost`}
              className="block text-xs text-ink-muted mb-1"
            >
              SMTP 服务器
            </label>
            <input
              id={`${baseId}-smtpHost`}
              name="smtpHost"
              type="text"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="如 smtp.qq.com"
              value={notify.smtpHost}
              onChange={(e) =>
                setNotify({ ...notify, smtpHost: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={`${baseId}-smtpPort`}
              className="block text-xs text-ink-muted mb-1"
            >
              SMTP 端口
            </label>
            <input
              id={`${baseId}-smtpPort`}
              name="smtpPort"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="465 或 587"
              value={String(notify.smtpPort ?? "")}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setNotify({
                  ...notify,
                  smtpPort: digits ? parseInt(digits, 10) : 465,
                });
              }}
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-subtle text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={`${baseId}-smtpUser`}
              className="block text-xs text-ink-muted mb-1"
            >
              发件邮箱账号
            </label>
            <input
              id={`${baseId}-smtpUser`}
              name="smtpUser"
              type="email"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="sender@example.com"
              value={notify.smtpUser}
              onChange={(e) =>
                setNotify({ ...notify, smtpUser: e.target.value })
              }
              className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-subtle text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={`${baseId}-smtpPass`}
              className="block text-xs text-ink-muted mb-1"
            >
              SMTP 密码 / 授权码
            </label>
            <input
              id={`${baseId}-smtpPass`}
              name="smtpPass"
              type="password"
              placeholder="SMTP 密码或应用授权码"
              value={notify.smtpPass}
              onChange={(e) =>
                setNotify({ ...notify, smtpPass: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-subtle text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={`${baseId}-smtpFrom`}
              className="block text-xs text-ink-muted mb-1"
            >
              发信人名义 (选填)
            </label>
            <input
              id={`${baseId}-smtpFrom`}
              name="smtpFrom"
              type="text"
              placeholder="Daily Briefing <sender@example.com>"
              value={notify.smtpFrom}
              onChange={(e) =>
                setNotify({ ...notify, smtpFrom: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-subtle text-ink"
            />
          </div>

          <div>
            <label
              htmlFor={`${baseId}-emailRecipients`}
              className="block text-xs text-ink-muted mb-1"
            >
              收件人邮箱 (逗号分隔)
            </label>
            <input
              id={`${baseId}-emailRecipients`}
              name="emailRecipients"
              type="text"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="a@example.com, b@example.com"
              value={notify.emailRecipients}
              onChange={(e) =>
                setNotify({ ...notify, emailRecipients: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-subtle text-ink"
            />
          </div>
        </div>
        {testStatus.email?.msg && (
          <div
            role={testStatus.email.error ? "alert" : "status"}
            className={`text-xs ${
              testStatus.email.error ? "text-danger" : "text-success"
            }`}
          >
            {testStatus.email.msg}
          </div>
        )}
      </fieldset>
    </form>
  );
}
