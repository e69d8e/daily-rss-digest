"use client";

import { useCallback } from "react";
import { TopicItem } from "@/types";
import { ArrowUpRight, BookOpen, Sparkles } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";

interface TopicSectionProps {
  topic: TopicItem;
  index: number;
  digestDate?: string;
  channelName?: string;
  onOpenArticle?: (article: {
    url: string;
    title?: string;
    sourceName?: string;
  }) => void;
}

export default function TopicSection({
  topic,
  index,
  digestDate,
  channelName,
  onOpenArticle,
}: TopicSectionProps) {
  const formatIndex = String(index + 1).padStart(2, "0");
  const primarySource = topic.sources?.[0];

  const renderSentiment = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success-soft px-2 py-0.5 rounded border border-success-border">
            <span
              className="w-1.5 h-1.5 rounded-full bg-success motion-safe:animate-pulse"
              aria-hidden="true"
            />
            <span>积极利好</span>
          </span>
        );
      case "critical":
      case "negative":
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger bg-danger-soft px-2 py-0.5 rounded border border-danger-border">
            <span
              className="w-1.5 h-1.5 rounded-full bg-danger motion-safe:animate-pulse"
              aria-hidden="true"
            />
            <span>警惕/风险</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 bg-subtle px-2 py-0.5 rounded border border-line">
            <span
              className="w-1.5 h-1.5 rounded-full bg-ink-muted"
              aria-hidden="true"
            />
            <span>客观观察</span>
          </span>
        );
    }
  };

  const getCopyText = useCallback(() => {
    const dateText = digestDate
      ? `【${digestDate} 智汇晨报】`
      : "【智汇晨报焦点】";
    const channelText = channelName ? ` [${channelName}]` : "";
    const sourcesText =
      topic.sources && topic.sources.length > 0
        ? `\n\n📌 参考来源：\n${topic.sources
            .map((s) => `• [${s.sourceName}] ${s.articleTitle} (${s.url})`)
            .join("\n")}`
        : "";
    return `${dateText}${channelText} ${topic.title}\n\n${topic.summary}${sourcesText}\n\n—— 由 Daily RSS Digest 每日智汇晨报聚类提炼`;
  }, [digestDate, channelName, topic]);

  return (
    <article
      className={`border-b border-line pb-8 last:border-b-0 space-y-3.5 transition-colors duration-200 ${
        // 仅对首屏折叠线以下的议题启用 content-visibility: auto
        index >= 2 ? "mwg-deferred" : ""
      }`}
    >
      {/* 序号、情感状态、标签与复制操作 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-ink-muted tracking-wider flex items-center gap-1">
            <span className="text-brand font-serif text-sm" aria-hidden="true">
              §
            </span>
            <span>{formatIndex}</span>
          </span>
          {renderSentiment(topic.sentiment)}
          {topic.impactScore && (
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted bg-subtle px-2 py-0.5 rounded border border-line">
              <Sparkles
                className="w-3 h-3 text-brand"
                aria-hidden="true"
              />
              <span>影响力 {topic.impactScore}/10</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {topic.tags && topic.tags.length > 0 && (
            <ul
              aria-label="议题标签"
              className="flex items-center gap-1.5 flex-wrap list-none p-0 m-0"
            >
              {topic.tags.map((tag) => (
                <li
                  key={tag}
                  className="text-xs text-ink-muted bg-subtle px-2 py-0.5 rounded border border-line font-sans"
                >
                  #{tag}
                </li>
              ))}
            </ul>
          )}

          <CopyButton
            getText={getCopyText}
            label="复制要点"
            copiedLabel="已复制"
            className="text-xs text-ink-muted hover:text-ink px-2 py-0.5 rounded hover:bg-subtle transition-colors"
            iconClassName="w-3 h-3"
          />
        </div>
      </div>

      {/* 议题标题：使用语义 <button> 承载交互，避免 clickable <h3> */}
      <h3 className="font-serif-title text-lg sm:text-xl lg:text-2xl font-bold text-ink leading-snug tracking-tight">
        {primarySource && onOpenArticle ? (
          <button
            type="button"
            onClick={() =>
              onOpenArticle({
                url: primarySource.url,
                title: primarySource.articleTitle,
                sourceName: primarySource.sourceName,
              })
            }
            className="text-start hover:text-brand transition-colors cursor-pointer group rounded-sm"
          >
            <span className="hover-underline-animation">{topic.title}</span>
          </button>
        ) : (
          <span>{topic.title}</span>
        )}
      </h3>

      {/* 深度提炼正文：避免两端对齐造成的空白河流，使用 text-wrap: pretty */}
      <p className="text-ink-2 leading-[1.8] sm:leading-[1.85] text-sm sm:text-[15px] font-sans text-start">
        {topic.summary}
      </p>

      {/* 原文溯源引用与直接阅读入口 */}
      {topic.sources && topic.sources.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between text-xs font-medium text-ink-muted mb-2 font-mono uppercase tracking-wider gap-2 flex-wrap">
            <span>参考源报道 · {topic.sources.length} 篇</span>
            {primarySource && onOpenArticle && (
              <button
                type="button"
                onClick={() =>
                  onOpenArticle({
                    url: primarySource.url,
                    title: primarySource.articleTitle,
                    sourceName: primarySource.sourceName,
                  })
                }
                className="inline-flex items-center gap-1 text-brand hover:text-brand-hover font-sans normal-case cursor-pointer transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                <span>应用内阅读详情</span>
              </button>
            )}
          </div>

          <ul className="space-y-1.5 list-none p-0 m-0">
            {topic.sources.map((src, i) => (
              <li
                key={`${src.url}-${i}`}
                className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-subtle hover:bg-muted-surface border border-line transition-colors group min-h-[38px]"
              >
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenArticle) {
                      onOpenArticle({
                        url: src.url,
                        title: src.articleTitle,
                        sourceName: src.sourceName,
                      });
                    } else {
                      window.open(src.url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className="flex items-baseline gap-2 text-start truncate flex-1 cursor-pointer min-w-0 py-0.5"
                >
                  <span className="font-semibold text-ink shrink-0 font-sans text-[11px] bg-muted-surface px-1.5 py-0.5 rounded border border-line">
                    {src.sourceName}
                  </span>
                  <span className="text-ink-2 group-hover:text-brand truncate">
                    {src.articleTitle}
                  </span>
                </button>

                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`在新窗口打开原网页：${src.articleTitle}`}
                  className="min-h-[28px] min-w-[28px] p-1 text-ink-muted hover:text-ink hover:bg-card rounded transition-colors shrink-0 inline-flex items-center justify-center"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
