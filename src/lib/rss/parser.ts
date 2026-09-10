import Parser from "rss-parser";
import * as cheerio from "cheerio";

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 DailyRSSDigest/1.0",
    Accept:
      "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

export interface ParsedFeedResult {
  title: string;
  description?: string;
  siteUrl?: string;
  items: {
    title: string;
    link: string;
    pubDate?: string;
    publishedAt: Date;
    author?: string;
    content?: string;
    contentSnippet?: string;
  }[];
}

export async function fetchAndParseFeed(
  feedUrl: string
): Promise<ParsedFeedResult> {
  const cleanUrl = feedUrl.trim();

  // 1. 针对 36 氪的专项适配：由于官网 /feed 部署了火山引擎 WAF 盾拦截直接 XML 请求，改用其官方快讯开放网关
  if (cleanUrl.includes("36kr.com")) {
    try {
      return await fetch36KrNewsflashes();
    } catch (err: any) {
      console.warn("36kr 专有网关抓取异常，尝试回退常规流程:", err.message);
    }
  }

  try {
    // 2. 自定义 Fetch 请求获取原始内容
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 DailyRSSDigest/1.0",
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP 状态码错误: ${res.status} ${res.statusText}`);
    }

    const rawText = await res.text();
    const trimmed = rawText.trim();

    // 3. 拦截检测：如果返回的是网页而非 RSS/Atom XML
    if (
      (trimmed.startsWith("<!DOCTYPE html") || trimmed.startsWith("<html")) &&
      !trimmed.includes("<rss") &&
      !trimmed.includes("<feed")
    ) {
      if (
        trimmed.includes("火山引擎") ||
        trimmed.includes("安全检测") ||
        trimmed.includes("Cloudflare") ||
        trimmed.includes("Just a moment")
      ) {
        throw new Error(
          `目标站点部署了 WAF 安全防护盾（如火山引擎/Cloudflare 反爬拦截），无法获取有效 RSS XML`
        );
      }
      throw new Error(
        `该地址返回的是 HTML 网页而非 RSS 订阅源，请确认链接是否为真实的 RSS/Atom XML 地址`
      );
    }

    // 4. 修复常见 XML 实体错误：将未转义的独立 & 替换为 &amp;
    const sanitizedXml = rawText.replace(
      /&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi,
      "&amp;"
    );

    // 5. 优先使用 rss-parser 解析
    try {
      const feed = await parser.parseString(sanitizedXml);
      const items = (feed.items || []).map((item) => {
        let publishedAt = new Date();
        if (item.isoDate) {
          publishedAt = new Date(item.isoDate);
        } else if (item.pubDate) {
          const d = new Date(item.pubDate);
          if (!isNaN(d.getTime())) {
            publishedAt = d;
          }
        }

        let snippet = item.contentSnippet || "";
        if (!snippet && item.content) {
          const $ = cheerio.load(item.content);
          snippet = $("body").text().trim().slice(0, 300);
        }

        return {
          title: (item.title || "无标题文章").trim(),
          link: (item.link || "").trim(),
          pubDate: item.pubDate,
          publishedAt,
          author: item.creator || item["dc:creator"] || feed.title || "",
          content: item.content || item["content:encoded"],
          contentSnippet: snippet.slice(0, 500),
        };
      });

      return {
        title: feed.title || "未命名订阅源",
        description: feed.description,
        siteUrl: feed.link,
        items: items.filter((i) => Boolean(i.link && i.title)),
      };
    } catch (parseErr: any) {
      // 6. 如果 sax 解析器仍因特殊字符报错，自动降级为容错极强的 cheerio (htmlparser2) 容错解析
      console.warn(
        `rss-parser 解析失败 [${parseErr.message}]，启用 Cheerio 弹性解析...`
      );
      return parseFeedWithCheerio(sanitizedXml, cleanUrl);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`抓取/解析 RSS 订阅源失败 [${cleanUrl}]: ${msg}`);
  }
}

/**
 * 36氪快讯与商业早报专项网关适配
 */
async function fetch36KrNewsflashes(): Promise<ParsedFeedResult> {
  const res = await fetch(
    "https://gateway.36kr.com/api/mis/nav/newsflash/flow",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        partner_id: "wap",
        param: {
          pageSize: 25,
          siteId: 1,
          platformId: 2,
          pageCallback: "",
          pageEvent: 0,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`36氪网关响应异常: ${res.status}`);
  }

  const json = await res.json();
  const list = json?.data?.itemList || [];

  const items = list.map((it: any) => {
    const mat = it.templateMaterial || {};
    const title = (mat.widgetTitle || "36氪商业快讯").trim();
    const snippet = (mat.widgetContent || "").trim();
    const publishedAt = mat.publishTime ? new Date(mat.publishTime) : new Date();
    const link = mat.itemId
      ? `https://36kr.com/newsflashes/${mat.itemId}`
      : "https://36kr.com/newsflashes";

    return {
      title,
      link,
      publishedAt,
      author: "36氪",
      contentSnippet: snippet,
      content: snippet,
    };
  });

  return {
    title: "36氪 8点1氪 · 商业与宏观快讯",
    description: "36氪商业、宏观科技与市场全天候动态速览",
    siteUrl: "https://36kr.com",
    items: items.filter((i: any) => Boolean(i.title && i.link)),
  };
}

