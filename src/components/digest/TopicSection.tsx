"use client";

import { useState } from "react";
import { TopicItem } from "@/types";
import { ArrowUpRight, BookOpen, Copy, Check, Sparkles, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

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
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const formatIndex = String(index + 1).padStart(2, "0");

  const renderSentiment = (sentiment?: string) => {
    switch (sentiment) {
      case "positive":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            积极利好
          </span>
        );
      case "critical":
      case "negative":
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            警惕/风险
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
            客观观察
          </span>
        );
    }
  };

  const primarySource = topic.sources && topic.sources[0];

  const handleCopyTopic = async () => {
    try {
      const dateText = digestDate ? `【${digestDate} 智汇晨报】` : "【智汇晨报焦点】";
      const channelText = channelName ? ` [${channelName}]` : "";
      const sourcesText = topic.sources && topic.sources.length > 0
        ? `\n\n📌 参考来源：\n${topic.sources.map((s) => `• [${s.sourceName}] ${s.articleTitle} (${s.url})`).join("\n")}`
        : "";

      const text = `${dateText}${channelText} ${topic.title}\n\n${topic.summary}${sourcesText}\n\n—— 由 Daily RSS Digest 每日智汇晨报聚类提炼`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      setCopied(true);
      toast.success("已复制焦点议题与参考来源至剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("复制失败:", e);
      toast.error("复制失败，请手动选择复制");
    }
  };

  return (
    <article className="border-b border-[#eae6df] pb-8 last:border-b-0 space-y-3.5 transition-colors duration-200">
      {/* 序号与状态 */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-stone-400 tracking-wider flex items-center gap-1">
            <span className="text-amber-800 font-serif text-sm">§</span>
            <span>{formatIndex}</span>
          </span>
          {renderSentiment(topic.sentiment)}
          {topic.impactScore && (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-stone-500 bg-stone-100/60 px-2 py-0.5 rounded border border-stone-200/40">
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>影响力 {topic.impactScore}/10</span>
            </div>
          )}
        </div>

        {/* 标签与一键复制操作 */}
        <div className="flex items-center gap-2 flex-wrap">
          {topic.tags && topic.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {topic.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] text-stone-500 bg-stone-100/80 px-2 py-0.5 rounded border border-stone-200/40 font-sans"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleCopyTopic}
            className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-800 px-2 py-0.5 rounded hover:bg-stone-100 transition-colors cursor-pointer"
            title="复制该议题摘要与来源"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>复制要点</span>
              </>
            )}
          </button>
        </div>
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
            ? "cursor-pointer hover:text-amber-900 group"
            : ""
        }`}
      >
        <span className="hover-underline-animation">{topic.title}</span>
      </h3>

      {/* 深度提炼正文 */}
      <p className="text-stone-700 leading-[1.8] sm:leading-[1.85] text-sm sm:text-[15px] font-sans text-justify">
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
                  <span className="font-semibold text-stone-900 shrink-0 font-sans text-[11px] bg-stone-200/70 px-1.5 py-0.5 rounded">
                    {src.sourceName}
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
