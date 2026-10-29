import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyDigestForChannel } from "@/lib/digest/generator";

export async function GET(req: Request) {
  try {
    // 密钥必须通过环境变量配置，缺失时拒绝所有调用（不设任何兜底值）
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      return NextResponse.json(
        { error: "服务端未配置 CRON_SECRET，已拒绝调用" },
        { status: 401 }
      );
    }

    // 仅接受请求头传密钥，禁止 URL 查询参数（避免泄露到访问日志/Referer）
    const authHeader = req.headers.get("authorization");
    const provided = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : req.headers.get("x-cron-secret");

    if (provided !== cronSecret) {
      return NextResponse.json({ error: "未授权调用" }, { status: 401 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const channels = await prisma.channel.findMany({
      where: { isEnabled: true },
      include: {
        sources: {
          where: { status: "ACTIVE" },
        },
      },
    });

    const results = [];
    const today = new Date().toISOString().split("T")[0];

    for (const ch of channels) {
      if (ch.sources.length === 0) continue;
      try {
        const digest = await generateDailyDigestForChannel({
          channelId: ch.id,
          date: today,
          baseUrl,
        });
        results.push({ channel: ch.name, status: "SUCCESS", id: digest.id });
      } catch (err: any) {
        results.push({ channel: ch.name, status: "FAILED", error: err.message });
      }
    }

    return NextResponse.json({
      date: today,
      processedChannels: channels.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
