import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyDigestForChannel } from "@/lib/digest/generator";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "rss_digest_secret_key_2026";

    // 简单密钥校验
    if (authHeader !== `Bearer ${cronSecret}`) {
      const urlSecret = new URL(req.url).searchParams.get("key");
      if (urlSecret !== cronSecret) {
        return NextResponse.json({ error: "未授权调用" }, { status: 401 });
      }
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
