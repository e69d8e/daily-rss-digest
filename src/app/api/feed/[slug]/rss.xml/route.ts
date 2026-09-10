import { NextResponse } from "next/server";
import { Feed } from "feed";
import { prisma } from "@/lib/db";

export async function GET(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const channel = await prisma.channel.findUnique({
      where: { slug },
      include: {
        digests: {
          where: { status: "COMPLETED" },
          orderBy: { date: "desc" },
          take: 15,
        },
      },
    });

    if (!channel) {
      return new NextResponse("Channel not found", { status: 404 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const siteUrl = `${protocol}://${host}`;

    const feed = new Feed({
      title: `${channel.name} · 每日智汇晨报`,
      description: channel.description || "每日多源聚合 AI 深度晨报",
      id: `${siteUrl}/api/feed/${channel.slug}/rss.xml`,
      link: `${siteUrl}/?channel=${channel.slug}`,
      language: "zh-CN",
      image: `${siteUrl}/favicon.ico`,
      favicon: `${siteUrl}/favicon.ico`,
      copyright: `All rights reserved ${new Date().getFullYear()}, Daily RSS Digest`,
      updated: channel.digests[0]?.createdAt || new Date(),
      generator: "Daily RSS Digest Aggregator",
      author: {
        name: "Daily RSS Digest AI",
        link: siteUrl,
      },
    });

    for (const d of channel.digests) {
      let contentHtml = `<h3>今日核心速览</h3><p>${d.overview}</p><hr/>`;
      try {
        const sections = JSON.parse(d.sectionsJson || "{}");
        if (sections.topics) {
          contentHtml += `<h3>焦点议题深度提炼</h3>`;
          for (const t of sections.topics) {
            contentHtml += `<h4>${t.title}</h4><p>${t.summary}</p>`;
            if (t.sources?.length) {
              contentHtml += `<p><small>参考源：${t.sources
                .map((s: any) => `<a href="${s.url}">${s.sourceName}: ${s.articleTitle}</a>`)
                .join(" | ")}</small></p>`;
            }
          }
        }
      } catch {
        // ignore json error
      }

      feed.addItem({
        title: d.title,
        id: `${siteUrl}/?channel=${channel.slug}&date=${d.date}`,
        link: `${siteUrl}/?channel=${channel.slug}&date=${d.date}`,
        description: d.overview,
        content: contentHtml,
        date: new Date(d.date),
      });
    }

    return new NextResponse(feed.rss2(), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "s-maxage=1800, stale-while-revalidate",
      },
    });
  } catch (error: any) {
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}
