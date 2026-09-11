import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId");
    const limit = Math.min(Number(searchParams.get("limit")) || 30, 50);

    const articles = await prisma.article.findMany({
      where: channelId
        ? {
            feedSource: { channelId },
          }
        : undefined,
      include: {
        feedSource: {
          select: { id: true, title: true, siteUrl: true },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(articles);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
