import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseOpml, generateOpml } from "@/lib/rss/opml";

export async function GET() {
  try {
    const channels = await prisma.channel.findMany({
      include: {
        sources: {
          select: { title: true, url: true, siteUrl: true },
        },
      },
    });

    const opmlXml = generateOpml(channels);

    return new NextResponse(opmlXml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="rss-digest-export-${
          new Date().toISOString().split("T")[0]
        }.opml"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { opmlContent, targetChannelId } = body;

    if (!opmlContent) {
      return NextResponse.json(
        { error: "OPML 文件内容不能为空" },
        { status: 400 }
      );
    }

    const items = parseOpml(opmlContent);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "未从 OPML 文件中解析到任何有效 RSS 订阅源" },
        { status: 422 }
      );
    }

    // 默认或指定的 channel
    let defaultChannelId = targetChannelId;
    if (!defaultChannelId) {
      const firstChannel = await prisma.channel.findFirst();
      if (firstChannel) {
        defaultChannelId = firstChannel.id;
      } else {
        const created = await prisma.channel.create({
          data: {
            name: "默认频道",
            slug: "default",
            description: "通过 OPML 自动导入创建的默认频道",
          },
        });
        defaultChannelId = created.id;
      }
    }

    let importedCount = 0;
    let skippedCount = 0;

    for (const it of items) {
      // 避免重复
      const existing = await prisma.feedSource.findFirst({
        where: {
          channelId: defaultChannelId,
          url: it.xmlUrl,
        },
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      await prisma.feedSource.create({
        data: {
          channelId: defaultChannelId,
          title: it.title || "未命名源",
          url: it.xmlUrl,
          siteUrl: it.htmlUrl || null,
        },
      });
      importedCount++;
    }

    return NextResponse.json({
      success: true,
      totalParsed: items.length,
      importedCount,
      skippedCount,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
