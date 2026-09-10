import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAdminAuth } from "@/lib/auth";

// 辅助安全脱敏函数
function maskSecret(val: string | null | undefined, head = 4, tail = 4): string {
  if (!val || val.trim().length === 0) return "";
  const clean = val.trim();
  if (clean.length <= head + tail) {
    return "••••••••";
  }
  return `${clean.slice(0, head)}••••••••${clean.slice(-tail)}`;
}

export async function GET(req: Request) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json(
        { error: "未授权：请先输入管理员访问密码" },
        { status: 401 }
      );
    }

    const allSettings = await prisma.systemSetting.findMany();
    const map = new Map(allSettings.map((s) => [s.key, s.value]));

    const dbApiKey = map.get("ai_api_key") || "";
    const envApiKey = process.env.AI_API_KEY || "";
    const hasApiKey = Boolean(dbApiKey || envApiKey);
    const isEnvKey = Boolean(!dbApiKey && envApiKey);

    // 绝不在 GET 接口返回明文 API Key，仅返回脱敏后的占位信息
    let maskedApiKey = "";
    if (isEnvKey) {
      maskedApiKey = "•••••••• (云端环境变量已注入)";
    } else if (dbApiKey) {
      maskedApiKey = maskSecret(dbApiKey, 4, 4);
    }

    const ai = {
      provider: map.get("ai_provider") || "deepseek",
      apiFormat: map.get("ai_api_format") || "chat_completions",
      apiKey: maskedApiKey,
      hasApiKey,
      isEnvKey,
      baseURL: map.get("ai_base_url") || "https://api.deepseek.com/v1",
      model: map.get("ai_model") || "deepseek-chat",
      temperature: parseFloat(map.get("ai_temperature") || "0.4"),
    };

    const rawSmtpPass = map.get("notify_smtp_pass") || "";
    const rawTgToken = map.get("notify_telegram_bot_token") || "";

    const notification = {
      feishuWebhook: map.get("notify_feishu_webhook") || "",
      wecomWebhook: map.get("notify_wecom_webhook") || "",
      telegramBotToken: maskSecret(rawTgToken, 4, 3),
      hasTelegramBotToken: Boolean(rawTgToken),
      telegramChatId: map.get("notify_telegram_chat_id") || "",
      discordWebhook: map.get("notify_discord_webhook") || "",
      smtpHost: map.get("notify_smtp_host") || "",
      smtpPort: parseInt(map.get("notify_smtp_port") || "465", 10),
      smtpUser: map.get("notify_smtp_user") || "",
      smtpPass: maskSecret(rawSmtpPass, 2, 2),
      hasSmtpPass: Boolean(rawSmtpPass),
      smtpFrom: map.get("notify_smtp_from") || "",
      emailRecipients: map.get("notify_email_recipients") || "",
      enableFeishu: map.get("notify_enable_feishu") === "true",
      enableWecom: map.get("notify_enable_wecom") === "true",
      enableTelegram: map.get("notify_enable_telegram") === "true",
      enableDiscord: map.get("notify_enable_discord") === "true",
      enableEmail: map.get("notify_enable_email") === "true",
    };

    return NextResponse.json({ ai, notification });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const isAuthed = await verifyAdminAuth(req);
    if (!isAuthed) {
      return NextResponse.json(
        { error: "未授权：请先输入管理员访问密码" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { ai, notification } = body;

    const updates: { key: string; value: string }[] = [];

    if (ai) {
      if (ai.provider !== undefined)
        updates.push({ key: "ai_provider", value: String(ai.provider) });
      if (ai.apiFormat !== undefined)
        updates.push({ key: "ai_api_format", value: String(ai.apiFormat) });
      
      // 密钥处理：若包含掩码字符 • 或为空，则保留已有密钥不覆盖；若为 __CLEAR__ 则删除
      if (ai.apiKey !== undefined) {
        const keyStr = String(ai.apiKey).trim();
        if (keyStr === "__CLEAR__") {
          await prisma.systemSetting.deleteMany({ where: { key: "ai_api_key" } });
        } else if (keyStr && !keyStr.includes("•••") && !keyStr.includes("云端环境变量")) {
          updates.push({ key: "ai_api_key", value: keyStr });
        }
      }

      if (ai.baseURL !== undefined)
        updates.push({ key: "ai_base_url", value: String(ai.baseURL) });
      if (ai.model !== undefined)
        updates.push({ key: "ai_model", value: String(ai.model) });
      if (ai.temperature !== undefined)
        updates.push({ key: "ai_temperature", value: String(ai.temperature) });
    }

    if (notification) {
      if (notification.feishuWebhook !== undefined)
        updates.push({ key: "notify_feishu_webhook", value: String(notification.feishuWebhook) });
      if (notification.wecomWebhook !== undefined)
        updates.push({ key: "notify_wecom_webhook", value: String(notification.wecomWebhook) });
      
      if (notification.telegramBotToken !== undefined) {
        const tokenStr = String(notification.telegramBotToken).trim();
        if (tokenStr === "__CLEAR__") {
          await prisma.systemSetting.deleteMany({ where: { key: "notify_telegram_bot_token" } });
        } else if (tokenStr && !tokenStr.includes("•••")) {
          updates.push({ key: "notify_telegram_bot_token", value: tokenStr });
        }
      }

      if (notification.telegramChatId !== undefined)
        updates.push({ key: "notify_telegram_chat_id", value: String(notification.telegramChatId) });
      if (notification.discordWebhook !== undefined)
        updates.push({ key: "notify_discord_webhook", value: String(notification.discordWebhook) });
      if (notification.smtpHost !== undefined)
        updates.push({ key: "notify_smtp_host", value: String(notification.smtpHost) });
      if (notification.smtpPort !== undefined)
        updates.push({ key: "notify_smtp_port", value: String(notification.smtpPort) });
      if (notification.smtpUser !== undefined)
        updates.push({ key: "notify_smtp_user", value: String(notification.smtpUser) });
      
      if (notification.smtpPass !== undefined) {
        const passStr = String(notification.smtpPass).trim();
        if (passStr === "__CLEAR__") {
          await prisma.systemSetting.deleteMany({ where: { key: "notify_smtp_pass" } });
        } else if (passStr && !passStr.includes("•••")) {
          updates.push({ key: "notify_smtp_pass", value: passStr });
        }
      }

      if (notification.smtpFrom !== undefined)
        updates.push({ key: "notify_smtp_from", value: String(notification.smtpFrom) });
      if (notification.emailRecipients !== undefined)
        updates.push({ key: "notify_email_recipients", value: String(notification.emailRecipients) });
      if (notification.enableFeishu !== undefined)
        updates.push({ key: "notify_enable_feishu", value: String(notification.enableFeishu) });
      if (notification.enableWecom !== undefined)
        updates.push({ key: "notify_enable_wecom", value: String(notification.enableWecom) });
      if (notification.enableTelegram !== undefined)
        updates.push({ key: "notify_enable_telegram", value: String(notification.enableTelegram) });
      if (notification.enableDiscord !== undefined)
        updates.push({ key: "notify_enable_discord", value: String(notification.enableDiscord) });
      if (notification.enableEmail !== undefined)
        updates.push({ key: "notify_enable_email", value: String(notification.enableEmail) });
    }

    for (const item of updates) {
      await prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
