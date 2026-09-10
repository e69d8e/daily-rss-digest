import Parser from "rss-parser";
import * as cheerio from "cheerio";
import dns from "node:dns";

// 优先使用 IPv4 解析（防止双栈网络或云端 Runner 尝试连接失效/阻断的 AAAA 记录导致 fetch failed）
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
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

/**
 * 带有超时与自动重试的弹性 Fetch 请求封装
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 1,
  backoffMs = 800
): Promise<Response> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } catch (err: any) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, backoffMs * (attempt + 1))
        );
      }
    }
  }
  throw lastError;
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

  // 2. 针对界面新闻的专项高可用适配：优先抓取官方 XML 源，若遇云端/海外 IP 阻断或超时，自动平滑无缝降级为精选商业与宏观移动端网关
  if (cleanUrl.includes("jiemian.com")) {
    try {
      return await fetchJiemianWithFallback(cleanUrl);
    } catch (err: any) {
      console.warn("界面新闻专用流程抓取异常，尝试回退常规流程:", err.message);
    }
  }

  try {
    // 3. 自定义 Fetch 请求获取原始内容（带自动重试与标准浏览器头）
    const res = await fetchWithRetry(
      cleanUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
        },
      },
      1,
      800
    );

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
    const err = error as any;
    const causeMsg =
      err?.cause?.message ||
      err?.cause?.code ||
      (typeof err?.cause === "string" ? err.cause : "");
    const baseMsg = err instanceof Error ? err.message : String(err);
    const fullMsg = causeMsg ? `${baseMsg} (原因: ${causeMsg})` : baseMsg;
    throw new Error(`抓取/解析 RSS 订阅源失败 [${cleanUrl}]: ${fullMsg}`);
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
 * 针对界面新闻的高可用双重容灾适配：
 * 优先抓取官方 XML 订阅源，若遇云端/海外 IP 阻断、WAF 盾或网络超时，自动降级为商业与宏观精选流
 */
async function fetchJiemianWithFallback(
  feedUrl: string
): Promise<ParsedFeedResult> {
  try {
    const res = await fetchWithRetry(
      feedUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
      },
      1,
      800
    );

    if (res.ok) {
      const rawText = await res.text();
      const trimmed = rawText.trim();
      if (trimmed.includes("<rss") || trimmed.includes("<feed")) {
        const sanitizedXml = rawText.replace(
          /&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi,
          "&amp;"
        );
        try {
          const feed = await parser.parseString(sanitizedXml);
          const items = (feed.items || []).map((item) => {
            let publishedAt = new Date();
            if (item.isoDate) {
              publishedAt = new Date(item.isoDate);
            } else if (item.pubDate) {
              const d = new Date(item.pubDate);
              if (!isNaN(d.getTime())) publishedAt = d;
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
              author: item.creator || item["dc:creator"] || "界面新闻",
              content: item.content || item["content:encoded"],
              contentSnippet: snippet.slice(0, 500),
            };
          });

          if (items.length > 0) {
            return {
              title: feed.title || "界面新闻 · 商业与宏观",
              description:
                feed.description || "界面新闻精品商业与宏观经济要闻",
              siteUrl: feed.link || "https://www.jiemian.com",
              items: items.filter((i) => Boolean(i.link && i.title)),
            };
          }
        } catch (parseErr: any) {
          console.warn("界面新闻 XML 解析异常，尝试 Cheerio 兜底:", parseErr.message);
          return parseFeedWithCheerio(sanitizedXml, feedUrl);
        }
      }
    }
  } catch (err: any) {
    console.warn(
      `界面新闻 XML 源请求异常 [${err.message}]，启动商业与宏观移动端容灾流...`
    );
  }

  // 触发容灾降级：抓取界面新闻移动端「商业」与「宏观」精选
  return await fetchJiemianMobileFallback();
}

/**
 * 解析中文相对时间文本（如 "23分钟前"、"今天 13:43"、"昨天 18:20"）
 */
