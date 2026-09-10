import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAndParseFeed } from "@/lib/rss/parser";

export async function POST() {
  try {
    const sources = await prisma.feedSource.findMany();
    const results = [];

    for (const source of sources) {
      try {
        const feedData = await fetchAndParseFeed(source.url);
        await prisma.feedSource.update({
          where: { id: source.id },
          data: {
            lastFetchedAt: new Date(),
            status: "ACTIVE",
            lastError: null,
            title: source.title || feedData.title,
            siteUrl: source.siteUrl || feedData.siteUrl,
          },
        });

        let saved = 0;
        for (const item of feedData.items.slice(0, 15)) {
          try {
            await prisma.article.create({
              data: {
                feedSourceId: source.id,
                title: item.title,
                link: item.link,
                author: item.author,
                publishedAt: item.publishedAt,
                summarySnippet: item.contentSnippet,
              },
            });
            saved++;
          } catch {
            // ignore duplicate
          }
        }

        results.push({
          id: source.id,
          title: source.title,
          status: "OK",
          newArticles: saved,
        });
      } catch (err: any) {
        await prisma.feedSource.update({
          where: { id: source.id },
          data: {
            status: "ERROR",
            lastError: err.message,
          },
        });
        results.push({
          id: source.id,
          title: source.title,
          status: "ERROR",
          error: err.message,
        });
      }
    }

    return NextResponse.json({ success: true, processed: sources.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
