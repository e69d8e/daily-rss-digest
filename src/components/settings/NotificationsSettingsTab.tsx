"use client";

import { useState } from "react";
import { Mail, Send, Save, CheckCircle2 } from "lucide-react";

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
  const [testStatus, setTestStatus] = useState<{
    [key: string]: { loading?: boolean; msg?: string; error?: boolean };
  }>({});

  const handleTestNotification = async (type: string) => {
    setTestStatus((prev) => ({ ...prev, [type]: { loading: true } }));

    let configPayload: any = {};
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
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [type]: { loading: false, msg: err.message, error: true },
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#eae6df]">
        <div>
          <h3 className="text-base font-bold text-stone-900">
            多端推送与分发渠道
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            启用对应渠道后，每日晨报生成时将自动向飞书、企业微信、Telegram、Discord 或邮箱推送。
          </p>
        </div>

        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors shadow-xs disabled:opacity-50 self-start sm:self-auto"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? "保存中..." : "保存推送配置"}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>推送渠道配置已成功同步持久化！</span>
        </div>
      )}

      {/* 1. 飞书 */}
      <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableFeishu"
              checked={notify.enableFeishu}
              onChange={(e) =>
                setNotify({ ...notify, enableFeishu: e.target.checked })
              }
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <label
              htmlFor="enableFeishu"
              className="text-xs font-bold text-stone-900 flex items-center gap-1.5 cursor-pointer"
            >
              <span>飞书自定义机器人 (Interactive Card)</span>
            </label>
          </div>
          <button
            onClick={() => handleTestNotification("feishu")}
            disabled={testStatus.feishu?.loading || !notify.feishuWebhook}
            className="text-xs text-amber-800 hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.feishu?.loading ? "正在发送测试..." : "发送测试卡片"}
          </button>
        </div>
        <input
          type="url"
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
          value={notify.feishuWebhook}
          onChange={(e) =>
            setNotify({ ...notify, feishuWebhook: e.target.value })
          }
          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-[#faf9f6]"
        />
        {testStatus.feishu?.msg && (
          <div
            className={`text-[11px] ${
              testStatus.feishu.error ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {testStatus.feishu.msg}
          </div>
        )}
      </div>

      {/* 2. 企业微信 */}
      <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableWecom"
              checked={notify.enableWecom}
              onChange={(e) =>
                setNotify({ ...notify, enableWecom: e.target.checked })
              }
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <label
              htmlFor="enableWecom"
              className="text-xs font-bold text-stone-900 flex items-center gap-1.5 cursor-pointer"
            >
              <span>企业微信群机器人 (Markdown)</span>
            </label>
          </div>
          <button
            onClick={() => handleTestNotification("wecom")}
            disabled={testStatus.wecom?.loading || !notify.wecomWebhook}
            className="text-xs text-amber-800 hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.wecom?.loading ? "正在发送测试..." : "发送测试消息"}
          </button>
        </div>
        <input
          type="url"
          placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
          value={notify.wecomWebhook}
          onChange={(e) =>
            setNotify({ ...notify, wecomWebhook: e.target.value })
          }
          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-[#faf9f6]"
        />
        {testStatus.wecom?.msg && (
          <div
            className={`text-[11px] ${
              testStatus.wecom.error ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {testStatus.wecom.msg}
          </div>
        )}
      </div>

      {/* 3. Telegram */}
      <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableTelegram"
              checked={notify.enableTelegram}
              onChange={(e) =>
                setNotify({ ...notify, enableTelegram: e.target.checked })
              }
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <label
              htmlFor="enableTelegram"
              className="text-xs font-bold text-stone-900 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Telegram Bot 推送</span>
            </label>
          </div>
          <button
            onClick={() => handleTestNotification("telegram")}
            disabled={testStatus.telegram?.loading || !notify.telegramBotToken}
            className="text-xs text-amber-800 hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.telegram?.loading ? "正在发送测试..." : "发送测试消息"}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Bot Token (如 123456:ABC-DEF...)"
            value={notify.telegramBotToken}
            onChange={(e) =>
              setNotify({ ...notify, telegramBotToken: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-[#faf9f6]"
          />
          <input
            type="text"
            placeholder="Chat ID (如 -100123456789 或 个人 ID)"
            value={notify.telegramChatId}
            onChange={(e) =>
              setNotify({ ...notify, telegramChatId: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-[#faf9f6]"
          />
        </div>
        {testStatus.telegram?.msg && (
          <div
            className={`text-[11px] ${
              testStatus.telegram.error ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {testStatus.telegram.msg}
          </div>
        )}
      </div>

      {/* 4. Discord */}
      <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableDiscord"
              checked={notify.enableDiscord}
              onChange={(e) =>
                setNotify({ ...notify, enableDiscord: e.target.checked })
              }
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <label
              htmlFor="enableDiscord"
              className="text-xs font-bold text-stone-900 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Discord Webhook (Rich Embed)</span>
            </label>
          </div>
          <button
            onClick={() => handleTestNotification("discord")}
            disabled={testStatus.discord?.loading || !notify.discordWebhook}
            className="text-xs text-amber-800 hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.discord?.loading ? "正在发送测试..." : "发送测试消息"}
          </button>
        </div>
        <input
          type="url"
          placeholder="https://discord.com/api/webhooks/..."
          value={notify.discordWebhook}
          onChange={(e) =>
            setNotify({ ...notify, discordWebhook: e.target.value })
          }
          className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900 bg-[#faf9f6]"
        />
        {testStatus.discord?.msg && (
          <div
            className={`text-[11px] ${
              testStatus.discord.error ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {testStatus.discord.msg}
          </div>
        )}
      </div>

      {/* 5. 邮件 Newsletter (SMTP) */}
      <div className="p-4 rounded-xl border border-stone-200 bg-white shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enableEmail"
              checked={notify.enableEmail}
              onChange={(e) =>
                setNotify({ ...notify, enableEmail: e.target.checked })
              }
              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
            />
            <label
              htmlFor="enableEmail"
              className="text-xs font-bold text-stone-900 flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-stone-700" />
              <span>每日邮件 Newsletter (SMTP 发送)</span>
            </label>
          </div>
          <button
            onClick={() => handleTestNotification("email")}
            disabled={
              testStatus.email?.loading ||
              !notify.smtpHost ||
              !notify.emailRecipients
            }
            className="text-xs text-amber-800 hover:underline disabled:opacity-40 font-medium cursor-pointer"
          >
            {testStatus.email?.loading ? "正在发送测试..." : "发送测试邮件"}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="SMTP 服务器 (如 smtp.qq.com)"
            value={notify.smtpHost}
            onChange={(e) =>
              setNotify({ ...notify, smtpHost: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono bg-[#faf9f6]"
          />
          <input
            type="number"
            placeholder="端口 (465 或 587)"
            value={notify.smtpPort}
            onChange={(e) =>
              setNotify({
                ...notify,
                smtpPort: parseInt(e.target.value) || 465,
              })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono bg-[#faf9f6]"
          />
          <input
            type="text"
            placeholder="发件邮箱账号"
            value={notify.smtpUser}
            onChange={(e) =>
              setNotify({ ...notify, smtpUser: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-[#faf9f6]"
          />
          <input
            type="password"
            placeholder="SMTP 密码 / 授权码"
            value={notify.smtpPass}
            onChange={(e) =>
              setNotify({ ...notify, smtpPass: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-[#faf9f6]"
          />
          <input
            type="text"
            placeholder="发信人名义 (选填)"
            value={notify.smtpFrom}
            onChange={(e) =>
              setNotify({ ...notify, smtpFrom: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-[#faf9f6]"
          />
          <input
            type="text"
            placeholder="收件人邮箱 (逗号分隔)"
            value={notify.emailRecipients}
            onChange={(e) =>
              setNotify({ ...notify, emailRecipients: e.target.value })
            }
            className="px-3 py-1.5 rounded-lg border border-stone-300 text-xs bg-[#faf9f6]"
          />
        </div>
        {testStatus.email?.msg && (
          <div
            className={`text-[11px] ${
              testStatus.email.error ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {testStatus.email.msg}
          </div>
        )}
      </div>
    </div>
  );
}
