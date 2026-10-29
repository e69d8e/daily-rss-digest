"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Calendar,
  RefreshCw,
  Rss,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Cpu,
  Sparkles,
  Newspaper,
  Compass,
  Code,
  Globe,
  Radio,
  ExternalLink,
  Copy,
} from "lucide-react";
import TtsPlayer from "./TtsPlayer";
import TopicSection from "./TopicSection";
import ArticleReaderModal from "./ArticleReaderModal";
import { TopicItem } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { isAnyModalOpen, isTopModal, popModal, pushModal } from "@/lib/modalStack";

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

// 频道图标映射
function renderChannelIcon(iconName: string, className: string = "w-3.5 h-3.5") {
  switch (iconName?.toLowerCase()) {
    case "cpu":
    case "ai":
    case "tech":
      return <Cpu className={className} />;
    case "sparkles":
    case "product":
    case "design":
      return <Sparkles className={className} />;
    case "trending-up":
    case "business":
    case "finance":
      return <TrendingUp className={className} />;
    case "code":
    case "dev":
      return <Code className={className} />;
    case "globe":
    case "world":
      return <Globe className={className} />;
    case "compass":
      return <Compass className={className} />;
    case "radio":
      return <Radio className={className} />;
    case "newspaper":
    default:
      return <Newspaper className={className} />;
  }
}

// 客户端内存缓存
const digestCache = new Map<string, DigestData | null>();
const historyCache = new Map<string, { date: string; title: string }[]>();
const articlesCache = new Map<string, any[]>();
const channelDateMap = new Map<string, string>();

