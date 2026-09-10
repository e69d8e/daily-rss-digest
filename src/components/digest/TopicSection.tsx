"use client";

import { TopicItem } from "@/types";
import { ArrowUpRight, BookOpen } from "lucide-react";

interface TopicSectionProps {
  topic: TopicItem;
  index: number;
  onOpenArticle?: (article: {
    url: string;
    title?: string;
    sourceName?: string;
  }) => void;
}

export default function TopicSection({
  topic,
  index,
  onOpenArticle,
}: TopicSectionProps) {
  const formatIndex = String(index + 1).padStart(2, "0");

  const renderSentiment = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            积极利好
          </span>
        );
      case "critical":
      case "negative":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            警惕/风险
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
            客观观察
          </span>
        );
    }
  };

  const primarySource = topic.sources && topic.sources[0];

  return (
    <article className="border-b border-[#eae6df] pb-8 last:border-b-0 space-y-3.5">
      {/* 序号与状态 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-stone-400 tracking-wider">
            § {formatIndex}
          </span>
          {renderSentiment(topic.sentiment)}
          {topic.impactScore && (
            <span className="text-[11px] font-mono text-stone-400">
              影响力 {topic.impactScore}/10
            </span>
          )}
        </div>

        {topic.tags && topic.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {topic.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-stone-500 bg-stone-100/80 px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 议题标题 */}
      <h3
        onClick={() => {
          if (primarySource && onOpenArticle) {
            onOpenArticle({
              url: primarySource.url,
              title: primarySource.articleTitle,
              sourceName: primarySource.sourceName,
            });
          }
        }}
        className={`font-serif-title text-lg sm:text-xl lg:text-2xl font-bold text-stone-900 leading-snug tracking-tight transition-colors ${
          primarySource && onOpenArticle
            ? "cursor-pointer hover:text-amber-900"
            : ""
        }`}
      >
        {topic.title}
      </h3>

      {/* 深度提炼正文 */}
      <p className="text-stone-700 leading-[1.75] sm:leading-[1.8] text-sm sm:text-[15px] font-sans text-justify">
        {topic.summary}
      </p>

      {/* 原文溯源引用与直接阅读入口 */}
      {topic.sources && topic.sources.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-stone-400 mb-2 font-mono uppercase tracking-wider">
            <span>参考源报道 · {topic.sources.length} 篇</span>
            {primarySource && onOpenArticle && (
              <button
                onClick={() =>
                  onOpenArticle({
                    url: primarySource.url,
                    title: primarySource.articleTitle,
                    sourceName: primarySource.sourceName,
                  })
                }
                className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-950 font-sans normal-case cursor-pointer transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>应用内阅读详情</span>
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {topic.sources.map((src, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded-lg bg-stone-50/60 hover:bg-stone-100/80 border border-stone-200/50 transition-colors group min-h-[36px]"
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
                      window.open(src.url, "_blank");
                    }
                  }}
                  className="flex items-baseline gap-2 text-left truncate flex-1 cursor-pointer"
                  title="在应用内阅读详情"
                >
                  <span className="font-medium text-stone-900 shrink-0 font-sans">
                    [{src.sourceName}]
                  </span>
                  <span className="text-stone-600 group-hover:text-amber-900 truncate">
                    {src.articleTitle}
                  </span>
                </button>

                {/* 独立外链直达图标 */}
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 text-stone-400 hover:text-stone-800 hover:bg-stone-200/60 rounded transition-colors shrink-0 cursor-pointer"
                  title="在新窗口打开源网页"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
