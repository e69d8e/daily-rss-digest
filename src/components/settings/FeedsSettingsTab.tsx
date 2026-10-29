"use client";

import { useState, useEffect, useMemo } from "react";
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

export default function FeedsSettingsTab() {
  const confirm = useConfirm();
  const { toast } = useToast();
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
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);

  // OPML Modal
  const [showOpmlModal, setShowOpmlModal] = useState(false);
  const [opmlFile, setOpmlFile] = useState<File | null>(null);
  const [opmlTargetChannel, setOpmlTargetChannel] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<any>(null);

  // Refresh all
  const [refreshingAll, setRefreshingAll] = useState(false);

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
        setTargetChannelId(channelsData[0].id);
        setOpmlTargetChannel(channelsData[0].id);
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
    if (!newUrl.trim()) return;
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
      toast.success(`探测成功：解析到 ${data.title}`);
    } catch (e: any) {
      setAddError(e.message);
      toast.error(`探测失败: ${e.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveFeed = async () => {
    if (!newUrl.trim() || !targetChannelId) return;
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

      toast.success(`已成功添加订阅源: ${newTitle || newUrl}`);
      setShowAddModal(false);
      setNewUrl("");
      setNewTitle("");
      setPreviewResult(null);
      loadData();
    } catch (e: any) {
      setAddError(e.message);
      toast.error(`添加失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, feedTitle?: string) => {
    const ok = await confirm({
      title: "删除 RSS 订阅源",
      content: "确定要删除该 RSS 订阅源吗？删除后将停止获取该源的最新内容，已有文章归档不会丢失。",
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

  const handleImportOpml = async () => {
    if (!opmlFile) return;
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
      toast.success(`OPML 导入成功！共导入 ${data.importedCount} 个订阅源`);
      loadData();
    } catch (e: any) {
      setImportStatus({ error: e.message });
      toast.error(`OPML 导入失败: ${e.message}`);
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
    } catch (e: any) {
      toast.error(`刷新失败: ${e.message}`);
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#eae6df]">
        <div>
          <h3 className="text-base font-bold text-stone-900">
            RSS 订阅源列表与管理
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            共收录 {feeds.length} 个抓取源，支持连通探测、正文抽取及 OPML 批量导入导出。
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eae6df] bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="手动触发拉取所有源的最新文章并更新计数"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-stone-600 ${
                refreshingAll ? "animate-spin text-amber-700" : ""
              }`}
            />
            <span>{refreshingAll ? "正在拉取..." : "刷新全部源"}</span>
          </button>

          <a
            href="/api/feeds/opml"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eae6df] bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-stone-600" />
            <span>导出 OPML</span>
          </a>

          <button
            onClick={() => setShowOpmlModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#eae6df] bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-amber-700" />
            <span>导入 OPML</span>
          </button>

          <button
            onClick={() => {
              setShowAddModal(true);
              setPreviewResult(null);
              setAddError("");
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>添加订阅源</span>
          </button>
        </div>
      </div>

      {/* 快捷搜索与分类过滤条 */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="搜索源站名称、链接或关键词..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white rounded-xl border border-stone-200 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-900 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 p-0.5 text-stone-400 hover:text-stone-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 频道筛选下拉框 */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0 hidden sm:inline" />
          <select
            value={filterChannelId}
            onChange={(e) => setFilterChannelId(e.target.value)}
            className="w-full sm:w-44 px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs text-stone-700 focus:outline-none focus:border-stone-900 shadow-2xs cursor-pointer"
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
      </div>

      {/* 订阅源列表 */}
      {loading ? (
        <div className="p-12 text-center text-stone-400 bg-white rounded-xl border border-[#eae6df]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-400" />
          <div className="text-xs">加载订阅源列表中...</div>
        </div>
      ) : filteredFeeds.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-dashed border-[#eae6df]">
          <Rss className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-stone-800 mb-1">
            {searchQuery || filterChannelId ? "未检索到匹配的订阅源" : "暂无 RSS 订阅源"}
          </h4>
          <p className="text-stone-500 text-xs mb-4">
            {searchQuery || filterChannelId
              ? "您可以尝试清除过滤条件或添加新的 RSS 抓取源。"
              : "点击上方按钮添加新源，或导入您在其他阅读器中备份的 OPML 文件。"}
          </p>
          {(searchQuery || filterChannelId) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterChannelId("");
              }}
              className="px-3 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50 text-xs font-medium cursor-pointer mr-2"
            >
              清除筛选条件
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-medium cursor-pointer"
          >
            立即添加订阅源
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#eae6df] shadow-xs overflow-hidden">
          <div className="divide-y divide-[#eae6df]">
            {filteredFeeds.map((feed) => (
              <div
                key={feed.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#faf9f6] transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-stone-900 text-sm">
                      {feed.title}
                    </span>
                    {feed.channel && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/60">
                        <Layers className="w-3 h-3" />
                        {feed.channel.name}
                      </span>
                    )}
                    {feed.isFullTextFetch && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200/60">
                        <Sparkles className="w-2.5 h-2.5" />
                        深度全文抓取
                      </span>
                    )}
                    {feed.status === "ACTIVE" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                        <CheckCircle2 className="w-3 h-3" />
                        正常
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/60">
                        <AlertCircle className="w-3 h-3" />
                        <span>抓取异常{feed.lastError ? `: ${feed.lastError}` : ""}</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-stone-500 font-mono truncate">
                    {feed.url}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-stone-400">
                    <span>
                      已抓取历史文章: {feed._count?.articles || 0} 篇
                    </span>
                    {feed.lastFetchedAt && (
                      <span>
                        最后抓取: {new Date(feed.lastFetchedAt).toLocaleString("zh-CN")}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {feed.siteUrl && (
                    <a
                      href={feed.siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                      title="打开源站点"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(feed.id, feed.title || feed.url)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="删除此源"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 添加源弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#eae6df] max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-serif-title text-lg font-bold text-stone-900 mb-4">
              添加 RSS / Atom 订阅源
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  RSS 订阅链接 (Feed URL) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/feed.xml"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900"
                  />
                  <button
                    onClick={handlePreview}
                    disabled={previewing || !newUrl}
                    className="px-3 py-2 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 text-xs font-medium disabled:opacity-50 cursor-pointer"
                  >
                    {previewing ? "探测中..." : "探测测试"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  所属频道 *
                </label>
                <select
                  value={targetChannelId}
                  onChange={(e) => setTargetChannelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900 bg-white cursor-pointer"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  源显示名称（选填，留空则自动识别）
                </label>
                <input
                  type="text"
                  placeholder="如：机器之心前沿资讯"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="fulltext"
                  checked={isFullText}
                  onChange={(e) => setIsFullText(e.target.checked)}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                <label htmlFor="fulltext" className="text-xs text-stone-700 cursor-pointer">
                  开启正文深度抓取（适用于仅提供截断摘要的源）
                </label>
              </div>

              {previewResult && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <div className="font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>探测成功：{previewResult.title}</span>
                  </div>
                  <div className="text-stone-600 font-medium">解析到的最新报道样例：</div>
                  <ul className="list-disc list-inside text-stone-600 space-y-1">
                    {previewResult.sampleArticles?.slice(0, 3).map((a: any, i: number) => (
                      <li key={i} className="truncate">
                        {a.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {addError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-stone-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveFeed}
                disabled={saving || !newUrl}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 disabled:opacity-50 cursor-pointer"
              >
                {saving ? "保存中..." : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPML 导入弹窗 */}
      {showOpmlModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-[#eae6df] max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-serif-title text-lg font-bold text-stone-900 mb-2">
              批量导入 OPML 订阅列表
            </h3>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              从 NetNewsWire、Follow、Feedly、Inoreader 等导出的 .opml 或 .xml 文件一键导入。
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  导入到目标频道 *
                </label>
                <select
                  value={opmlTargetChannel}
                  onChange={(e) => setOpmlTargetChannel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900 bg-white cursor-pointer"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  选择 OPML 文件 (.opml / .xml) *
                </label>
                <input
                  type="file"
                  accept=".opml,.xml"
                  onChange={(e) => setOpmlFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-stone-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200 cursor-pointer"
                />
              </div>

              {importStatus && (
                <div
                  className={`p-3.5 rounded-xl text-xs ${
                    importStatus.error
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {importStatus.error ? (
                    <div>导入失败: {importStatus.error}</div>
                  ) : (
                    <div>
                      🎉 导入完成！共解析 {importStatus.totalParsed} 个源，成功导入{" "}
                      {importStatus.importedCount} 个，跳过重复 {importStatus.skippedCount} 个。
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-stone-200">
              <button
                onClick={() => setShowOpmlModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                关闭
              </button>
              <button
                onClick={handleImportOpml}
                disabled={importing || !opmlFile}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 disabled:opacity-50 cursor-pointer"
              >
                {importing ? "正在解析导入..." : "开始导入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
