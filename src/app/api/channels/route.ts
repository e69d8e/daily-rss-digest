import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const channels = await prisma.channel.findMany({
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            url: true,
            siteUrl: true,
            iconUrl: true,
            isFullTextFetch: true,
            lastFetchedAt: true,
            status: true,
            lastError: true,
            _count: {
              select: { articles: true },
            },
          },
        },
        _count: {
          select: {
            sources: true,
            digests: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(channels);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      slug,
      description,
      icon,
      scheduleTime,
      promptTemplate,
      filterKeywords,
      sourceIds,
    } = body;

    if (!name) {
      return NextResponse.json({ error: "频道名称不能为空" }, { status: 400 });
    }

    const finalSlug =
      (slug || name)
        .toLowerCase()
        .trim()
        .replace(/[\s\W-]+/g, "-") || `channel-${Date.now()}`;

    const channel = await prisma.channel.create({
      data: {
        name,
        slug: finalSlug,
        description: description || null,
        icon: icon || "newspaper",
        scheduleTime: scheduleTime || "08:00",
        promptTemplate: promptTemplate || null,
        filterKeywords: filterKeywords
          ? typeof filterKeywords === "string"
            ? filterKeywords
            : JSON.stringify(filterKeywords)
          : null,
      },
    });

    if (Array.isArray(sourceIds) && sourceIds.length > 0) {
      await prisma.feedSource.updateMany({
        where: { id: { in: sourceIds } },
        data: { channelId: channel.id },
      });
    }

    return NextResponse.json(channel, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      slug,
      description,
      icon,
      scheduleTime,
      promptTemplate,
      filterKeywords,
      isEnabled,
      sourceIds,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "缺少频道 ID" }, { status: 400 });
    }

    const channel = await prisma.channel.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        icon,
        scheduleTime,
        promptTemplate,
        filterKeywords: filterKeywords
          ? typeof filterKeywords === "string"
            ? filterKeywords
            : JSON.stringify(filterKeywords)
          : null,
        isEnabled,
      },
    });

    if (Array.isArray(sourceIds) && sourceIds.length > 0) {
      await prisma.feedSource.updateMany({
        where: { id: { in: sourceIds } },
        data: { channelId: channel.id },
      });
    }

    return NextResponse.json(channel);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "缺少频道 ID" }, { status: 400 });
    }

    await prisma.channel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
