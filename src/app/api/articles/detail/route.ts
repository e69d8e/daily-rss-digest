import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchArticleFullText } from "@/lib/rss/parser";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url")?.trim();
    const id = searchParams.get("id")?.trim();

    if (!url && !id) {
      return NextResponse.json(
        { error: "缺少必要参数: url 或 id" },
        { status: 400 }
      );
    }

    // 1. 查询数据库记录
    let article = null;
    if (id) {
      article = await prisma.article.findUnique({
        where: { id },
        include: { feedSource: true },
      });
    } else if (url) {
      // 容错匹配：URL 去除末尾斜杠或协议差异
      const cleanUrl = url.replace(/\/+$/, "");
      article = await prisma.article.findFirst({
        where: {
          OR: [
            { link: url },
            { link: cleanUrl },
            { link: `${cleanUrl}/` },
          ],
        },
        include: { feedSource: true },
        orderBy: { createdAt: "desc" },
      });
    }

    let content = article?.fullContent || "";
    let isFullText = Boolean(content && content.length > 120);

    const targetUrl = url || article?.link || "";

    // 2. 如果数据库未缓存有效全文，且目标 URL 存在，则尝试实时深度抓取并回写缓存
    if ((!content || content.length <= 120) && targetUrl) {
      try {
        const fetchedText = await fetchArticleFullText(targetUrl);
        if (fetchedText && fetchedText.length > 100) {
          content = fetchedText;
          isFullText = true;

          // 若已有文章记录，更新回写数据库
          if (article) {
            await prisma.article.update({
              where: { id: article.id },
              data: { fullContent: fetchedText },
            });
          }
        }
      } catch (fetchErr) {
        console.warn(`实时抓取正文异常 [${targetUrl}]:`, fetchErr);
      }
    }

    // 3. 兜底回退：若正文抓取受限（如强反爬、付费墙），使用摘要片段
    if (!content) {
      content = article?.summarySnippet || "（该网站开启了严格反爬虫防护或需账号登录，建议点击右上角在新窗口中直接阅读原文）";
    }

    return NextResponse.json({
      id: article?.id || null,
      title: article?.title || "",
      author: article?.author || article?.feedSource?.title || "未知作者",
      sourceName: article?.feedSource?.title || "",
      publishedAt: article?.publishedAt || null,
      link: targetUrl,
      snippet: article?.summarySnippet || "",
      content,
      isFullText,
    });
  } catch (error: any) {
    console.error("获取文章详情失败:", error);
    return NextResponse.json(
      { error: `获取文章详情失败: ${error.message}` },
      { status: 500 }
    );
  }
}
