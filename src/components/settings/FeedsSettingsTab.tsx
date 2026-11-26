"use client";

import React, { useState, useEffect, useMemo, useId, useRef } from "react";
import {
  Rss,
  Plus,
  Upload,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Sparkles,
  Search,
  Filter,
  X,
} from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import ModalDialog from "@/components/ui/ModalDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface FeedItem {
  id: string;
  channelId: string;
  title: string;
  url: string;
  siteUrl: string | null;
  isFullTextFetch: boolean;
  status: string;
  lastError: string | null;
  lastFetchedAt: string | null;
  channel?: { id: string; name: string };
  _count?: { articles: number };
}

interface ChannelItem {
  id: string;
  name: string;
}

interface PreviewFeedResult {
  title: string;
  sampleArticles?: { title: string }[];
}

interface ImportOpmlResult {
  error?: string;
  totalParsed?: number;
  importedCount?: number;
  skippedCount?: number;
}

export default function FeedsSettingsTab() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const baseId = useId();
  const feedUrlInputRef = useRef<HTMLInputElement>(null);

  const [feeds, setFeeds] = useState<FeedItem[]>([]);
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 搜索与过滤
  const [searchQuery, setSearchQuery] = useState("");
  const [filterChannelId, setFilterChannelId] = useState("");

  // Add Feed Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [targetChannelId, setTargetChannelId] = useState("");
  const [isFullText, setIsFullText] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewFeedResult | null>(
    null
  );
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);

  // OPML Modal
  const [showOpmlModal, setShowOpmlModal] = useState(false);
  const [opmlFile, setOpmlFile] = useState<File | null>(null);
  const [opmlTargetChannel, setOpmlTargetChannel] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportOpmlResult | null>(
    null
  );

  // Refresh all
  const [refreshingAll, setRefreshingAll] = useState(false);

  const switchAttr = { switch: "" } as Record<string, string>;

  const loadData = async () => {
    setLoading(true);
    try {
      const [feedsRes, channelsRes] = await Promise.all([
        fetch("/api/feeds"),
        fetch("/api/channels"),
      ]);
      const feedsData = await feedsRes.json();
      const channelsData = await channelsRes.json();
      setFeeds(Array.isArray(feedsData) ? feedsData : []);
      if (Array.isArray(channelsData) && channelsData.length > 0) {
        setChannels(channelsData);
        setTargetChannelId((prev) => prev || channelsData[0].id);
        setOpmlTargetChannel((prev) => prev || channelsData[0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error("加载订阅源数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredFeeds = useMemo(() => {
    return feeds.filter((feed) => {
      const matchSearch =
        !searchQuery.trim() ||
        feed.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feed.url?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChannel =
        !filterChannelId || feed.channelId === filterChannelId;
      return matchSearch && matchChannel;
    });
  }, [feeds, searchQuery, filterChannelId]);

  const handlePreview = async () => {
    if (!newUrl.trim()) {
      setAddError("请先填写 RSS 订阅链接再进行探测");
      feedUrlInputRef.current?.focus();
      return;
    }
    setPreviewing(true);
    setAddError("");
    setPreviewResult(null);

    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          previewOnly: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "源测试失败");

      setPreviewResult(data);
      if (!newTitle) setNewTitle(data.title);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "源探测失败");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) {
      setAddError("请填写有效的 RSS 订阅链接");
      feedUrlInputRef.current?.focus();
      return;
    }
    if (!targetChannelId) {
      setAddError("请选择所属频道");
      return;
    }

    setSaving(true);
    setAddError("");

    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          title: newTitle.trim(),
          channelId: targetChannelId,
          isFullTextFetch: isFullText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");

      const addedLabel = newTitle.trim() || newUrl.trim();
      setShowAddModal(false);
      setNewUrl("");
      setNewTitle("");
      setPreviewResult(null);
      toast.success(`已成功添加订阅源: ${addedLabel}`);
      loadData();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, feedTitle?: string) => {
    const ok = await confirm({
      title: "删除 RSS 订阅源",
      content:
        "确定要删除该 RSS 订阅源吗？删除后将停止获取该源的最新内容，已有文章归档不会丢失。",
      targetName: feedTitle,
      confirmText: "确认删除",
      cancelText: "取消",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/feeds?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `请求失败 (${res.status})`);
      }
      toast.success("已删除订阅源");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleImportOpml = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opmlFile) {
      setImportStatus({ error: "请先选择一个 .opml 或 .xml 文件" });
      return;
    }
    setImporting(true);
    setImportStatus(null);

    try {
      const content = await opmlFile.text();
      const res = await fetch("/api/feeds/opml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opmlContent: content,
          targetChannelId: opmlTargetChannel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");

      setImportStatus(data);
      loadData();
    } catch (err) {
      setImportStatus({
        error: err instanceof Error ? err.message : "导入失败",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      const res = await fetch("/api/feeds/refresh", { method: "POST" });
      if (!res.ok) throw new Error("刷新失败");
      await loadData();
      toast.success("全部订阅源已刷新抓取完成！");
    } catch (e) {
      toast.error(`刷新失败: ${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-base font-bold text-ink">
            RSS 订阅源列表与管理
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            共收录 {feeds.length} 个抓取源，支持连通探测、正文抽取及 OPML 批量导入导出。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className="min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold text-ink-2 hover:text-ink hover:bg-subtle transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-ink-muted ${
                refreshingAll ? "motion-safe:animate-spin text-brand" : ""
              }`}
              aria-hidden="true"
            />
            <span>{refreshingAll ? "正在拉取..." : "刷新全部源"}</span>
          </button>

          <a
            href="/api/feeds/opml"
            className="min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold text-ink-2 hover:text-ink hover:bg-subtle transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" aria-hidden="true" />
            <span>导出 OPML</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setImportStatus(null);
              setShowOpmlModal(true);
            }}
            className="min-h-[34px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-semibold text-ink-2 hover:text-ink hover:bg-subtle transition-colors shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
            <span>导入 OPML</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setPreviewResult(null);
              setAddError("");
            }}
            className="min-h-[34px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>添加订阅源</span>
          </button>
        </div>
      </div>

      {/* 快捷搜索与分类过滤条（原生 <search> 地标 + type="search"） */}
      <search
        aria-label="筛选订阅源"
        className="flex flex-col sm:flex-row items-center gap-2.5"
      >
        <div className="relative flex-1 w-full">
          <label htmlFor={`${baseId}-search`} className="visually-hidden">
            搜索源站名称、链接或关键词
          </label>
          <Search
            className="w-3.5 h-3.5 text-ink-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id={`${baseId}-search`}
            type="search"
            enterKeyHint="search"
            placeholder="搜索源站名称、链接或关键词..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full ps-9 pe-8 py-2 bg-card rounded-xl border border-line-strong/60 text-sm sm:text-xs text-ink placeholder:text-ink-muted shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="清除搜索关键词"
              className="min-h-[28px] min-w-[28px] absolute end-1.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink cursor-pointer inline-flex items-center justify-center rounded"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter
            className="w-3.5 h-3.5 text-ink-muted shrink-0 hidden sm:inline"
            aria-hidden="true"
          />
          <label htmlFor={`${baseId}-filterChannel`} className="visually-hidden">
            按所属频道筛选
          </label>
          <select
            id={`${baseId}-filterChannel`}
            value={filterChannelId}
            onChange={(e) => setFilterChannelId(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 bg-card rounded-xl border border-line-strong/60 text-sm sm:text-xs text-ink shadow-2xs cursor-pointer"
          >
            <option value="">全部频道 ({feeds.length})</option>
            {channels.map((ch) => {
              const count = feeds.filter((f) => f.channelId === ch.id).length;
              return (
                <option key={ch.id} value={ch.id}>
                  {ch.name} ({count})
                </option>
              );
            })}
          </select>
        </div>
      </search>

      {/* 订阅源列表 */}
      {loading ? (
        <div className="p-12 text-center text-ink-muted bg-card rounded-xl border border-line flex flex-col items-center gap-2.5">
          <LoadingSpinner label="正在加载订阅源列表" size="md" />
          <div className="text-xs">加载订阅源列表中...</div>
        </div>
      ) : filteredFeeds.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-xl border border-dashed border-line space-y-2">
          <Rss
            className="w-8 h-8 text-ink-muted/60 mx-auto"
            aria-hidden="true"
          />
          <h3 className="text-sm font-bold text-ink">
            {searchQuery || filterChannelId
              ? "未检索到匹配的订阅源"
              : "暂无 RSS 订阅源"}
          </h3>
          <p className="text-ink-muted text-xs mb-4">
            {searchQuery || filterChannelId
              ? "您可以尝试清除过滤条件或添加新的 RSS 抓取源。"
              : "点击上方按钮添加新源，或导入您在其他阅读器中备份的 OPML 文件。"}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {(searchQuery || filterChannelId) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setFilterChannelId("");
                }}
                className="px-3 py-1.5 rounded-lg border border-line-strong text-ink-2 hover:bg-subtle text-xs font-medium cursor-pointer"
              >
                清除筛选条件
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-action text-action-fg text-xs font-medium hover:bg-action-hover cursor-pointer"
            >
              立即添加订阅源
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-line shadow-xs overflow-hidden">
          <ul className="divide-y divide-line list-none p-0 m-0">
            {filteredFeeds.map((feed, idx) => (
              <li
                key={feed.id}
                className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-subtle transition-colors ${
                  idx >= 6 ? "mwg-deferred" : ""
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-ink text-sm">
                      {feed.title}
                    </span>
                    {feed.channel && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-brand-soft text-brand-ink border border-brand-border/60">
                        <Layers className="w-3 h-3" aria-hidden="true" />
                        <span>{feed.channel.name}</span>
                      </span>
                    )}
                    {feed.isFullTextFetch && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-subtle text-ink-2 border border-line">
                        <Sparkles
                          className="w-3 h-3 text-brand"
                          aria-hidden="true"
                        />
                        <span>深度全文抓取</span>
                      </span>
                    )}
                    {feed.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success bg-success-soft px-1.5 py-0.5 rounded border border-success-border">
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                        <span>正常</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-danger bg-danger-soft px-1.5 py-0.5 rounded border border-danger-border">
                        <AlertCircle className="w-3 h-3" aria-hidden="true" />
                        <span>
                          抓取异常{feed.lastError ? `: ${feed.lastError}` : ""}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-ink-muted font-mono truncate">
                    {feed.url}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-ink-muted flex-wrap">
                    <span>
                      已抓取历史文章: {feed._count?.articles || 0} 篇
                    </span>
                    {feed.lastFetchedAt && (
                      <time dateTime={feed.lastFetchedAt}>
                        最后抓取:{" "}
                        {new Date(feed.lastFetchedAt).toLocaleString("zh-CN")}
                      </time>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {feed.siteUrl && (
                    <a
                      href={feed.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`在新窗口打开源站点：${feed.title}`}
                      className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-muted-surface transition-colors inline-flex items-center justify-center"
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(feed.id, feed.title || feed.url)}
                    aria-label={`删除订阅源：${feed.title || feed.url}`}
                    className="min-h-[32px] min-w-[32px] p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer inline-flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 添加源弹窗（原生 <dialog> + 语义表单） */}
      <ModalDialog
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        closedBy={saving ? "none" : "any"}
        preventClose={saving}
        ariaLabelledBy={`${baseId}-add-title`}
        className="w-[min(32rem,calc(100vw-2rem))] max-h-[90dvh] rounded-2xl shadow-2xl overflow-hidden"
      >
        <form
          onSubmit={handleSaveFeed}
          noValidate
          className="flex flex-col max-h-[90dvh]"
        >
          <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
            <h1
              id={`${baseId}-add-title`}
              className="font-serif-title text-lg font-bold text-ink"
            >
              添加 RSS / Atom 订阅源
            </h1>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={saving}
              aria-label="关闭添加订阅源窗口"
              className="min-h-[28px] min-w-[28px] p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label
                htmlFor={`${baseId}-newUrl`}
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                RSS 订阅链接 (Feed URL){" "}
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  ref={feedUrlInputRef}
                  id={`${baseId}-newUrl`}
                  name="feedUrl"
                  type="url"
                  required
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-invalid={addError && !newUrl.trim() ? "true" : "false"}
                  placeholder="https://example.com/feed.xml"
                  value={newUrl}
                  onChange={(e) => {
                    setNewUrl(e.target.value);
                    if (addError) setAddError("");
                  }}
                  className="mwg-field-control flex-1 px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink min-w-0"
                />
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewing || !newUrl.trim()}
                  className="px-3 py-2 rounded-lg bg-subtle text-ink-2 border border-line hover:bg-muted-surface hover:text-ink text-xs font-medium disabled:opacity-50 cursor-pointer shrink-0 transition-colors"
                >
                  {previewing ? "探测中..." : "探测测试"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor={`${baseId}-targetChannel`}
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                所属频道{" "}
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </label>
              <select
                id={`${baseId}-targetChannel`}
                name="channelId"
                required
                value={targetChannelId}
                onChange={(e) => setTargetChannelId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink cursor-pointer"
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`${baseId}-newTitle`}
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                源显示名称（选填，留空则自动识别）
              </label>
              <input
                id={`${baseId}-newTitle`}
                name="feedTitle"
                type="text"
                placeholder="如：机器之心前沿资讯"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink"
              />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                {...switchAttr}
                id={`${baseId}-fulltext`}
                checked={isFullText}
                onChange={(e) => setIsFullText(e.target.checked)}
              />
              <label
                htmlFor={`${baseId}-fulltext`}
                className="text-xs text-ink-2 cursor-pointer"
              >
                开启正文深度抓取（适用于仅提供截断摘要的源）
              </label>
            </div>

            {previewResult && (
              <div
                role="status"
                className="p-3.5 bg-success-soft border border-success-border rounded-xl text-xs space-y-2"
              >
                <div className="font-semibold text-success flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>探测成功：{previewResult.title}</span>
                </div>
                <div className="text-ink-2 font-medium">
                  解析到的最新报道样例：
                </div>
                <ul className="list-disc list-inside text-ink-2 space-y-1">
                  {previewResult.sampleArticles?.slice(0, 3).map((a, i) => (
                    <li key={i} className="truncate">
                      {a.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {addError && (
              <div
                role="alert"
                className="p-3 bg-danger-soft border border-danger-border rounded-lg text-xs text-danger flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{addError}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-line bg-subtle flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-medium text-ink-2 hover:text-ink hover:bg-muted-surface cursor-pointer transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover disabled:opacity-50 cursor-pointer transition-colors"
            >
              {saving ? "保存中..." : "确认添加"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* OPML 导入弹窗（原生 <dialog> + 语义表单） */}
      <ModalDialog
        isOpen={showOpmlModal}
        onClose={() => setShowOpmlModal(false)}
        closedBy={importing ? "none" : "any"}
        preventClose={importing}
        ariaLabelledBy={`${baseId}-opml-title`}
        className="w-[min(32rem,calc(100vw-2rem))] rounded-2xl shadow-2xl overflow-hidden"
      >
        <form onSubmit={handleImportOpml} noValidate>
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <h1
              id={`${baseId}-opml-title`}
              className="font-serif-title text-lg font-bold text-ink"
            >
              批量导入 OPML 订阅列表
            </h1>
            <button
              type="button"
              onClick={() => setShowOpmlModal(false)}
              disabled={importing}
              aria-label="关闭 OPML 导入窗口"
              className="min-h-[28px] min-w-[28px] p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-ink-muted leading-relaxed">
              从 NetNewsWire、Follow、Feedly、Inoreader 等导出的 .opml 或 .xml 文件一键导入。
            </p>

            <div>
              <label
                htmlFor={`${baseId}-opmlChannel`}
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                导入到目标频道{" "}
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </label>
              <select
                id={`${baseId}-opmlChannel`}
                name="opmlTargetChannel"
                required
                value={opmlTargetChannel}
                onChange={(e) => setOpmlTargetChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink cursor-pointer"
              >
                {channels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={`${baseId}-opmlFile`}
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                选择 OPML 文件 (.opml / .xml){" "}
                <span aria-hidden="true" className="text-danger">
                  *
                </span>
              </label>
              <input
                id={`${baseId}-opmlFile`}
                name="opmlFile"
                type="file"
                required
                accept=".opml,.xml"
                onChange={(e) => setOpmlFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-ink-2 file:me-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-line file:text-xs file:font-semibold file:bg-subtle file:text-ink hover:file:bg-muted-surface cursor-pointer"
              />
            </div>

            {importStatus && (
              <div
                role={importStatus.error ? "alert" : "status"}
                className={`p-3.5 rounded-xl text-xs border ${
                  importStatus.error
                    ? "bg-danger-soft text-danger border-danger-border"
                    : "bg-success-soft text-success border-success-border"
                }`}
              >
                {importStatus.error ? (
                  <div>导入失败: {importStatus.error}</div>
                ) : (
                  <div>
                    导入完成！共解析 {importStatus.totalParsed} 个源，成功导入{" "}
                    {importStatus.importedCount} 个，跳过重复{" "}
                    {importStatus.skippedCount} 个。
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-line bg-subtle flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowOpmlModal(false)}
              disabled={importing}
              className="px-4 py-2 rounded-lg text-xs font-medium text-ink-2 hover:text-ink hover:bg-muted-surface cursor-pointer transition-colors"
            >
              关闭
            </button>
            <button
              type="submit"
              disabled={importing}
              className="px-4 py-2 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover disabled:opacity-50 cursor-pointer transition-colors"
            >
              {importing ? "正在解析导入..." : "开始导入"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
