import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAndParseFeed } from "@/lib/rss/parser";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");

    const feeds = await prisma.feedSource.findMany({
      where: channelId ? { channelId } : undefined,
      include: {
        channel: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { articles: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(feeds);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channelId, url, title, isFullTextFetch, previewOnly } = body;

    if (!url) {
      return NextResponse.json({ error: "RSS URL 不能为空" }, { status: 400 });
    }

    // 抓取并校验 RSS 连通性
    let parsedFeed;
    try {
      parsedFeed = await fetchAndParseFeed(url.trim());
    } catch (err: any) {
      return NextResponse.json(
        { error: `RSS 源解析失败: ${err.message}` },
        { status: 422 }
      );
    }

    // 如果只是测试预览
    if (previewOnly) {
      return NextResponse.json({
        title: parsedFeed.title,
        description: parsedFeed.description,
        siteUrl: parsedFeed.siteUrl,
        sampleArticles: parsedFeed.items.slice(0, 3).map((it) => ({
          title: it.title,
          link: it.link,
          publishedAt: it.publishedAt,
        })),
      });
    }

    if (!channelId) {
      return NextResponse.json({ error: "请选择所属频道" }, { status: 400 });
    }

    // 创建源并保存解析到的最新文章
    const feedSource = await prisma.feedSource.create({
      data: {
        channelId,
        url: url.trim(),
        title: title?.trim() || parsedFeed.title || "新订阅源",
        siteUrl: parsedFeed.siteUrl || null,
        isFullTextFetch: Boolean(isFullTextFetch),
        lastFetchedAt: new Date(),
        status: "ACTIVE",
      },
    });

    // 预存前 5 篇文章
    for (const item of parsedFeed.items.slice(0, 5)) {
      try {
        await prisma.article.create({
          data: {
            feedSourceId: feedSource.id,
            title: item.title,
            link: item.link,
            author: item.author,
            publishedAt: item.publishedAt,
            summarySnippet: item.contentSnippet,
          },
        });
      } catch {
        // ignore duplicate
      }
    }

    return NextResponse.json(feedSource, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, channelId, title, url, isFullTextFetch, status } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少源 ID" }, { status: 400 });
    }

    const data: any = {};
    if (channelId) data.channelId = channelId;
    if (title) data.title = title.trim();
    if (url) data.url = url.trim();
    if (typeof isFullTextFetch === "boolean") data.isFullTextFetch = isFullTextFetch;
    if (status) data.status = status;

    const updated = await prisma.feedSource.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少源 ID" }, { status: 400 });
    }

    await prisma.feedSource.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
