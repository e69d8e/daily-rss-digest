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

function getTodayDateStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateString(dateStr: string, days: number): string {
  if (!dateStr) return getTodayDateStr();
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return getTodayDateStr();
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, "0");
  const nextD = String(date.getDate()).padStart(2, "0");
  return `${nextY}-${nextM}-${nextD}`;
}

// 客户端内存缓存：用于频道间高速无感切换，避免重复发起网络请求与出现白屏/Loading动画闪烁
const digestCache = new Map<string, DigestData | null>();
const historyCache = new Map<string, { date: string; title: string }[]>();
const articlesCache = new Map<string, any[]>();
const channelDateMap = new Map<string, string>();

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
  const [channelArticles, setChannelArticles] = useState<any[]>([]);

  const todayStr = getTodayDateStr();
  const currentDate = selectedDate || currentDigest?.date || todayStr;
  const isToday = currentDate === todayStr;
  const isNextDisabled = currentDate >= todayStr;

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

  // 2. 加载当前频道的简报、历史日期与候选文章（带内存缓存与竞态控制）
  useEffect(() => {
    if (!selectedChannel) return;

    let active = true;
    const chId = selectedChannel.id;
    const targetDate = selectedDate;
    const digestKey = `${chId}:${targetDate || "latest"}`;

    // A. 简报内容：优先从内存缓存获取，避免重复请求和全屏加载闪烁
    if (digestCache.has(digestKey)) {
      setCurrentDigest(digestCache.get(digestKey) ?? null);
      setLoading(false);
    } else {
      setLoading(true);
      setErrorMsg("");

      const dateQuery = targetDate ? `&date=${targetDate}` : "";
      fetch(`/api/digests?channelId=${chId}${dateQuery}`)
        .then(async (res) => {
          if (!active) return;
          if (res.ok) {
            const data = await res.json();
            if (data && data.id) {
              digestCache.set(digestKey, data);
              if (data.date) {
                digestCache.set(`${chId}:${data.date}`, data);
                if (!channelDateMap.has(chId)) {
                  channelDateMap.set(chId, data.date);
                }
              }
              setCurrentDigest(data);
            } else {
              digestCache.set(digestKey, null);
              setCurrentDigest(null);
            }
          } else {
            digestCache.set(digestKey, null);
            setCurrentDigest(null);
          }
        })
        .catch((err) => {
          if (!active) return;
          console.error("加载简报异常:", err);
          setCurrentDigest(null);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    // B. 加载历史日期列表：已有缓存直接使用
    if (historyCache.has(chId)) {
      setHistoryDates(historyCache.get(chId)!);
    } else {
      fetch(`/api/digests?channelId=${chId}&listHistory=true`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          if (Array.isArray(data)) {
            historyCache.set(chId, data);
            setHistoryDates(data);
          }
        })
        .catch(console.error);
    }

    // C. 加载候选文章原料：已有缓存直接使用
    if (articlesCache.has(chId)) {
      setChannelArticles(articlesCache.get(chId)!);
    } else {
      fetch(`/api/articles?channelId=${chId}&limit=20`)
        .then((res) => res.json())
        .then((data) => {
          if (!active) return;
          if (Array.isArray(data)) {
            articlesCache.set(chId, data);
            setChannelArticles(data);
          }
        })
        .catch(console.error);
    }

    return () => {
      active = false;
    };
  }, [selectedChannel, selectedDate]);

  // 统一的日期选择与切换处理函数（优先命中缓存）
  const handleSelectDate = (newDate: string) => {
    if (!selectedChannel) return;
    channelDateMap.set(selectedChannel.id, newDate);

    const cacheKey = `${selectedChannel.id}:${newDate}`;
    if (digestCache.has(cacheKey)) {
      setCurrentDigest(digestCache.get(cacheKey) ?? null);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setSelectedDate(newDate);
  };

  // 频道切换处理函数：立即从缓存恢复，实现 0ms 瞬时切换且无需重复发起网络请求
  const handleSelectChannel = (channel: Channel) => {
    if (selectedChannel?.id === channel.id) return;

    // 记录离开前频道的当前日期
    if (selectedChannel) {
      channelDateMap.set(selectedChannel.id, currentDate);
    }

    // 查询目标频道历史阅读日期或默认最新
    const targetDate = channelDateMap.get(channel.id) || "";
    const digestKey = `${channel.id}:${targetDate || "latest"}`;

    // 1. 同步恢复 Digest 缓存（若命中直接渲染）
    if (digestCache.has(digestKey)) {
      setCurrentDigest(digestCache.get(digestKey) ?? null);
      setLoading(false);
    } else {
      setCurrentDigest(null);
      setLoading(true);
    }

    // 2. 同步恢复该频道的往期历史与候选文章
    if (historyCache.has(channel.id)) {
      setHistoryDates(historyCache.get(channel.id)!);
    }
    if (articlesCache.has(channel.id)) {
      setChannelArticles(articlesCache.get(channel.id)!);
    }

    setSelectedChannel(channel);
    setSelectedDate(targetDate);
  };

  // 3. 立即触发抓取与生成（强制刷新缓存）
  const handleGenerate = async () => {
    if (!selectedChannel) return;
    const chId = selectedChannel.id;
    setGenerating(true);
    setErrorMsg("");

    const targetDate = currentDate;

    try {
      const res = await fetch("/api/digests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: chId,
          date: targetDate,
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
      
      // 更新该频道对应日期的缓存
      digestCache.set(`${chId}:${newDigest.date}`, newDigest);
      digestCache.set(`${chId}:latest`, newDigest);
      if (targetDate) {
        digestCache.set(`${chId}:${targetDate}`, newDigest);
      }
      channelDateMap.set(chId, newDigest.date);

      setSelectedDate(newDigest.date);
      setCurrentDigest(newDigest);

      // 刷新历史列表并更新缓存
      historyCache.delete(chId);
      fetch(`/api/digests?channelId=${chId}&listHistory=true`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            historyCache.set(chId, data);
            setHistoryDates(data);
          }
        })
        .catch(console.error);

      // 刷新候选文章并更新缓存
      articlesCache.delete(chId);
      fetch(`/api/articles?channelId=${chId}&limit=20`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            articlesCache.set(chId, data);
            setChannelArticles(data);
          }
        })
        .catch(console.error);
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

  // 前后日期导航：按自然日切换，优先使用缓存
  const handlePrevDay = () => {
    const prev = shiftDateString(currentDate, -1);
    handleSelectDate(prev);
  };

  const handleNextDay = () => {
    if (isNextDisabled) return;
    const next = shiftDateString(currentDate, 1);
    handleSelectDate(next);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6">
      {/* 1. 频道切换：支持移动端水平顺滑手势滚动，桌面端自适应居中 */}
      <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 -mx-3 sm:mx-0 px-3 sm:px-0">
        {channels.map((ch) => {
          const isSelected = selectedChannel?.id === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => handleSelectChannel(ch)}
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
        <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 text-stone-600 w-full sm:w-auto">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <button
              onClick={handlePrevDay}
              className="p-1 sm:p-1.5 rounded hover:bg-stone-100 cursor-pointer text-stone-600 hover:text-stone-900 transition-colors"
              title={`前一天 (${shiftDateString(currentDate, -1)})`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 font-mono font-medium text-stone-800 hover:text-amber-800 px-2 py-1 rounded hover:bg-stone-100 cursor-pointer transition-colors"
              title="选择日期与往期归档"
            >
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              <span>{currentDate}</span>
              {isToday ? (
                <span className="text-[10px] font-sans bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 rounded font-normal">
                  今日
                </span>
              ) : (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectDate(todayStr);
                  }}
                  className="text-[10px] font-sans bg-stone-100 hover:bg-amber-100 hover:text-amber-900 text-stone-600 border border-stone-200 px-1.5 py-0.5 rounded transition-colors"
                  title="点击回到今日"
                >
                  回到今日
                </span>
              )}
            </button>

            <button
              onClick={handleNextDay}
              disabled={isNextDisabled}
              className="p-1 sm:p-1.5 rounded hover:bg-stone-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed text-stone-600 hover:text-stone-900 transition-colors"
              title={isNextDisabled ? "已是最新日期 (今天)" : `后一天 (${shiftDateString(currentDate, 1)})`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {historyDates.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-[11px] text-stone-500 hover:text-stone-800 ml-1 underline underline-offset-2 cursor-pointer transition-colors"
              title="查看所有已生成的往期简报"
            >
              往期归档 ({historyDates.length})
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
          <div className="space-y-6">
            <div className="py-16 sm:py-20 text-center bg-white rounded-2xl border border-dashed border-[#eae6df] px-6">
              <h3 className="font-serif-title text-lg sm:text-xl font-bold text-stone-800 mb-1.5">
                {selectedChannel?.name} · {currentDate} 暂无智能晨报
              </h3>
              <p className="text-stone-500 text-xs max-w-md mx-auto mb-6 leading-relaxed">
                当前日期尚未运行 AI 提炼生成结构化晨报。您可以点击下方按钮立即联网抓取并生成，或直接浏览下方数据库已收录的原始候选报道。
              </p>
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="px-5 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                  <span>{generating ? "大模型提炼晨报中..." : `立即抓取并生成 (${currentDate})`}</span>
                </button>
                {historyDates.length > 0 && (
                  <button
                    onClick={() => {
                      const latest = historyDates[0];
                      if (latest) handleSelectDate(latest.date);
                    }}
                    className="px-4 py-2 rounded-lg bg-white border border-[#eae6df] text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    查看已有简报 ({historyDates[0]?.date})
                  </button>
                )}
              </div>
            </div>

            {/* 数据库已收录的原始候选文章列表：直接呈现供用户查阅 */}
            {channelArticles.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#eae6df] p-5 sm:p-7 space-y-4">
                <div className="flex items-center justify-between border-b border-[#eae6df] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-serif-title text-sm sm:text-base font-bold text-stone-900">
                      数据库收录候选报道
                    </span>
                    <span className="text-[11px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-medium">
                      最新 {channelArticles.length} 篇
                    </span>
                  </div>
                  <span className="text-xs text-stone-400">点击可在应用内阅读</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {channelArticles.map((article) => (
                    <div
                      key={article.id}
                      onClick={() =>
                        setActiveArticle({
                          url: article.link,
                          title: article.title,
                          sourceName: article.feedSource?.title,
                        })
                      }
                      className="p-3.5 rounded-xl border border-[#eae6df]/80 hover:border-amber-700/40 hover:bg-amber-50/20 bg-stone-50/40 transition-all cursor-pointer group flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap text-[10px]">
                          <span className="bg-stone-200/80 text-stone-700 px-1.5 py-0.5 rounded font-medium">
                            {article.feedSource?.title || "来源站"}
                          </span>
                          <span className="text-stone-400 font-mono">
                            {new Date(article.publishedAt).toLocaleString("zh-CN", {
                              month: "numeric",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-medium text-stone-900 group-hover:text-amber-900 transition-colors leading-snug">
                          {article.title}
                        </h4>
                        {article.summarySnippet && (
                          <p className="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                            {article.summarySnippet}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

      {/* 4. 往期历史归档与日期选择弹窗 */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#eae6df] max-w-md w-full p-6 shadow-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eae6df] mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Calendar className="w-4 h-4 text-amber-800" />
                <span>{selectedChannel?.name} · 日期选择与往期归档</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                关闭
              </button>
            </div>

            {/* 日历直达与快捷跳转 */}
            <div className="mb-4 pb-4 border-b border-[#eae6df]/70 space-y-2">
              <div className="text-xs font-medium text-stone-600 flex items-center justify-between">
                <span>直达指定日期</span>
                <span className="text-[11px] text-stone-400">选择任意历史日期查看</span>
              </div>
              <input
                type="date"
                max={todayStr}
                value={currentDate}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSelectDate(e.target.value);
                    setShowHistoryModal(false);
                  }
                }}
                className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-[#eae6df] rounded-lg font-mono text-stone-800 focus:outline-none focus:border-stone-900 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <button
                  onClick={() => {
                    handleSelectDate(todayStr);
                    setShowHistoryModal(false);
                  }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-mono cursor-pointer transition-colors"
                >
                  今日 ({todayStr})
                </button>
                <button
                  onClick={() => {
                    handleSelectDate(shiftDateString(todayStr, -1));
                    setShowHistoryModal(false);
                  }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-mono cursor-pointer transition-colors"
                >
                  昨日 ({shiftDateString(todayStr, -1)})
                </button>
                <button
                  onClick={() => {
                    handleSelectDate(shiftDateString(todayStr, -2));
                    setShowHistoryModal(false);
                  }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded text-[11px] font-mono cursor-pointer transition-colors"
                >
                  前日 ({shiftDateString(todayStr, -2)})
                </button>
              </div>
            </div>

            {/* 已生成简报的历史列表 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-800">
                已生成晨报历史 ({historyDates.length})
              </span>
            </div>

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 min-h-[120px]">
              {historyDates.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  暂无历史生成记录，选择日期后可点击生成
                </div>
              ) : (
                historyDates.map((item) => {
                  const isCurrent = currentDate === item.date;
                  return (
                    <button
                      key={item.date}
                      onClick={() => {
                        handleSelectDate(item.date);
                        setShowHistoryModal(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors flex items-center justify-between group cursor-pointer ${
                        isCurrent
                          ? "bg-stone-900 text-white font-medium shadow-2xs"
                          : "hover:bg-stone-100 text-stone-700 border border-transparent hover:border-[#eae6df]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-mono shrink-0">{item.date}</span>
                        <span className="truncate opacity-80">{item.title}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                    </button>
                  );
                })
              )}
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
