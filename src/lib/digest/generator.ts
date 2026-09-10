import { prisma } from "../db";
import { fetchAndParseFeed, fetchArticleFullText } from "../rss/parser";
import { generateAiDigest } from "../ai/summarizer";
import { dispatchDigestNotifications } from "../notify/dispatcher";
import { FilterKeywordsConfig } from "@/types";

export async function generateDailyDigestForChannel({
  channelId,
  date,
  baseUrl = "http://localhost:3000",
}: {
  channelId: string;
  date?: string;
  baseUrl?: string;
}) {
  const targetDate = date || new Date().toISOString().split("T")[0];

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      sources: true,
    },
  });

  if (!channel) {
    throw new Error(`找不到指定频道: ${channelId}`);
  }

  // 解析过滤关键词规则
  let filterConfig: FilterKeywordsConfig = {};
  if (channel.filterKeywords) {
    try {
      filterConfig = JSON.parse(channel.filterKeywords);
    } catch {
      // 容错按逗号拆分
      filterConfig = {
        exclude: channel.filterKeywords
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
  }

  // 1. 抓取所有源文章
  const fetchedArticlesForAi: {
    title: string;
    link: string;
    sourceName: string;
    author?: string;
    snippet?: string;
    fullContent?: string;
  }[] = [];

  for (const source of channel.sources) {
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

      // 仅保留近 48 小时内的文章或最新的前 15 篇
      const candidateItems = feedData.items.slice(0, 15);

      for (const item of candidateItems) {
        let fullContent = "";
        if (source.isFullTextFetch) {
          fullContent = await fetchArticleFullText(item.link);
        }

        // 1. 保存到数据库供留存（在过滤前入库，真实记录源活跃历史）
        try {
          await prisma.article.create({
            data: {
              feedSourceId: source.id,
              title: item.title,
              link: item.link,
              author: item.author,
              publishedAt: item.publishedAt,
              summarySnippet: item.contentSnippet,
              fullContent: fullContent || null,
            },
          });
        } catch {
          // 忽略已入库文章
        }

        // 2. 过滤检查（仅针对送入 AI 提炼的候选文章）
        // 黑名单词（如“招聘”、“广告”）优先精准匹配标题，防止作者简介或专栏固定导言包含“招人”导致整篇误杀
        if (filterConfig.exclude && filterConfig.exclude.length > 0) {
          const titleMatchesExclude = filterConfig.exclude.some(
            (kw) => kw && item.title.toLowerCase().includes(kw.toLowerCase())
          );
          if (titleMatchesExclude) continue;
        }

        // 白名单词匹配标题或摘要
        if (filterConfig.include && filterConfig.include.length > 0) {
          const textToCheck = `${item.title} ${item.contentSnippet || ""}`;
          const isIncluded = filterConfig.include.some(
            (kw) => kw && textToCheck.toLowerCase().includes(kw.toLowerCase())
          );
          if (!isIncluded) continue;
        }

        fetchedArticlesForAi.push({
          title: item.title,
          link: item.link,
          sourceName: source.title,
          author: item.author,
          snippet: item.contentSnippet,
          fullContent,
        });
      }
    } catch (err: any) {
      console.error(`源抓取异常 [${source.title}]:`, err.message);
      await prisma.feedSource.update({
        where: { id: source.id },
        data: {
          status: "ERROR",
          lastError: err.message,
        },
      });
    }
  }

  if (fetchedArticlesForAi.length === 0) {
    throw new Error(
      `未抓取到任何有效文章（请检查频道中的源配置或网络连通性）`
    );
  }

  // 2. 调用 AI 进行主题聚类与提炼
  const aiResult = await generateAiDigest({
    channelName: channel.name,
    channelDescription: channel.description,
    customPrompt: channel.promptTemplate,
    articles: fetchedArticlesForAi,
    targetDate,
  });

  // 3. 存储生成结果到 DailyDigest
  const digest = await prisma.dailyDigest.upsert({
    where: {
      channelId_date: {
        channelId: channel.id,
        date: targetDate,
      },
    },
    update: {
      title: aiResult.title,
      overview: aiResult.overview,
      sectionsJson: JSON.stringify(aiResult.sections),
      rawAiOutput: aiResult.rawAiOutput || null,
      audioText: aiResult.audioText,
      articleCount: fetchedArticlesForAi.length,
      status: "COMPLETED",
      error: null,
    },
    create: {
      channelId: channel.id,
      date: targetDate,
      title: aiResult.title,
      overview: aiResult.overview,
      sectionsJson: JSON.stringify(aiResult.sections),
      rawAiOutput: aiResult.rawAiOutput || null,
      audioText: aiResult.audioText,
      articleCount: fetchedArticlesForAi.length,
      status: "COMPLETED",
    },
  });

  // 4. 派发推送通知
  try {
    const webUrl = `${baseUrl}/?channel=${channel.slug}&date=${targetDate}`;
    await dispatchDigestNotifications(
      {
        channelName: channel.name,
        date: targetDate,
        title: digest.title,
        overview: digest.overview,
        topics: aiResult.sections.topics.map((t) => ({
          title: t.title,
          summary: t.summary,
          url: t.sources[0]?.url,
        })),
        webUrl,
      },
      digest.id
    );
  } catch (err) {
    console.error("派发推送通知异常:", err);
  }

  return digest;
}