function parseRelativeDate(str: string): Date {
  const now = new Date();
  str = str.trim();

  const minMatch = str.match(/(\d+)\s*分钟前/);
  if (minMatch) {
    return new Date(now.getTime() - parseInt(minMatch[1], 10) * 60 * 1000);
  }

  const hourMatch = str.match(/(\d+)\s*小时前/);
  if (hourMatch) {
    return new Date(now.getTime() - parseInt(hourMatch[1], 10) * 3600 * 1000);
  }

  const todayMatch = str.match(/今天\s*(\d{1,2}):(\d{2})/);
  if (todayMatch) {
    const d = new Date(now);
    d.setHours(parseInt(todayMatch[1], 10), parseInt(todayMatch[2], 10), 0, 0);
    return d;
  }

  const yestMatch = str.match(/昨天\s*(\d{1,2}):(\d{2})/);
  if (yestMatch) {
    const d = new Date(now.getTime() - 86400000);
    d.setHours(parseInt(yestMatch[1], 10), parseInt(yestMatch[2], 10), 0, 0);
    return d;
  }

  const monthDayMatch = str.match(
    /(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/
  );
  if (monthDayMatch) {
    const d = new Date(now);
    d.setMonth(parseInt(monthDayMatch[1], 10) - 1);
    d.setDate(parseInt(monthDayMatch[2], 10));
    d.setHours(
      parseInt(monthDayMatch[3], 10),
      parseInt(monthDayMatch[4], 10),
      0,
      0
    );
    return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? now : d;
}

/**
 * 界面新闻移动端精选（商业与宏观）容灾兜底解析器
 */
async function fetchJiemianMobileFallback(): Promise<ParsedFeedResult> {
  const categoryUrls = [
    { url: "https://m.jiemian.com/lists/2_1.html", cat: "商业" },
    { url: "https://m.jiemian.com/lists/174_1.html", cat: "宏观" },
  ];

  const items: ParsedFeedResult["items"] = [];
  const seenLinks = new Set<string>();

  for (const { url, cat } of categoryUrls) {
    try {
      const res = await fetchWithRetry(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          },
        },
        1,
        800
      );

      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);

      $(".news-view").each((_, el) => {
        const $el = $(el);
        const titleEl = $el.find(".news-header h3 a, h3 a").first();
        const title = titleEl.text().trim();
        let link = titleEl.attr("href") || "";
        if (!link) return;

        // 标准化链接为 web 端格式
        if (link.startsWith("/")) {
          link = "https://www.jiemian.com" + link;
        } else if (link.startsWith("https://m.jiemian.com/")) {
          link = link.replace(
            "https://m.jiemian.com/",
            "https://www.jiemian.com/"
          );
        }

        if (seenLinks.has(link) || !title) return;
        seenLinks.add(link);

        const footerSpans = $el.find(".news-footer p span");
        const authorOrTag =
          footerSpans.first().text().trim() || `界面新闻 · ${cat}`;
        const timeText =
          footerSpans.length > 1 ? footerSpans.eq(1).text().trim() : "";

        let publishedAt = new Date();
        if (timeText) {
          publishedAt = parseRelativeDate(timeText);
        }

        const snippet = $el.find(".news-main, p.desc").text().trim();

        items.push({
          title,
          link,
          pubDate: publishedAt.toUTCString(),
          publishedAt,
          author: authorOrTag,
          contentSnippet: snippet || title,
          content: snippet || title,
        });
      });
    } catch (e: any) {
      console.warn(`界面新闻移动端精选抓取 [${url}] 异常:`, e.message);
    }
  }

  if (items.length === 0) {
    throw new Error("界面新闻商业与宏观移动端页面未能提取到任何文章");
  }

  return {
    title: "界面新闻 · 商业与宏观",
    description: "界面新闻商业与宏观资讯精选（高可用容灾流）",
    siteUrl: "https://www.jiemian.com",
    items,
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
