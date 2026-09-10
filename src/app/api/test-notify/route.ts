import { NextResponse } from "next/server";
import {
  sendFeishuNotification,
  sendWecomNotification,
  sendTelegramNotification,
  sendDiscordNotification,
  sendEmailNewsletter,
} from "@/lib/notify/dispatcher";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, config } = body;

    const testPayload = {
      channelName: "测试频道",
      date: new Date().toISOString().split("T")[0],
      title: "【连通性测试】Daily RSS Digest 推送验证",
      overview:
        "这是一条来自 Daily RSS Digest 系统的测试通知。恭喜！这证明您的推送通道配置完全正常有效。",
      topics: [
        {
          title: "AI 智汇引擎已连接",
          summary: "系统已就绪，每日晨报将自动聚合跨源重点资讯并按计划推送。",
          url: "https://github.com",
        },
      ],
      webUrl: "http://localhost:3000",
    };

    if (type === "feishu") {
      if (!config.url) throw new Error("缺少飞书 Webhook 地址");
      await sendFeishuNotification(config.url, testPayload);
    } else if (type === "wecom") {
      if (!config.url) throw new Error("缺少企业微信 Webhook 地址");
      await sendWecomNotification(config.url, testPayload);
    } else if (type === "telegram") {
      if (!config.token || !config.chatId) throw new Error("缺少 Telegram Token 或 Chat ID");
      await sendTelegramNotification(config.token, config.chatId, testPayload);
    } else if (type === "discord") {
      if (!config.url) throw new Error("缺少 Discord Webhook 地址");
      await sendDiscordNotification(config.url, testPayload);
    } else if (type === "email") {
      if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.emailRecipients) {
        throw new Error("SMTP 配置不完整");
      }
      await sendEmailNewsletter(
        {
          smtpHost: config.smtpHost,
          smtpPort: parseInt(config.smtpPort || "465", 10),
          smtpUser: config.smtpUser,
          smtpPass: config.smtpPass,
          smtpFrom: config.smtpFrom,
          emailRecipients: config.emailRecipients,
        },
        testPayload
      );
    } else {
      throw new Error(`未知通知类型: ${type}`);
    }

    return NextResponse.json({ success: true, message: "测试消息发送成功！请前往对应应用查收。" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