/**
 * 基于 htmlparser2 的高容错兜底 XML 解析器
 */
function parseFeedWithCheerio(
  xmlText: string,
  feedUrl: string
): ParsedFeedResult {
  const $ = cheerio.load(xmlText, { xmlMode: true });

  const channelTitle =
    $("channel > title, feed > title").first().text().trim() ||
    "未命名订阅源";
  const channelDesc = $(
    "channel > description, feed > subtitle"
  )
    .first()
    .text()
    .trim();
  const channelLink =
    $("channel > link, feed > link").first().text().trim() ||
    $("channel > link, feed > link").first().attr("href") ||
    feedUrl;

  const items: ParsedFeedResult["items"] = [];

  $("item, entry").each((_, el) => {
    const itemEl = $(el);
    const title = itemEl.find("title").first().text().trim();
    let link = itemEl.find("link").first().text().trim();
    if (!link) {
      link = itemEl.find("link").first().attr("href") || "";
    }
    const pubDateStr = itemEl
      .find("pubDate, published, updated")
      .first()
      .text()
      .trim();
    let publishedAt = new Date();
    if (pubDateStr) {
      const d = new Date(pubDateStr);
      if (!isNaN(d.getTime())) publishedAt = d;
    }
    const author = itemEl
      .find("author, dc\\:creator, creator")
      .first()
      .text()
      .trim();
    const content = itemEl
      .find("content\\:encoded, content")
      .first()
      .text()
      .trim();
    let snippet = itemEl.find("description, summary").first().text().trim();
    if (snippet.startsWith("<")) {
      const $desc = cheerio.load(snippet);
      snippet = $desc.text().trim();
    }

    if (title && link) {
      items.push({
        title,
        link,
        pubDate: pubDateStr,
        publishedAt,
        author: author || undefined,
        content: content || snippet,
        contentSnippet: snippet.slice(0, 500),
      });
    }
  });

  if (items.length === 0) {
    throw new Error("无法从该订阅源中解析出文章条目");
  }

  return {
    title: channelTitle,
    description: channelDesc,
    siteUrl: channelLink,
    items,
  };
}

/**
 * 针对仅有截断摘要的源，提取文章原文正文并保留清晰段落
 */
export async function fetchArticleFullText(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return "";
    const html = await res.text();
    const $ = cheerio.load(html);

    $(
      "script, style, iframe, nav, footer, header, noscript, .ads, .ad, .comment, #comments, .sidebar, .share, .recommend, .menu, .bottom, .copyright, svg"
    ).remove();

    const articleSelectors = [
      ".p_mainnew", // Solidot 奇客正文
      "article",
      ".article-content",
      ".post-content",
      ".entry-content",
      ".markdown-body",
      "#article-root",
      ".article-body",
      ".news-content",
      ".content_view",
      "#content",
      "main",
    ];

    let targetEl: any = null;
    for (const sel of articleSelectors) {
      const match = $(sel);
      if (match.length > 0 && match.text().trim().length > 60) {
        targetEl = match;
        break;
      }
    }

    if (!targetEl) {
      targetEl = $("body");
    }

    const paragraphs: string[] = [];

    // 如果匹配到了具体文章容器（非通用 body），优先提取该容器本身包含的纯净内容
    if (targetEl && targetEl[0] !== $("body")[0]) {
      const elements = targetEl.find("p, h1, h2, h3, h4, blockquote, li");
      if (elements.length > 0) {
        elements.each((_: number, el: any) => {
          const text = $(el).text().trim().replace(/[ \t]+/g, " ");
          if (text.length > 10) {
            paragraphs.push(text);
          }
        });
      }

      // 若子标签很少（例如文本直接在 div 容器中，如 Solidot），按换行符拆分直接取容器文字
      if (paragraphs.length === 0) {
        const directText = targetEl.text().trim();
        if (directText.length > 20) {
          const lines = directText
            .split(/\n+/)
            .map((p: string) => p.trim().replace(/[ \t]+/g, " "))
            .filter((p: string) => p.length > 10);
          paragraphs.push(...lines);
        }
      }
    } else {
      // 容错针对整个 body
      const elements = targetEl.find("p, h1, h2, h3, h4, blockquote, li");
      if (elements.length > 0) {
        elements.each((_: number, el: any) => {
          const text = $(el).text().trim().replace(/[ \t]+/g, " ");
          if (text.length > 15) {
            paragraphs.push(text);
          }
        });
      }
    }

    const fullText = paragraphs.join("\n\n").slice(0, 8000);
    return fullText;
  } catch (err) {
    console.warn(`抓取正文失败 [${url}]:`, err);
    return "";
  }
}
