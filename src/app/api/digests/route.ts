import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateDailyDigestForChannel } from "@/lib/digest/generator";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const channelSlug = searchParams.get("channelSlug");
    const channelIdParam = searchParams.get("channelId");
    const dateParam = searchParams.get("date"); // YYYY-MM-DD
    const listHistory = searchParams.get("listHistory") === "true";

    let channelId = channelIdParam;
    if (!channelId && channelSlug) {
      const ch = await prisma.channel.findUnique({
        where: { slug: channelSlug },
      });
      if (ch) channelId = ch.id;
    }

    if (!channelId) {
      const defaultChannel = await prisma.channel.findFirst({
        orderBy: { createdAt: "asc" },
      });
      if (defaultChannel) channelId = defaultChannel.id;
    }

    if (!channelId) {
      return NextResponse.json({ error: "暂无频道" }, { status: 404 });
    }

    // 查询历史归档列表
    if (listHistory) {
      const history = await prisma.dailyDigest.findMany({
        where: { channelId },
        select: {
          id: true,
          date: true,
          title: true,
          articleCount: true,
          createdAt: true,
        },
        orderBy: { date: "desc" },
        take: 30,
      });
      return NextResponse.json(history);
    }

    // 获取特定日期或最新一期
    let digest;
    if (dateParam) {
      digest = await prisma.dailyDigest.findUnique({
        where: {
          channelId_date: {
            channelId,
            date: dateParam,
          },
        },
        include: {
          channel: true,
          deliveryLogs: {
            orderBy: { sentAt: "desc" },
            take: 5,
          },
        },
      });
    } else {
      digest = await prisma.dailyDigest.findFirst({
        where: { channelId },
        orderBy: { date: "desc" },
        include: {
          channel: true,
          deliveryLogs: {
            orderBy: { sentAt: "desc" },
            take: 5,
          },
        },
      });
    }

    if (!digest) {
      return NextResponse.json(null, { status: 200 });
    }

    // 解析 sectionsJson
    const parsedSections = JSON.parse(digest.sectionsJson || "{}");

    return NextResponse.json({
      ...digest,
      sections: parsedSections,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channelId, date } = body;

    if (!channelId) {
      return NextResponse.json({ error: "缺少 channelId" }, { status: 400 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const digest = await generateDailyDigestForChannel({
      channelId,
      date,
      baseUrl,
    });

    return NextResponse.json(digest, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
