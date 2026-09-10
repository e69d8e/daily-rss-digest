import nodemailer from "nodemailer";
import { prisma } from "../db";
import { NotificationSettingsConfig } from "@/types";

export interface DigestNotificationPayload {
  channelName: string;
  date: string;
  title: string;
  overview: string;
  topics: {
    title: string;
    summary: string;
    url?: string;
  }[];
  webUrl: string;
}

export async function getNotificationConfig(): Promise<NotificationSettingsConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        startsWith: "notify_",
      },
    },
  });

  const map = new Map(settings.map((s) => [s.key, s.value]));

  return {
    feishuWebhook: map.get("notify_feishu_webhook") || "",
    wecomWebhook: map.get("notify_wecom_webhook") || "",
    telegramBotToken: map.get("notify_telegram_bot_token") || "",
    telegramChatId: map.get("notify_telegram_chat_id") || "",
    discordWebhook: map.get("notify_discord_webhook") || "",
    smtpHost: map.get("notify_smtp_host") || "",
    smtpPort: parseInt(map.get("notify_smtp_port") || "465", 10),
    smtpUser: map.get("notify_smtp_user") || "",
    smtpPass: map.get("notify_smtp_pass") || "",
    smtpFrom: map.get("notify_smtp_from") || "",
    emailRecipients: map.get("notify_email_recipients") || "",
    enableFeishu: map.get("notify_enable_feishu") === "true",
    enableWecom: map.get("notify_enable_wecom") === "true",
    enableTelegram: map.get("notify_enable_telegram") === "true",
    enableDiscord: map.get("notify_enable_discord") === "true",
    enableEmail: map.get("notify_enable_email") === "true",
  };
}

export async function dispatchDigestNotifications(
  payload: DigestNotificationPayload,
  digestId?: string
) {
  const config = await getNotificationConfig();
  const results: { channel: string; success: boolean; error?: string }[] = [];

  // 1. 飞书 (Feishu)
  if (config.enableFeishu && config.feishuWebhook) {
    try {
      await sendFeishuNotification(config.feishuWebhook, payload);
      results.push({ channel: "FEISHU", success: true });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_FEISHU", config.feishuWebhook, "SUCCESS");
      }
    } catch (err: any) {
      results.push({ channel: "FEISHU", success: false, error: err.message });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_FEISHU", config.feishuWebhook, "FAILED", err.message);
      }
    }
  }

  // 2. 企业微信 (WeCom)
  if (config.enableWecom && config.wecomWebhook) {
    try {
      await sendWecomNotification(config.wecomWebhook, payload);
      results.push({ channel: "WECOM", success: true });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_WECOM", config.wecomWebhook, "SUCCESS");
      }
    } catch (err: any) {
      results.push({ channel: "WECOM", success: false, error: err.message });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_WECOM", config.wecomWebhook, "FAILED", err.message);
      }
    }
  }

  // 3. Telegram
  if (
    config.enableTelegram &&
    config.telegramBotToken &&
    config.telegramChatId
  ) {
    try {
      await sendTelegramNotification(
        config.telegramBotToken,
        config.telegramChatId,
        payload
      );
      results.push({ channel: "TELEGRAM", success: true });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_TELEGRAM", config.telegramChatId, "SUCCESS");
      }
    } catch (err: any) {
      results.push({ channel: "TELEGRAM", success: false, error: err.message });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_TELEGRAM", config.telegramChatId, "FAILED", err.message);
      }
    }
  }

  // 4. Discord
  if (config.enableDiscord && config.discordWebhook) {
    try {
      await sendDiscordNotification(config.discordWebhook, payload);
      results.push({ channel: "DISCORD", success: true });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_DISCORD", config.discordWebhook, "SUCCESS");
      }
    } catch (err: any) {
      results.push({ channel: "DISCORD", success: false, error: err.message });
      if (digestId) {
        await logDelivery(digestId, "WEBHOOK_DISCORD", config.discordWebhook, "FAILED", err.message);
      }
    }
  }

  // 5. 邮件 Newsletter (SMTP)
  if (
    config.enableEmail &&
    config.smtpHost &&
    config.smtpUser &&
    config.smtpPass &&
    config.emailRecipients
  ) {
    try {
      await sendEmailNewsletter(config, payload);
      results.push({ channel: "EMAIL", success: true });
      if (digestId) {
        await logDelivery(digestId, "EMAIL", config.emailRecipients, "SUCCESS");
      }
    } catch (err: any) {
      results.push({ channel: "EMAIL", success: false, error: err.message });
      if (digestId) {
        await logDelivery(digestId, "EMAIL", config.emailRecipients, "FAILED", err.message);
      }
    }
  }

  return results;
}

async function logDelivery(
  digestId: string,
  targetType: string,
  targetDestination: string,
  status: string,
  message?: string
) {
  try {
    await prisma.deliveryLog.create({
      data: {
        digestId,
        targetType,
        targetDestination: targetDestination.slice(0, 150),
        status,
        message: message || null,
      },
    });
  } catch (e) {
    console.error("记录推送日志失败:", e);
  }
}

/* ================= 具体渠道实现 ================= */

