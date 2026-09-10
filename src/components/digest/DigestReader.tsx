"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Calendar,
  RefreshCw,
  Rss,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import TtsPlayer from "./TtsPlayer";
import TopicSection from "./TopicSection";
import ArticleReaderModal from "./ArticleReaderModal";
import { TopicItem } from "@/types";

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sources?: any[];
}

interface DigestData {
  id: string;
  channelId: string;
  date: string;
  title: string;
  overview: string;
  sections: {
    topics: TopicItem[];
    industryInsights?: string[];
  };
  audioText: string;
  articleCount: number;
  channel: Channel;
  deliveryLogs?: {
    id: string;
    targetType: string;
    targetDestination: string;
    status: string;
    sentAt: string;
  }[];
}

export default function DigestReader() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [currentDigest, setCurrentDigest] = useState<DigestData | null>(null);
  const [historyDates, setHistoryDates] = useState<{ date: string; title: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedRss, setCopiedRss] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [activeArticle, setActiveArticle] = useState<{
    url: string;
    title?: string;
    sourceName?: string;
  } | null>(null);

  // 1. 加载频道列表
  useEffect(() => {
    fetch("/api/channels")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setChannels(data);
          setSelectedChannel(data[0]);
        }
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  // 2. 加载当前频道的简报与历史日期
  useEffect(() => {
    if (!selectedChannel) return;

    setLoading(true);
    setErrorMsg("");

    const dateQuery = selectedDate ? `&date=${selectedDate}` : "";
    fetch(`/api/digests?channelId=${selectedChannel.id}${dateQuery}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            setCurrentDigest(data);
            if (!selectedDate && data.date) {
              setSelectedDate(data.date);
            }
          } else {
            setCurrentDigest(null);
          }
        } else {
          setCurrentDigest(null);
        }
      })
      .catch((err) => {
        console.error(err);
        setCurrentDigest(null);
      })
      .finally(() => setLoading(false));

    // 加载历史日期列表
    fetch(`/api/digests?channelId=${selectedChannel.id}&listHistory=true`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistoryDates(data);
        }
      })
      .catch(console.error);
  }, [selectedChannel, selectedDate]);

  // 3. 立即触发抓取与生成
  const handleGenerate = async () => {
    if (!selectedChannel) return;
    setGenerating(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/digests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: selectedChannel.id,
          date: new Date().toISOString().split("T")[0],
        }),
      });

      if (!res.ok) {
        let errorText = "生成失败";
        try {
          const err = await res.json();
          errorText = err.error || err.message || errorText;
        } catch {
          if (res.status === 502 || res.status === 504) {
            errorText =
              "云端请求超时 (502/504)。由于多源抓取及大模型提炼耗时较长，建议在设置中选用高吞吐高速模型或在本地/GitHub Action中按需触发。";
          } else {
            errorText = `请求处理异常 (${res.status})`;
          }
        }
        throw new Error(errorText);
      }

      const newDigest = await res.json();
      setSelectedDate(newDigest.date);
      const reloadRes = await fetch(
        `/api/digests?channelId=${selectedChannel.id}&date=${newDigest.date}`
      );
      if (reloadRes.ok) {
        setCurrentDigest(await reloadRes.json());
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyRssUrl = async () => {
    if (!selectedChannel) return;
    try {
      const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
      const url = `${origin}/api/feed/${selectedChannel.slug}/rss.xml`;
      
      if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== "undefined") {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setCopiedRss(true);
      setTimeout(() => setCopiedRss(false), 2500);
    } catch (e) {
      console.warn("复制 RSS 链接失败:", e);
    }
  };

  // 前后日期导航
  const currentHistoryIndex = Array.isArray(historyDates)
    ? historyDates.findIndex(
        (h) => h.date === (currentDigest?.date || selectedDate)
      )
    : -1;

  const handlePrevDay = () => {
    if (currentHistoryIndex < historyDates.length - 1) {
      setSelectedDate(historyDates[currentHistoryIndex + 1].date);
    }
  };

  const handleNextDay = () => {
    if (currentHistoryIndex > 0) {
      setSelectedDate(historyDates[currentHistoryIndex - 1].date);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isToday = (currentDigest?.date || selectedDate) === todayStr;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* 1. 频道切换：支持移动端水平顺滑手势滚动，桌面端自适应居中 */}
      <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 -mx-3 sm:mx-0 px-3 sm:px-0">
        {channels.map((ch) => {
          const isSelected = selectedChannel?.id === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => {
                setSelectedChannel(ch);
                setSelectedDate("");
              }}
              className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                isSelected
                  ? "bg-stone-900 text-white shadow-2xs"
                  : "bg-white text-stone-600 border border-[#eae6df] hover:border-stone-400 hover:text-stone-900"
              }`}
            >
              {ch.name}
            </button>
          );
        })}
      </div>

      {/* 2. 微型工具条：日期切换 + 操作按钮（移动端自适应分栏） */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs py-2 sm:py-2.5 border-y border-[#eae6df]/70">
        {/* 日期选择与往期前后切换 */}
        <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-1.5 text-stone-600 w-full sm:w-auto">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={handlePrevDay}
              disabled={currentHistoryIndex >= historyDates.length - 1}
              className="p-1 sm:p-1.5 rounded hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
              title="查看前一期"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1 font-mono font-medium text-stone-800 hover:text-amber-800 px-1.5 py-0.5 rounded hover:bg-stone-100 cursor-pointer"
              title="选择往期归档"
            >
              <span>{currentDigest?.date || selectedDate || todayStr}</span>
              {isToday && (
                <span className="text-[10px] font-sans bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 rounded">
                  今日
                </span>
              )}
            </button>

            <button
              onClick={handleNextDay}
              disabled={currentHistoryIndex <= 0}
              className="p-1 sm:p-1.5 rounded hover:bg-stone-100 disabled:opacity-30 cursor-pointer"
              title="查看后一期"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {historyDates.length > 1 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-[11px] text-stone-400 hover:text-stone-700 ml-1 underline underline-offset-2 cursor-pointer"
            >
              往期 ({historyDates.length})
            </button>
          )}
        </div>

        {/* 右侧动作：重新生成与 RSS 链接 */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          <button
            onClick={copyRssUrl}
            className="flex items-center gap-1 text-stone-500 hover:text-stone-900 px-2 sm:px-2.5 py-1 rounded hover:bg-stone-100 cursor-pointer"
            title="复制频道聚合 RSS 订阅链接"
          >
            {copiedRss ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">已复制</span>
              </>
            ) : (
              <>
                <Rss className="w-3 h-3 text-stone-400" />
                <span>RSS</span>
              </>
            )}
          </button>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-stone-900 text-white text-xs font-medium hover:bg-amber-800 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3 h-3 ${generating ? "animate-spin" : ""}`}
            />
            <span>{generating ? "提炼中..." : "重新抓取"}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div>
            <span className="font-semibold">处理异常：</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* 3. 核心报刊文章主体（居中沉浸式排版） */}
      <main>
        {loading ? (
          <div className="py-24 text-center text-stone-400 bg-white rounded-2xl border border-[#eae6df]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-300" />
            <div className="text-xs">正在整理排版晨报内容...</div>
          </div>
        ) : !currentDigest ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-[#eae6df] px-6">
            <h3 className="font-serif-title text-lg font-bold text-stone-800 mb-1">
              {selectedChannel?.name} 该日期暂无简报
            </h3>
            <p className="text-stone-500 text-xs max-w-sm mx-auto mb-5">
              点击下方按钮，系统将立即连接各源站抓取最新文章并生成今日提炼晨报。
            </p>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer"
            >
              {generating ? "生成中..." : "立即抓取并生成"}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl sm:rounded-2xl border border-[#eae6df] shadow-xs p-4 sm:p-8 lg:p-10 space-y-6 sm:space-y-8">
            {/* 报刊头部标题 */}
            <div className="border-b border-[#eae6df] pb-5 sm:pb-6 space-y-2">
              <div className="text-xs text-stone-400 font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>{currentDigest.date}</span>
                <span>
                  阅读约 3 分钟 · 分析 {currentDigest.articleCount} 篇多源报道
                </span>
              </div>

              <h1 className="font-serif-title text-xl sm:text-2xl lg:text-3xl font-bold text-stone-950 tracking-tight leading-snug">
                {currentDigest.title}
              </h1>
            </div>

            {/* 语音晨报播放组件 */}
            {currentDigest.audioText && (
              <TtsPlayer
                audioText={currentDigest.audioText}
                title={currentDigest.title}
              />
            )}

            {/* 核心导读（TL;DR 优雅引文体） */}
            <section className="border-l-2 border-stone-900 pl-3.5 sm:pl-4 py-1 text-stone-800 font-serif text-sm sm:text-base leading-relaxed text-justify">
              {currentDigest.overview}
            </section>

            {/* 焦点议题列表 */}
            <section className="space-y-8 pt-2">
              {currentDigest.sections?.topics && currentDigest.sections.topics.length > 0 ? (
                currentDigest.sections.topics.map((topic, idx) => (
                  <TopicSection
                    key={topic.id || idx}
                    topic={topic}
                    index={idx}
                    onOpenArticle={setActiveArticle}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-xs text-stone-400 bg-stone-50/50 rounded-xl border border-dashed border-[#eae6df]">
                  本期晨报暂无结构化焦点议题
                </div>
              )}
            </section>

            {/* 综合趋势研判与行业洞察 */}
            {currentDigest.sections?.industryInsights &&
              currentDigest.sections.industryInsights.length > 0 && (
                <section className="bg-stone-900 text-stone-100 rounded-xl p-5 sm:p-6 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-mono font-semibold uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>趋势研判与行业洞察</span>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-stone-300 font-sans leading-relaxed">
                    {currentDigest.sections.industryInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

            {/* 报纸尾部小注：源归属与配置入口 */}
            <div className="pt-6 border-t border-[#eae6df] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-400">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  本期收录源：{selectedChannel?.sources?.length || 0} 个站点
                </span>
                {currentDigest.deliveryLogs &&
                  currentDigest.deliveryLogs.length > 0 && (
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                      已推送到{" "}
                      {currentDigest.deliveryLogs
                        .map((l) => (l.targetType || "").replace("WEBHOOK_", ""))
                        .filter(Boolean)
                        .join(" / ")}
                    </span>
                  )}
              </div>

              <Link
                href="/settings?tab=channels"
                className="hover:text-stone-700 flex items-center gap-1 self-end sm:self-auto"
                title="前往设置中心修改该频道规则"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>频道规则设置</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* 4. 往期历史归档弹窗（按需查看，不占用横向版面） */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eae6df] max-w-md w-full p-6 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#eae6df] mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Calendar className="w-4 h-4 text-amber-800" />
                <span>{selectedChannel?.name} · 往期晨报历史</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                关闭
              </button>
            </div>

            <div className="overflow-y-auto space-y-1 pr-1 flex-1">
              {historyDates.map((item) => {
                const isCurrent =
                  (currentDigest?.date || selectedDate) === item.date;
                return (
                  <button
                    key={item.date}
                    onClick={() => {
                      setSelectedDate(item.date);
                      setShowHistoryModal(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between group cursor-pointer ${
                      isCurrent
                        ? "bg-stone-900 text-white font-medium"
                        : "hover:bg-stone-100 text-stone-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono">{item.date}</span>
                      <span className="truncate opacity-80">{item.title}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 5. 沉浸式文章详情阅读抽屉/弹窗 */}
      {activeArticle && (
        <ArticleReaderModal
          url={activeArticle.url}
          initialTitle={activeArticle.title}
          initialSourceName={activeArticle.sourceName}
          onClose={() => setActiveArticle(null)}
        />
      )}
    </div>
  );
}