export default function DigestReader() {
  const { toast } = useToast();
  const confirm = useConfirm();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  // 异步回调中判断"响应返回时用户是否已切换频道"，防止生成结果串台
  const selectedChannelRef = useRef<Channel | null>(null);
  const [currentDigest, setCurrentDigest] = useState<DigestData | null>(null);
  const [historyDates, setHistoryDates] = useState<{ date: string; title: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showRssModal, setShowRssModal] = useState(false);
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

  useEffect(() => {
    selectedChannelRef.current = selectedChannel;
  }, [selectedChannel]);

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

  // 2. 加载当前频道的简报、历史日期与候选文章（带缓存）
  useEffect(() => {
    if (!selectedChannel) return;

    let active = true;
    const chId = selectedChannel.id;
    const targetDate = selectedDate;
    const digestKey = `${chId}:${targetDate || "latest"}`;

    if (digestCache.has(digestKey)) {
      setCurrentDigest(digestCache.get(digestKey) ?? null);
      setErrorMsg("");
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

  // 日期选择处理函数
  const handleSelectDate = useCallback((newDate: string) => {
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
  }, [selectedChannel]);

  // 前后翻日
  const handlePrevDay = useCallback(() => {
    const prev = shiftDateString(currentDate, -1);
    handleSelectDate(prev);
  }, [currentDate, handleSelectDate]);

  const handleNextDay = useCallback(() => {
    if (isNextDisabled) return;
    const next = shiftDateString(currentDate, 1);
    handleSelectDate(next);
  }, [currentDate, isNextDisabled, handleSelectDate]);

  // 频道切换处理函数
  const handleSelectChannel = useCallback((channel: Channel) => {
    if (selectedChannel?.id === channel.id) return;

    if (selectedChannel) {
      channelDateMap.set(selectedChannel.id, currentDate);
    }

    const targetDate = channelDateMap.get(channel.id) || "";
    const digestKey = `${channel.id}:${targetDate || "latest"}`;

    if (digestCache.has(digestKey)) {
      setCurrentDigest(digestCache.get(digestKey) ?? null);
      setErrorMsg("");
      setLoading(false);
    } else {
      setCurrentDigest(null);
      setLoading(true);
    }

    if (historyCache.has(channel.id)) {
      setHistoryDates(historyCache.get(channel.id)!);
    }
    if (articlesCache.has(channel.id)) {
      setChannelArticles(articlesCache.get(channel.id)!);
    }

    setSelectedChannel(channel);
    setSelectedDate(targetDate);
  }, [selectedChannel, currentDate]);

  // 弹窗栈注册：历史 / RSS 弹窗打开时入栈，供全局快捷键协调
  useEffect(() => {
    if (showHistoryModal) pushModal("digest-history");
    return () => popModal("digest-history");
  }, [showHistoryModal]);

  useEffect(() => {
    if (showRssModal) pushModal("digest-rss");
    return () => popModal("digest-rss");
  }, [showRssModal]);

  // 键盘快捷键监听：← / → 翻日，1~9 切台，Esc 关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // 仅当自己的弹窗位于栈顶时关闭，避免把上层弹窗背后的内容一起关掉
        if (isTopModal("digest-history")) setShowHistoryModal(false);
        if (isTopModal("digest-rss")) setShowRssModal(false);
        return;
      }

      const target = e.target as HTMLElement;
      // 任意弹窗（含确认框、阅读器、帮助面板）打开时让路
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        isAnyModalOpen()
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevDay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextDay();
      } else if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (channels[idx]) {
          e.preventDefault();
          handleSelectChannel(channels[idx]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrevDay, handleNextDay, handleSelectChannel, channels]);

  // 立即触发抓取与生成
  const handleGenerate = async (force: boolean = false) => {
    if (!selectedChannel) return;

    // 如果今日晨报已存在，弹出确认以防误扣 AI Token
    if (currentDigest && !force) {
      const ok = await confirm({
        title: "重新抓取并生成晨报",
        content: `当前已存在 ${currentDate} 的提炼晨报。重新抓取将联网拉取所有源站最新报道并调用 AI 大模型重新聚类总结，确定继续吗？`,
        confirmText: "确认重新生成",
        cancelText: "取消",
        variant: "warning",
      });
      if (!ok) return;
    }

    const chId = selectedChannel.id;
    setGenerating(true);
    setErrorMsg("");
    setGenStep(1);

    // 动态步进状态展示
    const timer1 = setTimeout(() => setGenStep(2), 2500);
    const timer2 = setTimeout(() => setGenStep(3), 6000);
    const timer3 = setTimeout(() => setGenStep(4), 10000);

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
        if (res.status === 401) {
          throw new Error("生成晨报需要管理员权限，请先在设置页登录管理员");
        }
        let errorText = "生成失败";
        try {
          const err = await res.json();
          errorText = err.error || err.message || errorText;
        } catch {
          if (res.status === 502 || res.status === 504) {
            errorText =
              "云端请求超时 (502/504)。由于多源抓取及大模型提炼耗时较长，建议在设置中选用高吞吐高速模型。";
          } else {
            errorText = `请求处理异常 (${res.status})`;
          }
        }
        throw new Error(errorText);
      }

      const newDigest = await res.json();

      // 生成耗时较长，期间用户可能已切换频道：丢弃过期结果，避免旧频道晨报挂到新频道名下
      if (selectedChannelRef.current?.id !== chId) {
        toast.info(`已切换频道，${newDigest.date} 的晨报已生成入库，切回原频道即可查看`);
        return;
      }

      digestCache.set(`${chId}:${newDigest.date}`, newDigest);
      digestCache.set(`${chId}:latest`, newDigest);
      if (targetDate) {
        digestCache.set(`${chId}:${targetDate}`, newDigest);
      }
      channelDateMap.set(chId, newDigest.date);

      setSelectedDate(newDigest.date);
      setCurrentDigest(newDigest);
      toast.success(`${newDigest.date} 晨报提炼完成！`);

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
      toast.error(`生成晨报遇到问题: ${e.message}`);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setGenerating(false);
      setGenStep(0);
    }
  };

  const getRssUrl = () => {
    if (!selectedChannel) return "";
    const origin = typeof window !== "undefined" && window.location ? window.location.origin : "";
    return `${origin}/api/feed/${selectedChannel.slug}/rss.xml`;
  };

  const handleCopyRss = async () => {
    const url = getRssUrl();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      toast.success("已复制频道 RSS 聚合订阅源地址");
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-7">
      {/* 1. 频道切换区：带对应类别图标与激活高亮 */}
      <div className="space-y-3">
        <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 -mx-3 sm:mx-0 px-3 sm:px-0">
          {channels.map((ch, idx) => {
            const isSelected = selectedChannel?.id === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => handleSelectChannel(ch)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0 whitespace-nowrap shadow-2xs ${
                  isSelected
                    ? "bg-stone-900 text-white font-semibold ring-2 ring-stone-900/20"
                    : "bg-white text-stone-600 border border-[#eae6df] hover:border-stone-400 hover:text-stone-900"
                }`}
                title={`按数字键 ${idx + 1} 快速切换`}
              >
                <span className={isSelected ? "text-amber-400" : "text-stone-400"}>
                  {renderChannelIcon(ch.icon)}
                </span>
                <span>{ch.name}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${
                  isSelected ? "bg-stone-800 text-stone-300" : "bg-stone-100 text-stone-400"
                }`}>
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* 频道导语小幅横幅 */}
        {selectedChannel?.description && (
          <p className="text-center text-xs text-stone-500 max-w-xl mx-auto italic font-serif">
            “{selectedChannel.description}”
          </p>
        )}
      </div>

      {/* 2. 精致子工具条：自然日选择器 + 状态 + 动作 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs py-2.5 px-3 sm:px-4 rounded-xl bg-white/70 border border-[#eae6df] shadow-2xs">
        {/* 日期选择与往期前后切换 */}
        <div className="flex items-center justify-between sm:justify-start gap-1 sm:gap-2 text-stone-600 w-full sm:w-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer text-stone-600 hover:text-stone-900 transition-colors border border-transparent hover:border-stone-200"
              title={`前一天 (快捷键 ←)`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-1.5 font-mono font-medium text-stone-800 hover:text-amber-800 px-2.5 py-1 rounded-lg hover:bg-stone-100 cursor-pointer transition-colors border border-stone-200/60"
              title="选择日期与往期归档"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-800" />
              <span>{currentDate}</span>
              {isToday ? (
                <span className="text-[10px] font-sans bg-amber-100/70 text-amber-900 border border-amber-300/60 px-1.5 py-0.5 rounded font-medium">
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
              className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed text-stone-600 hover:text-stone-900 transition-colors border border-transparent hover:border-stone-200"
              title={isNextDisabled ? "已是最新日期 (今天)" : `后一天 (快捷键 →)`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {historyDates.length > 0 && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="text-[11px] text-stone-500 hover:text-stone-800 ml-1.5 underline underline-offset-2 cursor-pointer transition-colors font-mono"
              title="查看所有已生成的往期简报"
            >
              往期 ({historyDates.length})
            </button>
          )}
        </div>

        {/* 右侧动作：RSS 聚合弹窗 + 重新生成 */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          {/* RSS 聚合按钮 */}
          <button
            onClick={() => setShowRssModal(true)}
            className="flex items-center gap-1.5 text-stone-600 hover:text-stone-950 px-2.5 py-1 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 cursor-pointer transition-colors shadow-2xs font-medium text-xs"
            title="查看与复制频道聚合 RSS 订阅链接"
          >
            <Rss className="w-3.5 h-3.5 text-amber-700" />
            <span>订阅 RSS</span>
          </button>

          {/* 重新抓取按钮 */}
          <button
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shadow-2xs disabled:opacity-50 cursor-pointer ${
              currentDigest
                ? "bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                : "bg-stone-900 text-white hover:bg-amber-800"
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin text-amber-600" : ""}`} />
            <span>{generating ? "大模型提炼中..." : currentDigest ? "重新抓取提炼" : "立即抓取生成"}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50/90 border border-red-200 rounded-xl flex items-start gap-3 text-xs text-red-700 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <div className="space-y-1">
            <span className="font-bold">处理异常：</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* 3. 核心报刊文章主体 */}
      <main>
        {loading ? (
          <div className="py-24 text-center text-stone-400 bg-white rounded-2xl border border-[#eae6df] space-y-3">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-amber-800" />
            <div className="text-xs font-serif text-stone-500">正在整理排版晨报内容...</div>
          </div>
        ) : generating ? (
          /* 生成中的生动多阶段展示 */
          <div className="py-20 text-center bg-white rounded-2xl border border-[#eae6df] p-8 space-y-5 shadow-xs animate-in fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-700" />
            </div>

            <div className="space-y-1.5">
              <h3 className="font-serif-title text-base sm:text-lg font-bold text-stone-900">
                正在深度提炼 {selectedChannel?.name} ({currentDate})
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                聚合引擎正通过多源爬虫抓取最新动态，并调用 AI 引擎进行跨源聚类提炼。
              </p>
            </div>

            {/* 阶段步骤条 */}
            <div className="max-w-md mx-auto grid grid-cols-4 gap-2 pt-2 text-[11px] font-mono">
              <div className={`p-2 rounded-lg border transition-all ${genStep >= 1 ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold" : "bg-stone-50 border-stone-200 text-stone-400"}`}>
                ① 抓取报道
              </div>
              <div className={`p-2 rounded-lg border transition-all ${genStep >= 2 ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold" : "bg-stone-50 border-stone-200 text-stone-400"}`}>
                ② 语义聚类
              </div>
              <div className={`p-2 rounded-lg border transition-all ${genStep >= 3 ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold" : "bg-stone-50 border-stone-200 text-stone-400"}`}>
                ③ 大模型提炼
              </div>
              <div className={`p-2 rounded-lg border transition-all ${genStep >= 4 ? "bg-amber-50 border-amber-300 text-amber-900 font-semibold" : "bg-stone-50 border-stone-200 text-stone-400"}`}>
                ④ 播音文稿
              </div>
            </div>
          </div>
        ) : !currentDigest ? (
          /* 空状态：暂无晨报，提供直达生成与候选文章列表 */
          <div className="space-y-6">
            <div className="py-16 sm:py-20 text-center bg-white rounded-2xl border border-dashed border-[#eae6df] px-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center mx-auto">
                <Newspaper className="w-6 h-6 text-stone-400" />
              </div>

              <div className="space-y-1">
                <h3 className="font-serif-title text-lg sm:text-xl font-bold text-stone-800">
                  {selectedChannel?.name} · {currentDate} 暂无智能晨报
                </h3>
                <p className="text-stone-500 text-xs max-w-md mx-auto leading-relaxed">
                  当前日期尚未运行 AI 提炼生成结构化晨报。您可以点击下方按钮立即联网抓取并生成，或直接浏览下方收录的原始候选报道。
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-2 hover:scale-102"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                  <span>立即抓取并生成晨报 ({currentDate})</span>
                </button>
                {historyDates.length > 0 && (
                  <button
                    onClick={() => {
                      const latest = historyDates[0];
                      if (latest) handleSelectDate(latest.date);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white border border-[#eae6df] text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    查看最近一期 ({historyDates[0]?.date})
                  </button>
                )}
              </div>
            </div>

            {/* 数据库收录的候选报道 */}
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
          /* 已生成的晨报报刊排版 */
          <div className="bg-white rounded-2xl border border-[#eae6df] shadow-xs p-5 sm:p-8 lg:p-10 space-y-6 sm:space-y-8 transition-colors duration-200">
            {/* 报刊头部标题 */}
            <div className="border-b border-[#eae6df] pb-5 sm:pb-6 space-y-3">
              <div className="text-xs text-stone-400 font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-stone-700 font-sans">{selectedChannel?.name}</span>
                  <span>•</span>
                  <span>{currentDigest.date}</span>
                </span>
                <span>
                  分析 {currentDigest.articleCount} 篇多源报道 · 约 3 分钟阅读
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
            <section className="border-l-3 border-amber-800 pl-4 py-1.5 text-stone-800 font-serif text-sm sm:text-base leading-relaxed text-justify bg-stone-50/40 rounded-r-xl pr-3">
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
                    digestDate={currentDigest.date}
                    channelName={selectedChannel?.name}
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
                <section className="bg-stone-900 text-stone-100 rounded-2xl p-5 sm:p-7 space-y-3 shadow-md">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    <span>趋势研判与行业洞察</span>
                  </div>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-stone-300 font-sans leading-relaxed">
                    {currentDigest.sections.industryInsights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className="text-amber-400 font-bold text-sm leading-none mt-0.5">•</span>
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
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200/50">
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
                className="hover:text-stone-700 flex items-center gap-1 self-end sm:self-auto transition-colors"
                title="前往设置中心修改该频道规则"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>频道规则定制</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* 4. 往期历史归档与日期选择弹窗 */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#eae6df] max-w-md w-full p-6 shadow-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eae6df] mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Calendar className="w-4 h-4 text-amber-800" />
                <span>{selectedChannel?.name} · 往期晨报归档</span>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-xs text-stone-400 hover:text-stone-700 p-1 rounded cursor-pointer"
              >
                关闭
              </button>
            </div>

            {/* 日历直达与快捷跳转 */}
            <div className="mb-4 pb-4 border-b border-[#eae6df]/70 space-y-2.5">
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
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-[#eae6df] rounded-lg font-mono text-stone-800 focus:outline-none focus:border-stone-900 cursor-pointer"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <button
                  onClick={() => {
                    handleSelectDate(todayStr);
                    setShowHistoryModal(false);
                  }}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
                >
                  今日 ({todayStr})
                </button>
                <button
                  onClick={() => {
                    handleSelectDate(shiftDateString(todayStr, -1));
                    setShowHistoryModal(false);
                  }}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
                >
                  昨日 ({shiftDateString(todayStr, -1)})
                </button>
                <button
                  onClick={() => {
                    handleSelectDate(shiftDateString(todayStr, -2));
                    setShowHistoryModal(false);
                  }}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-mono cursor-pointer transition-colors"
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

            <div className="overflow-y-auto space-y-1.5 pr-1 flex-1 min-h-[140px]">
              {historyDates.length === 0 ? (
                <div className="text-center py-8 text-stone-400 text-xs">
                  暂无历史生成记录，选择日期后可点击抓取生成
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
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-between group cursor-pointer ${
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

      {/* 5. RSS 聚合订阅弹窗 */}
      {showRssModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowRssModal(false)}
        >
          <div
            className="bg-white rounded-2xl border border-[#eae6df] max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#eae6df]">
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Rss className="w-4 h-4 text-amber-700" />
                <span>订阅 {selectedChannel?.name} 聚合晨报</span>
              </div>
              <button
                onClick={() => setShowRssModal(false)}
                className="text-xs text-stone-400 hover:text-stone-700 p-1 cursor-pointer"
              >
                关闭
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              系统已为该频道输出符合 RSS 2.0 标准的聚合源。每天晨报提炼完成后将自动同步，支持使用主流阅读器反向订阅。
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-medium text-stone-500">
                聚合订阅链接：
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getRssUrl()}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-stone-50 border border-stone-300 rounded-lg text-stone-800 select-all"
                />
                <button
                  onClick={handleCopyRss}
                  className="px-3 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-amber-800 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>复制</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
              <a
                href={getRssUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-800 hover:underline flex items-center gap-1"
              >
                <span>在浏览器中直接打开 XML</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-stone-400 text-[11px]">兼容 Feedly / Follow / Reeder</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. 沉浸式文章详情阅读抽屉/弹窗 */}
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
