"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Plus,
  Clock,
  Trash2,
  Edit2,
  Sparkles,
  Filter,
  RefreshCw,
  Rss,
  Check,
  Link2,
  ExternalLink,
  AlertCircle,
  X,
  Radio,
} from "lucide-react";

interface FeedSourceSummary {
  id: string;
  title: string;
  url: string;
  siteUrl?: string | null;
  status: string;
  channel?: { id: string; name: string; slug: string };
  channelId?: string;
  _count?: { articles: number };
}

interface ChannelData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  scheduleTime: string;
  promptTemplate: string | null;
  filterKeywords: string | null;
  isEnabled: boolean;
  sources?: FeedSourceSummary[];
  _count?: { sources: number; digests: number };
}

export default function ChannelsSettingsTab() {
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [allFeeds, setAllFeeds] = useState<FeedSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit / Create Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("newspaper");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState("");
  const [excludeKeywords, setExcludeKeywords] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Quick Add Feed inside Modal
  const [quickFeedUrl, setQuickFeedUrl] = useState("");
  const [quickFeedTitle, setQuickFeedTitle] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [quickFeedError, setQuickFeedError] = useState("");
  const [quickFeedSuccess, setQuickFeedSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [chanRes, feedRes] = await Promise.all([
        fetch("/api/channels"),
        fetch("/api/feeds"),
      ]);
      const chanData = await chanRes.json();
      const feedData = await feedRes.json();
      setChannels(Array.isArray(chanData) ? chanData : []);
      setAllFeeds(Array.isArray(feedData) ? feedData : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setDescription("");
    setIcon("newspaper");
    setScheduleTime("08:00");
    setPromptTemplate("");
    setIncludeKeywords("");
    setExcludeKeywords("");
    setSelectedSourceIds([]);
    setQuickFeedUrl("");
    setQuickFeedTitle("");
    setQuickFeedError("");
    setQuickFeedSuccess("");
    setErrorMsg("");
    setShowModal(true);
  };

  const openEditModal = (ch: ChannelData) => {
    setEditingId(ch.id);
    setName(ch.name);
    setSlug(ch.slug);
    setDescription(ch.description || "");
    setIcon(ch.icon || "newspaper");
    setScheduleTime(ch.scheduleTime || "08:00");
    setPromptTemplate(ch.promptTemplate || "");

    const sourceIds = (ch.sources || []).map((s) => s.id);
    setSelectedSourceIds(sourceIds);

    let inc = "";
    let exc = "";
    if (ch.filterKeywords) {
      try {
        const parsed = JSON.parse(ch.filterKeywords);
        inc = (parsed.include || []).join(", ");
        exc = (parsed.exclude || []).join(", ");
      } catch {
        exc = ch.filterKeywords;
      }
    }
    setIncludeKeywords(inc);
    setExcludeKeywords(exc);
    setQuickFeedUrl("");
    setQuickFeedTitle("");
    setQuickFeedError("");
    setQuickFeedSuccess("");
    setErrorMsg("");
    setShowModal(true);
  };

  // 快速新增订阅源并挂载至当前编辑频道
  const handleQuickAddFeed = async () => {
    if (!quickFeedUrl.trim()) {
      setQuickFeedError("请输入有效的 RSS 订阅地址");
      return;
    }

    if (!editingId) {
      setQuickFeedError("请先保存创建频道后，再直接添加新源（或从下方已有源直接勾选）");
      return;
    }

    setQuickAdding(true);
    setQuickFeedError("");
    setQuickFeedSuccess("");

    try {
      const res = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: editingId,
          url: quickFeedUrl.trim(),
          title: quickFeedTitle.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "添加订阅源失败");
      }

      setQuickFeedSuccess(`成功添加并关联源：「${data.title}」`);
      setQuickFeedUrl("");
      setQuickFeedTitle("");
      if (!selectedSourceIds.includes(data.id)) {
        setSelectedSourceIds((prev) => [...prev, data.id]);
      }
      // 重新拉取列表以同步
      await loadData();
    } catch (err: any) {
      setQuickFeedError(err.message || "添加订阅源失败");
    } finally {
      setQuickAdding(false);
    }
  };

  // 切换已有源的选择状态
  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setErrorMsg("频道名称不能为空");
      return;
    }
    setSaving(true);
    setErrorMsg("");

    const filterObj = {
      include: includeKeywords
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      exclude: excludeKeywords
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const payload = {
      id: editingId,
      name: name.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || null,
      icon,
      scheduleTime,
      promptTemplate: promptTemplate.trim() || null,
      filterKeywords: JSON.stringify(filterObj),
      sourceIds: selectedSourceIds,
    };

    try {
      const method = editingId ? "PUT" : "POST";
      const res = await fetch("/api/channels", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存失败");
      }

      setShowModal(false);
      loadData();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除频道「${name}」及其所有源和简报存档吗？`)) return;
    try {
      await fetch(`/api/channels?id=${id}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // 从频道中直接解绑/转移某个源
  const handleDetachFeed = async (feedId: string, currentChannelId: string, feedTitle: string) => {
    const otherChannels = channels.filter((c) => c.id !== currentChannelId);
    if (otherChannels.length === 0) {
      if (confirm(`当前只有一个频道，是否直接删除订阅源「${feedTitle}」？`)) {
        await fetch(`/api/feeds?id=${feedId}`, { method: "DELETE" });
        loadData();
      }
      return;
    }

    const targetChannel = otherChannels[0];
    if (
      confirm(
        `是否将订阅源「${feedTitle}」从当前频道移出，并转移至「${targetChannel.name}」？`
      )
    ) {
      try {
        await fetch("/api/feeds", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: feedId, channelId: targetChannel.id }),
        });
        loadData();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#eae6df]">
        <div>
          <h3 className="text-base font-bold text-stone-900">
            频道管理、订阅源与规则定制
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            自由分配各频道的专属 RSS 订阅源、定时早报推送时刻、专属 Prompt 风格与关键词过滤白/黑名单。
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建定制频道</span>
        </button>
      </div>

      {/* 频道卡片列表 */}
      {loading ? (
        <div className="p-12 text-center text-stone-400 bg-white rounded-xl border border-[#eae6df]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-stone-400" />
          <div className="text-xs">加载频道列表中...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {channels.map((ch) => {
            let filterSummary = "";
            if (ch.filterKeywords) {
              try {
                const parsed = JSON.parse(ch.filterKeywords);
                if (parsed.include?.length)
                  filterSummary += `必含: ${parsed.include.slice(0, 3).join("/")} `;
                if (parsed.exclude?.length)
                  filterSummary += `过滤: ${parsed.exclude.slice(0, 3).join("/")}`;
              } catch {
                filterSummary = ch.filterKeywords;
              }
            }

            const channelSources = ch.sources || [];

            return (
              <div
                key={ch.id}
                className="bg-white rounded-xl border border-[#eae6df] p-5 shadow-xs flex flex-col justify-between hover:border-stone-400 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(ch)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                        title="编辑频道与订阅源"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ch.id, ch.name)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="删除频道"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-serif-title text-base font-bold text-stone-900 mb-1 group-hover:text-amber-900 transition-colors">
                    {ch.name}
                  </h4>
                  <div className="text-[11px] font-mono text-stone-400 mb-2">
                    slug: {ch.slug}
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed mb-3 line-clamp-2">
                    {ch.description || "暂无描述"}
                  </p>

                  {/* 频道专属订阅源清单展示 */}
                  <div className="mt-3 pt-3 border-t border-[#f1ede6] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                        <Rss className="w-3 h-3 text-amber-700" />
                        <span>已分配源 ({channelSources.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(ch)}
                        className="text-[11px] text-amber-800 hover:underline flex items-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>配置/绑定源</span>
                      </button>
                    </div>

                    {channelSources.length > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {channelSources.map((src) => (
                          <div
                            key={src.id}
                            className="flex items-center justify-between text-[11px] px-2 py-1 rounded bg-stone-50 border border-stone-100 group/feed hover:border-stone-200"
                          >
                            <span
                              className="font-medium text-stone-700 truncate max-w-[170px]"
                              title={src.title}
                            >
                              {src.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10px] text-stone-400 font-mono">
                                {src._count?.articles || 0}篇
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDetachFeed(src.id, ch.id, src.title)}
                                className="opacity-0 group-hover/feed:opacity-100 text-stone-400 hover:text-rose-600 transition-opacity"
                                title="从当前频道移除或转移"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-stone-400 bg-stone-50/50 p-2 rounded text-center border border-dashed border-stone-200">
                        暂无订阅源，请点击上方配置绑定
                      </div>
                    )}
                  </div>

                  {/* 定时与规则信息 */}
                  <div className="space-y-1.5 text-xs border-t border-[#f1ede6] pt-3 mt-3">
                    <div className="flex items-center justify-between text-stone-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        定时汇总时间
                      </span>
                      <span className="font-mono font-medium text-stone-800">
                        {ch.scheduleTime}
                      </span>
                    </div>

                    {filterSummary && (
                      <div className="flex items-start gap-1 text-[11px] text-stone-500 pt-1">
                        <Filter className="w-3 h-3 text-stone-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{filterSummary}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#f1ede6] flex items-center justify-between text-xs">
                  <a
                    href={`/?channel=${ch.slug}`}
                    className="text-amber-800 font-medium hover:underline flex items-center gap-1"
                  >
                    <span>查阅本期报刊</span>
                    <span>&rarr;</span>
                  </a>
                  <a
                    href={`/api/feed/${ch.slug}/rss.xml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-400 hover:text-stone-700"
                    title="对外输出 RSS"
                  >
                    RSS Feed
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 创建 / 编辑频道弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#eae6df] max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-serif-title text-lg font-bold text-stone-900 mb-4">
              {editingId ? "编辑频道规则与订阅源" : "新建定制频道"}
            </h3>

            <div className="space-y-5">
              {/* 基本属性 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    频道名称 *
                  </label>
                  <input
                    type="text"
                    placeholder="如：科技与前沿 AI"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    英文标识 (Slug)
                  </label>
                  <input
                    type="text"
                    placeholder="如：tech-ai"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  频道简介
                </label>
                <textarea
                  rows={2}
                  placeholder="该频道聚焦的话题与定位..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  每日定时汇总时间 (HH:mm)
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:outline-none focus:border-stone-900"
                />
              </div>

              {/* 核心重点需求：频道订阅源配置区 */}
              <div className="p-4 rounded-xl border border-amber-200/80 bg-amber-50/20 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Rss className="w-4 h-4 text-amber-800" />
                    <span className="text-xs font-bold text-stone-900">
                      频道订阅源配置 (关联 {selectedSourceIds.length} 个源)
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500">
                    勾选即可将源归入本频道，每日晨报将针对这些源汇总
                  </span>
                </div>

                {/* 快捷新建并关联新源（编辑频道模式可用） */}
                {editingId && (
                  <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-2">
                    <div className="text-[11px] font-semibold text-stone-700 flex items-center gap-1">
                      <Plus className="w-3 h-3 text-amber-700" />
                      <span>快捷添加新 RSS 源并直接绑定至本频道</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/rss.xml"
                        value={quickFeedUrl}
                        onChange={(e) => setQuickFeedUrl(e.target.value)}
                        className="sm:col-span-7 px-2.5 py-1.5 text-xs rounded border border-stone-300 font-mono focus:outline-none focus:border-stone-900"
                      />
                      <input
                        type="text"
                        placeholder="源名称 (选填)"
                        value={quickFeedTitle}
                        onChange={(e) => setQuickFeedTitle(e.target.value)}
                        className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded border border-stone-300 focus:outline-none focus:border-stone-900"
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddFeed}
                        disabled={quickAdding}
                        className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-amber-800 text-white font-medium rounded hover:bg-amber-900 disabled:opacity-50 transition-colors text-center"
                      >
                        {quickAdding ? "探测中..." : "探测并添加"}
                      </button>
                    </div>
                    {quickFeedError && (
                      <p className="text-[10px] text-rose-600">{quickFeedError}</p>
                    )}
                    {quickFeedSuccess && (
                      <p className="text-[10px] text-emerald-700 font-medium">
                        {quickFeedSuccess}
                      </p>
                    )}
                  </div>
                )}

                {/* 从系统所有源中勾选 / 取消勾选 */}
                <div>
                  <div className="text-[11px] font-semibold text-stone-600 mb-2">
                    从系统所有已登记订阅源中选择关联：
                  </div>
                  {allFeeds.length === 0 ? (
                    <div className="text-xs text-stone-400 py-3 text-center bg-white rounded border border-stone-200">
                      系统中尚未添加任何 RSS 源，请先添加源或使用上方快捷添加
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                      {allFeeds.map((feed) => {
                        const isChecked = selectedSourceIds.includes(feed.id);
                        const isFromOther =
                          feed.channelId &&
                          editingId &&
                          feed.channelId !== editingId;

                        return (
                          <label
                            key={feed.id}
                            className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                              isChecked
                                ? "border-amber-800 bg-amber-50/70 text-stone-900"
                                : "border-stone-200 bg-white hover:border-stone-300 text-stone-600"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSourceSelection(feed.id)}
                              className="mt-0.5 rounded border-stone-300 text-amber-800 focus:ring-amber-800"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold truncate">
                                {feed.title}
                              </div>
                              <div className="text-[10px] text-stone-400 font-mono truncate">
                                {feed.url}
                              </div>
                              {isFromOther && feed.channel && (
                                <div className="text-[10px] text-amber-700 mt-0.5">
                                  原归属: {feed.channel.name}（勾选后将移至本频道）
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 专属 Prompt 定制 */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
                  <span>专属 AI 提炼 Prompt 定制（选填）</span>
                  <Sparkles className="w-3 h-3 text-amber-600" />
                </label>
                <textarea
                  rows={3}
                  placeholder="如：重点关注模型架构演进与技术路线，跨源去重，语气专业简炼，过滤浮夸公关稿..."
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900 font-mono"
                />
              </div>

              {/* 关键词过滤规则 */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div className="text-xs font-bold text-stone-800">
                  关键词过滤规则 (可选)
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-1">
                    白名单关键词（逗号分隔，包含任一词才会被纳入晨报）：
                  </label>
                  <input
                    type="text"
                    placeholder="大模型, 智能体, 开源, 融资"
                    value={includeKeywords}
                    onChange={(e) => setIncludeKeywords(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-stone-600 mb-1">
                    黑名单关键词（逗号分隔，标题包含任一词将被自动排除）：
                  </label>
                  <input
                    type="text"
                    placeholder="招聘, 兼职, 赞助, 推广, 广告"
                    value={excludeKeywords}
                    onChange={(e) => setExcludeKeywords(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:border-stone-900"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-stone-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-amber-800 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存频道设置"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