export async function sendFeishuNotification(
  webhookUrl: string,
  payload: DigestNotificationPayload
) {
  const elements: any[] = [
    {
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**📅 日期**：${payload.date}\n**📌 今日导读**：\n${payload.overview.slice(0, 300)}...`,
      },
    },
    { tag: "hr" },
  ];

  payload.topics.slice(0, 4).forEach((t, i) => {
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `**${i + 1}. ${t.title}**\n${t.summary.slice(0, 150)}...`,
      },
    });
  });

  elements.push({
    tag: "action",
    actions: [
      {
        tag: "button",
        text: { tag: "plain_text", content: "📖 查看今日完整晨报" },
        type: "primary",
        url: payload.webUrl,
      },
    ],
  });

  const body = {
    msg_type: "interactive",
    card: {
      header: {
        template: "blue",
        title: {
          tag: "plain_text",
          content: `📰 ${payload.channelName} · 每日智汇晨报`,
        },
      },
      elements,
    },
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`飞书 Webhook 响应错误: ${res.status} ${await res.text()}`);
  }
}

export async function sendWecomNotification(
  webhookUrl: string,
  payload: DigestNotificationPayload
) {
  const topicList = payload.topics
    .slice(0, 4)
    .map((t, i) => `> **${i + 1}. ${t.title}**\n${t.summary.slice(0, 120)}...`)
    .join("\n\n");

  const markdownContent = `### 📰 ${payload.channelName} · 每日智汇晨报
**日期**：${payload.date}

${payload.overview.slice(0, 200)}...

**【焦点主题提炼】**
${topicList}

[👉 点击在浏览器中阅读完整报刊](${payload.webUrl})`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msgtype: "markdown",
      markdown: { content: markdownContent },
    }),
  });

  if (!res.ok) {
    throw new Error(`企微 Webhook 响应错误: ${res.status} ${await res.text()}`);
  }
}

export async function sendTelegramNotification(
  token: string,
  chatId: string,
  payload: DigestNotificationPayload
) {
  const topicsStr = payload.topics
    .slice(0, 4)
    .map(
      (t, i) =>
        `*${i + 1}. ${escapeTg(t.title)}*\n${escapeTg(
          t.summary.slice(0, 120)
        )}...`
    )
    .join("\n\n");

  const text = `📰 *${escapeTg(
    payload.channelName
  )} · 每日智汇晨报* \\(${escapeTg(payload.date)}\\)\n\n${escapeTg(
    payload.overview.slice(0, 200)
  )}...\n\n*【重点议题】*\n${topicsStr}\n\n[👉 点击查看完整晨报](${payload.webUrl})`;

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "MarkdownV2",
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Telegram 发送失败: ${res.status} ${await res.text()}`);
  }
}

function escapeTg(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function sendDiscordNotification(
  webhookUrl: string,
  payload: DigestNotificationPayload
) {
  const fields = payload.topics.slice(0, 4).map((t, i) => ({
    name: `${i + 1}. ${t.title}`,
    value: `${t.summary.slice(0, 180)}...`,
    inline: false,
  }));

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: `📰 ${payload.channelName} · 每日晨报 (${payload.date})`,
          description: payload.overview.slice(0, 280),
          url: payload.webUrl,
          color: 0x3b82f6,
          fields,
          footer: { text: "由 Daily RSS Digest 自动生成" },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord 发送失败: ${res.status} ${await res.text()}`);
  }
}

export async function sendEmailNewsletter(
  config: NotificationSettingsConfig,
  payload: DigestNotificationPayload
) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort || 465,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  const topicsHtml = payload.topics
    .map(
      (t, idx) => `
    <div style="margin-bottom: 24px; padding: 18px; border-left: 4px solid #cc785c; background: #faf9f6; border-radius: 4px;">
      <h3 style="margin: 0 0 8px 0; font-size: 17px; color: #1a1a1a;">${idx + 1}. ${t.title}</h3>
      <p style="margin: 0; color: #4a4a4a; line-height: 1.6; font-size: 14px;">${t.summary}</p>
    </div>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1ea; padding: 30px 15px; margin: 0;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; padding: 36px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
        <div style="border-bottom: 2px solid #141413; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: baseline;">
          <h1 style="font-size: 24px; margin: 0; color: #141413; font-weight: 800;">${payload.channelName} · 每日智汇晨报</h1>
          <span style="font-size: 14px; color: #888;">${payload.date}</span>
        </div>
        <div style="background: #fff8f5; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px; margin-bottom: 28px;">
          <h4 style="margin: 0 0 6px 0; color: #c2410c; font-size: 14px; text-transform: uppercase;">今日核心速览</h4>
          <p style="margin: 0; color: #333; line-height: 1.6; font-size: 14px;">${payload.overview}</p>
        </div>
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 18px; color: #111; margin-bottom: 16px; font-weight: 700;">焦点专题提炼</h2>
          ${topicsHtml}
        </div>
        <div style="text-align: center; margin-top: 36px; padding-top: 24px; border-top: 1px solid #eee;">
          <a href="${payload.webUrl}" style="background-color: #141413; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">在浏览器中阅读完整排版与听播客 &rarr;</a>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${payload.channelName} 晨报" <${config.smtpFrom || config.smtpUser}>`,
    to: config.emailRecipients,
    subject: `📰 ${payload.channelName} · ${payload.date} 智汇晨报`,
    html,
  });
}
