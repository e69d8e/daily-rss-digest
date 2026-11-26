"use client";

import { useState, useEffect, useCallback, useRef, useId } from "react";
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
  X,
} from "lucide-react";
import TtsPlayer from "./TtsPlayer";
import TopicSection from "./TopicSection";
import ArticleReaderModal from "./ArticleReaderModal";
import ModalDialog from "@/components/ui/ModalDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CopyButton from "@/components/ui/CopyButton";
import ScrollFadeContainer from "@/components/ui/ScrollFadeContainer";
import { TopicItem } from "@/types";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { isAnyModalOpen } from "@/lib/modalStack";

interface Channel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  sources?: unknown[];
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

interface CandidateArticle {
  id: string;
  link: string;
  title: string;
  publishedAt: string;
  summarySnippet?: string | null;
  feedSource?: { title?: string | null } | null;
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

function renderChannelIcon(iconName: string, className: string = "w-3.5 h-3.5") {
  switch (iconName?.toLowerCase()) {
    case "cpu":
    case "ai":
    case "tech":
      return <Cpu className={className} aria-hidden="true" />;
    case "sparkles":
    case "product":
    case "design":
      return <Sparkles className={className} aria-hidden="true" />;
    case "trending-up":
    case "business":
    case "finance":
      return <TrendingUp className={className} aria-hidden="true" />;
    case "code":
    case "dev":
      return <Code className={className} aria-hidden="true" />;
    case "globe":
    case "world":
      return <Globe className={className} aria-hidden="true" />;
    case "compass":
      return <Compass className={className} aria-hidden="true" />;
    case "radio":
      return <Radio className={className} aria-hidden="true" />;
    case "newspaper":
    default:
      return <Newspaper className={className} aria-hidden="true" />;
  }
}

// 客户端内存缓存
const digestCache = new Map<string, DigestData | null>();
const historyCache = new Map<string, { date: string; title: string }[]>();
const articlesCache = new Map<string, CandidateArticle[]>();
const channelDateMap = new Map<string, string>();

export default function DigestReader() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const historyTitleId = useId();
  const historyDateInputId = useId();
  const rssTitleId = useId();
  const rssInputId = useId();
  const channelTablistRef = useRef<HTMLDivElement>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const selectedChannelRef = useRef<Channel | null>(null);
  const [currentDigest, setCurrentDigest] = useState<DigestData | null>(null);
  const [historyDates, setHistoryDates] = useState<
    { date: string; title: string }[]
  >([]);
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
  const [channelArticles, setChannelArticles] = useState<CandidateArticle[]>(
    []
  );

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

  // 选中频道变化时将其滚动至可视区域内（不滚主页面）
  useEffect(() => {
    if (!selectedChannel || !channelTablistRef.current) return;
    const activeTab = channelTablistRef.current.querySelector<HTMLElement>(
      '[aria-selected="true"]'
    );
    activeTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedChannel]);

  const handleSelectDate = useCallback(
    (newDate: string) => {
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
    },
    [selectedChannel]
  );

  const handlePrevDay = useCallback(() => {
    const prev = shiftDateString(currentDate, -1);
    handleSelectDate(prev);
  }, [currentDate, handleSelectDate]);

  const handleNextDay = useCallback(() => {
    if (isNextDisabled) return;
    const next = shiftDateString(currentDate, 1);
    handleSelectDate(next);
  }, [currentDate, isNextDisabled, handleSelectDate]);

  const handleSelectChannel = useCallback(
    (channel: Channel) => {
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
    },
    [selectedChannel, currentDate]
  );

