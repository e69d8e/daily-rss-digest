import { XMLParser, XMLBuilder } from "fast-xml-parser";

export interface OpmlOutlineItem {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  category?: string;
}

export function parseOpml(xmlContent: string): OpmlOutlineItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xmlContent);
  const results: OpmlOutlineItem[] = [];

  const body = parsed?.opml?.body;
  if (!body) return results;

  function traverse(node: any, currentCategory = "") {
    if (!node) return;
    const outlines = Array.isArray(node.outline)
      ? node.outline
      : node.outline
      ? [node.outline]
      : [];

    for (const item of outlines) {
      const xmlUrl = item["@_xmlUrl"] || item["@_xmlurl"];
      const title =
        item["@_title"] || item["@_text"] || item["@_description"] || "未命名源";
      const htmlUrl = item["@_htmlUrl"] || item["@_htmlurl"];

      if (xmlUrl) {
        results.push({
          title,
          xmlUrl,
          htmlUrl,
          category: currentCategory || undefined,
        });
      }

      // Check for nested children
      if (item.outline) {
        traverse(item, title);
      }
    }
  }

  traverse(body);
  return results;
}

export function generateOpml(
  channels: {
    name: string;
    sources: { title: string; url: string; siteUrl?: string | null }[];
  }[]
): string {
  const outlines = channels.map((ch) => ({
    "@_text": ch.name,
    "@_title": ch.name,
    outline: ch.sources.map((s) => ({
      "@_type": "rss",
      "@_text": s.title,
      "@_title": s.title,
      "@_xmlUrl": s.url,
      ...(s.siteUrl ? { "@_htmlUrl": s.siteUrl } : {}),
    })),
  }));

  const opmlObj = {
    "?xml": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
    opml: {
      "@_version": "2.0",
      head: {
        title: "Daily RSS Digest Export",
        dateCreated: new Date().toUTCString(),
      },
      body: {
        outline: outlines,
      },
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true,
  });

  return builder.build(opmlObj);
}