  // 键盘快捷键监听：← / → 翻日，1~9 切台（Esc 由原生 <dialog> 自动接管）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable ||
        isAnyModalOpen()
      ) {
        return;
      }

      // 若焦点位于频道 tablist 内，左右方向键交给 tablist 漫游焦点
      if (channelTablistRef.current?.contains(target)) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

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

  // Tablist 方向键导航回退（focusgroup 尚未加载或手动导航时生效，采用按回车/点击激活以避免切台触发请求风暴）
  const handleChannelTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    if (channels.length === 0) return;
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % channels.length;
    else if (e.key === "ArrowLeft")
      nextIdx = (idx - 1 + channels.length) % channels.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = channels.length - 1;

    if (nextIdx !== null) {
      e.preventDefault();
      const targetTab =
        channelTablistRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="tab"]'
        )[nextIdx];
      targetTab?.focus();
    }
  };

  // 立即触发抓取与生成
  const handleGenerate = async (force: boolean = false) => {
    if (!selectedChannel) return;

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

      if (selectedChannelRef.current?.id !== chId) {
        toast.info(
          `已切换频道，${newDigest.date} 的晨报已生成入库，切回原频道即可查看`
        );
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成异常";
      setErrorMsg(msg);
      toast.error(`生成晨报遇到问题: ${msg}`);
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
    const origin =
      typeof window !== "undefined" && window.location
        ? window.location.origin
        : "";
    return `${origin}/api/feed/${selectedChannel.slug}/rss.xml`;
  };

  const focusgroupAttrs = {
    focusgroup: "tablist nomemory",
  } as Record<string, string>;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-6 sm:space-y-7">
      {/* 1. 频道切换区：focusgroup tablist + 渐隐边缘滚动提示 */}
      <div className="space-y-3">
        <ScrollFadeContainer
          containerRef={channelTablistRef}
          itemCount={channels.length}
          role="tablist"
          aria-label="新闻频道"
          {...focusgroupAttrs}
          className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2.5 scroll-smooth py-1.5 -mx-3 sm:mx-0 px-3 sm:px-1"
        >
          {channels.map((ch, idx) => {
            const isSelected = selectedChannel?.id === ch.id;
            const startAttr = isSelected
              ? ({ focusgroupstart: "" } as Record<string, string>)
              : {};
            return (
              <button
                key={ch.id}
                id={`channel-tab-${ch.id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                {...startAttr}
                onClick={() => handleSelectChannel(ch)}
                onKeyDown={(e) => handleChannelTabKeyDown(e, idx)}
                title={`按数字键 ${idx + 1} 快速切换`}
                className={`min-h-[36px] flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs scroll-snap-align-start border ${
                  isSelected
                    ? "bg-action text-action-fg border-action ring-2 ring-brand/25"
                    : "bg-card text-ink-2 border-line hover:border-line-strong hover:text-ink"
                }`}
              >
                <span className={isSelected ? "text-amber-400" : "text-ink-muted"}>
                  {renderChannelIcon(ch.icon)}
                </span>
                <span>{ch.name}</span>
                <span
                  aria-hidden="true"
                  className={`text-[11px] font-mono px-1 rounded ${
                    isSelected
                      ? "bg-white/15 text-action-fg/90"
                      : "bg-subtle text-ink-muted"
                  }`}
                >
                  {idx + 1}
                </span>
              </button>
            );
          })}
        </ScrollFadeContainer>

        {selectedChannel?.description && (
          <p className="text-center text-xs text-ink-muted max-w-xl mx-auto italic font-serif">
            “{selectedChannel.description}”
          </p>
        )}
      </div>

      {/* 2. 工具条：自然日选择器 + 状态 + 动作（已修复按钮嵌套按钮缺陷） */}
      <div
        role="toolbar"
        aria-label="晨报日期与操作工具栏"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs py-2.5 px-3 sm:px-4 rounded-xl bg-card border border-line shadow-2xs"
      >
        {/* 日期选择与往期前后切换 */}
        <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 text-ink-2 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="查看前一天晨报"
              title="前一天 (快捷键 ←)"
              className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg hover:bg-subtle cursor-pointer text-ink-2 hover:text-ink transition-colors border border-transparent hover:border-line inline-flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              aria-label={`选择日期或查看往期归档，当前日期 ${currentDate}`}
              className="min-h-[32px] flex items-center gap-1.5 font-mono font-medium text-ink hover:text-brand px-2.5 py-1 rounded-lg hover:bg-subtle cursor-pointer transition-colors border border-line"
            >
              <Calendar className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
              <span>{currentDate}</span>
              {isToday && (
                <span className="text-[11px] font-sans bg-brand-soft text-brand-ink border border-brand-border px-1.5 py-0.5 rounded font-medium">
                  今日
                </span>
              )}
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => handleSelectDate(todayStr)}
                className="min-h-[32px] text-xs font-sans bg-subtle hover:bg-brand-soft hover:text-brand-ink text-ink-2 border border-line px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                回到今日
              </button>
            )}

            <button
              type="button"
              onClick={handleNextDay}
              disabled={isNextDisabled}
              aria-label={isNextDisabled ? "已是最新日期" : "查看后一天晨报"}
              title={
                isNextDisabled ? "已是最新日期 (今天)" : "后一天 (快捷键 →)"
              }
              className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg hover:bg-subtle disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed text-ink-2 hover:text-ink transition-colors border border-transparent hover:border-line inline-flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {historyDates.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="text-xs text-ink-muted hover:text-ink ms-1 underline underline-offset-2 cursor-pointer transition-colors font-mono"
            >
              往期 ({historyDates.length})
            </button>
          )}
        </div>

        {/* 右侧动作：RSS 聚合弹窗 + 重新生成 */}
        <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowRssModal(true)}
            className="min-h-[32px] flex items-center gap-1.5 text-ink-2 hover:text-ink px-2.5 py-1 rounded-lg border border-line bg-card hover:bg-subtle cursor-pointer transition-colors shadow-2xs font-medium text-xs"
          >
            <Rss className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
            <span>订阅 RSS</span>
          </button>

          <button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={generating}
            className={`min-h-[32px] flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-2xs disabled:opacity-50 cursor-pointer ${
              currentDigest
                ? "bg-card border border-line-strong text-ink-2 hover:bg-subtle hover:text-ink"
                : "bg-action text-action-fg hover:bg-action-hover"
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                generating ? "motion-safe:animate-spin text-brand" : ""
              }`}
              aria-hidden="true"
            />
            <span>
              {generating
                ? "大模型提炼中..."
                : currentDigest
                ? "重新抓取提炼"
                : "立即抓取生成"}
            </span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-danger-soft border border-danger-border rounded-xl flex items-start gap-3 text-xs text-danger"
        >
          <AlertCircle
            className="w-4 h-4 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <span className="font-bold">处理异常：</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* 3. 核心报刊文章主体（tabpanel 对应选中频道） */}
      <div
        role="tabpanel"
        aria-labelledby={
          selectedChannel ? `channel-tab-${selectedChannel.id}` : undefined
        }
      >
        {loading ? (
          <div className="py-24 text-center text-ink-muted bg-card rounded-2xl border border-line space-y-3 flex flex-col items-center justify-center">
            <LoadingSpinner label="正在整理排版晨报内容" size="md" />
            <p className="text-xs font-serif text-ink-muted">
              正在整理排版晨报内容...
            </p>
          </div>
        ) : generating ? (
          <div className="py-20 text-center bg-card rounded-2xl border border-line p-8 space-y-5 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-brand-soft border border-brand-border/60 flex items-center justify-center mx-auto">
              <LoadingSpinner label="正在深度提炼晨报" size="md" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-serif-title text-base sm:text-lg font-bold text-ink">
                正在深度提炼 {selectedChannel?.name} ({currentDate})
              </h1>
              <p className="text-xs text-ink-muted max-w-md mx-auto">
                聚合引擎正通过多源爬虫抓取最新动态，并调用 AI 引擎进行跨源聚类提炼。
              </p>
            </div>

            <ol
              aria-label="晨报生成进度阶段"
              className="max-w-md mx-auto grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs font-mono list-none p-0"
            >
              {[
                { step: 1, label: "① 抓取报道" },
                { step: 2, label: "② 语义聚类" },
                { step: 3, label: "③ 大模型提炼" },
                { step: 4, label: "④ 播音文稿" },
              ].map((item) => (
                <li
                  key={item.step}
                  aria-current={genStep === item.step ? "step" : undefined}
                  className={`p-2 rounded-lg border transition-colors ${
                    genStep >= item.step
                      ? "bg-brand-soft border-brand-border text-brand-ink font-semibold"
                      : "bg-subtle border-line text-ink-muted"
                  }`}
                >
                  {item.label}
                </li>
              ))}
            </ol>
          </div>
        ) : !currentDigest ? (
          <div className="space-y-6">
            <div className="py-16 sm:py-20 text-center bg-card rounded-2xl border border-dashed border-line px-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-subtle text-ink-muted flex items-center justify-center mx-auto border border-line">
                <Newspaper className="w-6 h-6" aria-hidden="true" />
              </div>

              <div className="space-y-1">
                <h1 className="font-serif-title text-lg sm:text-xl font-bold text-ink">
                  {selectedChannel?.name} · {currentDate} 暂无智能晨报
                </h1>
                <p className="text-ink-muted text-xs max-w-md mx-auto leading-relaxed">
                  当前日期尚未运行 AI 提炼生成结构化晨报。您可以点击下方按钮立即联网抓取并生成，或直接浏览下方收录的原始候选报道。
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
                <button
                  type="button"
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      generating ? "motion-safe:animate-spin" : ""
                    }`}
                    aria-hidden="true"
                  />
                  <span>立即抓取并生成晨报 ({currentDate})</span>
                </button>
                {historyDates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const latest = historyDates[0];
                      if (latest) handleSelectDate(latest.date);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-card border border-line text-ink-2 text-xs font-medium hover:bg-subtle hover:text-ink transition-colors cursor-pointer"
                  >
                    查看最近一期 ({historyDates[0]?.date})
                  </button>
                )}
              </div>
            </div>

            {channelArticles.length > 0 && (
              <section
                aria-labelledby="candidate-articles-heading"
                className="bg-card rounded-2xl border border-line p-5 sm:p-7 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-line pb-3 gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h2
                      id="candidate-articles-heading"
                      className="font-serif-title text-sm sm:text-base font-bold text-ink"
                    >
                      数据库收录候选报道
                    </h2>
                    <span className="text-xs font-mono bg-subtle text-ink-2 px-2 py-0.5 rounded-full border border-line font-medium">
                      最新 {channelArticles.length} 篇
                    </span>
                  </div>
                  <span className="text-xs text-ink-muted">
                    点击可在应用内阅读
                  </span>
                </div>

                <ul className="grid grid-cols-1 gap-2.5 list-none p-0 m-0">
                  {channelArticles.map((article, idx) => (
                    <li
                      key={article.id}
                      className={idx >= 4 ? "mwg-deferred" : undefined}
                    >
                      <article className="rounded-xl border border-line hover:border-brand-border hover:bg-brand-soft/30 bg-subtle transition-colors group">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveArticle({
                              url: article.link,
                              title: article.title,
                              sourceName: article.feedSource?.title ?? undefined,
                            })
                          }
                          className="w-full text-start p-3.5 cursor-pointer space-y-1.5 rounded-xl"
                        >
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="bg-muted-surface text-ink-2 px-1.5 py-0.5 rounded font-medium border border-line">
                              {article.feedSource?.title || "来源站"}
                            </span>
                            <time
                              dateTime={article.publishedAt}
                              className="text-ink-muted font-mono"
                            >
                              {new Date(article.publishedAt).toLocaleString(
                                "zh-CN",
                                {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </time>
                          </div>
                          <h3 className="text-xs sm:text-sm font-medium text-ink group-hover:text-brand transition-colors leading-snug">
                            {article.title}
                          </h3>
                          {article.summarySnippet && (
                            <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                              {article.summarySnippet}
                            </p>
                          )}
                        </button>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          /* 已生成的晨报报刊排版 */
          <article className="prose-pretty bg-card rounded-2xl border border-line shadow-xs p-5 sm:p-8 lg:p-10 space-y-6 sm:space-y-8 transition-colors duration-200">
            {/* 报刊头部标题 */}
            <div className="border-b border-line pb-5 sm:pb-6 space-y-3">
              <div className="text-xs text-ink-muted font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-ink-2 font-sans">
                    {selectedChannel?.name}
                  </span>
                  <span aria-hidden="true">•</span>
                  <time dateTime={currentDigest.date}>{currentDigest.date}</time>
                </span>
                <span>
                  分析 {currentDigest.articleCount} 篇多源报道 · 约 3 分钟阅读
                </span>
              </div>

              <h1 className="font-serif-title editorial-title font-bold text-ink tracking-tight">
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

            {/* 核心导读（TL;DR 引文体，左对齐以防空白河流） */}
            <section aria-label="本期导读">
              <p className="border-s-3 border-brand ps-4 pe-3 py-2 text-ink font-serif text-sm sm:text-base leading-relaxed text-start bg-subtle rounded-e-xl">
                {currentDigest.overview}
              </p>
            </section>

            {/* 焦点议题列表 */}
            <section
              aria-labelledby="digest-topics-heading"
              className="space-y-8 pt-2"
            >
              <h2 id="digest-topics-heading" className="visually-hidden">
                焦点议题
              </h2>
              {currentDigest.sections?.topics &&
              currentDigest.sections.topics.length > 0 ? (
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
                <div className="text-center py-8 text-xs text-ink-muted bg-subtle rounded-xl border border-dashed border-line">
                  本期晨报暂无结构化焦点议题
                </div>
              )}
            </section>

            {/* 综合趋势研判与行业洞察 */}
            {currentDigest.sections?.industryInsights &&
              currentDigest.sections.industryInsights.length > 0 && (
                <section
                  aria-labelledby="industry-insights-heading"
                  className="bg-inverted text-inverted-fg rounded-2xl p-5 sm:p-7 space-y-3 shadow-md border border-inverted-line"
                >
                  <h2
                    id="industry-insights-heading"
                    className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    <TrendingUp className="w-4 h-4" aria-hidden="true" />
                    <span>趋势研判与行业洞察</span>
                  </h2>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-inverted-muted font-sans leading-relaxed list-none p-0 m-0">
                    {currentDigest.sections.industryInsights.map(
                      (insight, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span
                            className="text-amber-400 font-bold text-sm leading-none mt-1"
                            aria-hidden="true"
                          >
                            •
                          </span>
                          <span>{insight}</span>
                        </li>
                      )
                    )}
                  </ul>
                </section>
              )}

            {/* 报纸尾部小注：源归属与配置入口 */}
            <div className="pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-ink-muted">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  本期收录源：{selectedChannel?.sources?.length || 0} 个站点
                </span>
                {currentDigest.deliveryLogs &&
                  currentDigest.deliveryLogs.length > 0 && (
                    <span className="text-success bg-success-soft px-2 py-0.5 rounded text-xs border border-success-border">
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
                className="hover:text-ink flex items-center gap-1 self-end sm:self-auto transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>频道规则定制</span>
              </Link>
            </div>
          </article>
        )}
      </div>

      {/* 4. 往期历史归档与日期选择弹窗（原生 <dialog>） */}
      <ModalDialog
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        closedBy="any"
        ariaLabelledBy={historyTitleId}
        className="w-[min(28rem,calc(100vw-2rem))] max-h-[85dvh] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 flex flex-col max-h-[85dvh]">
          <div className="flex items-center justify-between pb-3 border-b border-line mb-4 shrink-0">
            <h1
              id={historyTitleId}
              className="flex items-center gap-2 text-sm font-bold text-ink"
            >
              <Calendar className="w-4 h-4 text-brand" aria-hidden="true" />
              <span>{selectedChannel?.name} · 往期晨报归档</span>
            </h1>
            <button
              type="button"
              onClick={() => setShowHistoryModal(false)}
              aria-label="关闭往期归档窗口"
              className="min-h-[28px] min-w-[28px] p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-4 pb-4 border-b border-line/70 space-y-2.5 shrink-0">
            <div className="text-xs font-medium text-ink-2 flex items-center justify-between">
              <label htmlFor={historyDateInputId}>直达指定日期</label>
              <span className="text-xs text-ink-muted">选择任意历史日期</span>
            </div>
            <input
              id={historyDateInputId}
              type="date"
              max={todayStr}
              value={currentDate}
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectDate(e.target.value);
                  setShowHistoryModal(false);
                }
              }}
              className="w-full px-3 py-2 text-sm sm:text-xs bg-subtle border border-line-strong/60 rounded-lg font-mono text-ink cursor-pointer"
            />
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {[
                { label: "今日", date: todayStr },
                { label: "昨日", date: shiftDateString(todayStr, -1) },
                { label: "前日", date: shiftDateString(todayStr, -2) },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    handleSelectDate(item.date);
                    setShowHistoryModal(false);
                  }}
                  className="min-h-[28px] px-2.5 py-1 bg-subtle hover:bg-muted-surface text-ink-2 hover:text-ink border border-line rounded-lg text-xs font-mono cursor-pointer transition-colors"
                >
                  {item.label} ({item.date})
                </button>
              ))}
            </div>
          </div>

          <h2 className="text-xs font-semibold text-ink mb-2 shrink-0">
            已生成晨报历史 ({historyDates.length})
          </h2>

          <div className="mwg-scroll-shadows space-y-1.5 pe-1 flex-1 min-h-[140px]">
            {historyDates.length === 0 ? (
              <div className="text-center py-8 text-ink-muted text-xs">
                暂无历史生成记录，选择日期后可点击抓取生成
              </div>
            ) : (
              <ul className="space-y-1.5 list-none p-0 m-0">
                {historyDates.map((item) => {
                  const isCurrent = currentDate === item.date;
                  return (
                    <li key={item.date}>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectDate(item.date);
                          setShowHistoryModal(false);
                        }}
                        aria-current={isCurrent ? "date" : undefined}
                        className={`w-full text-start px-3 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-between group cursor-pointer ${
                          isCurrent
                            ? "bg-action text-action-fg font-medium shadow-2xs"
                            : "hover:bg-subtle text-ink-2 border border-transparent hover:border-line"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pe-2">
                          <span className="font-mono shrink-0">
                            {item.date}
                          </span>
                          <span className="truncate opacity-85">
                            {item.title}
                          </span>
                        </div>
                        <ChevronRight
                          className="w-3.5 h-3.5 opacity-60 motion-safe:group-hover:translate-x-0.5 transition-transform shrink-0"
                          aria-hidden="true"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </ModalDialog>

      {/* 5. RSS 聚合订阅弹窗（原生 <dialog> + Invoker Command 复制按钮） */}
      <ModalDialog
        isOpen={showRssModal}
        onClose={() => setShowRssModal(false)}
        closedBy="any"
        ariaLabelledBy={rssTitleId}
        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <h1
              id={rssTitleId}
              className="flex items-center gap-2 text-sm font-bold text-ink"
            >
              <Rss className="w-4 h-4 text-brand" aria-hidden="true" />
              <span>订阅 {selectedChannel?.name} 聚合晨报</span>
            </h1>
            <button
              type="button"
              onClick={() => setShowRssModal(false)}
              aria-label="关闭 RSS 订阅窗口"
              className="min-h-[28px] min-w-[28px] p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <p className="text-xs text-ink-2 leading-relaxed">
            系统已为该频道输出符合 RSS 2.0 标准的聚合源。每天晨报提炼完成后将自动同步，支持使用主流阅读器反向订阅。
          </p>

          <div className="space-y-2">
            <label
              htmlFor={rssInputId}
              className="block text-xs font-medium text-ink-2"
            >
              聚合订阅链接：
            </label>
            <div className="flex items-center gap-2">
              <input
                id={rssInputId}
                type="text"
                readOnly
                value={getRssUrl()}
                className="flex-1 px-3 py-2 text-xs font-mono bg-subtle border border-line-strong/60 rounded-lg text-ink select-all min-w-0"
              />
              <CopyButton
                targetId={rssInputId}
                label="复制"
                copiedLabel="已复制"
                className="px-3 py-2 bg-action text-action-fg rounded-lg text-xs font-medium hover:bg-action-hover transition-colors shrink-0"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-between gap-2 text-xs flex-wrap">
            <a
              href={getRssUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline inline-flex items-center gap-1"
            >
              <span>在浏览器中直接打开 XML</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            <span className="text-ink-muted text-xs">
              兼容 Feedly / Follow / Reeder
            </span>
          </div>
        </div>
      </ModalDialog>

      {/* 6. 沉浸式文章详情阅读弹窗（常驻以支持进出场原生 Top-Layer 动画） */}
      <ArticleReaderModal
        url={activeArticle?.url ?? null}
        initialTitle={activeArticle?.title}
        initialSourceName={activeArticle?.sourceName}
        onClose={() => setActiveArticle(null)}
      />
    </div>
  );
}
