"use client";

import React, { useState, useEffect, useMemo, useId, useRef } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Rss,
  AlertCircle,
  X,
  Search,
  Wand2,
} from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import ModalDialog from "@/components/ui/ModalDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

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

const PROMPT_PRESETS = [
  {
    name: "前沿科技与 AI",
    text: "重点聚焦大模型架构突破、商业化落地与开源生态，提炼工程创新与代码实践，过滤公关营销软文。",
  },
  {
    name: "深度商业研报",
    text: "提炼核心商业数据、估值变化、行业并购与宏观经济走势，注重事实与数字严谨性，条理清晰、层次分明。",
  },
  {
    name: "独立创造与产品",
    text: "关注独立创造者故事、新奇数字化工具、交互设计创新与商业闭环，文字通俗有温度，突出产品亮点。",
  },
  {
    name: "极简速读晨报",
    text: "采用结论先行、三句话看懂事实核心的精炼文风，去除冗长铺垫，适合 3 分钟极速晨读。",
  },
];

export default function ChannelsSettingsTab() {
  const confirm = useConfirm();
  const { toast } = useToast();
  const baseId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);

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
  const [feedFilterQuery, setFeedFilterQuery] = useState("");

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
      toast.error("加载频道数据失败");
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
    setFeedFilterQuery("");
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
    setFeedFilterQuery("");

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

  const handleQuickAddFeed = async () => {
    if (!quickFeedUrl.trim()) {
      setQuickFeedError("请输入有效的 RSS 订阅地址");
      return;
    }

    if (!editingId) {
      setQuickFeedError(
        "请先保存创建频道后，再直接添加新源（或从下方已有源直接勾选）"
      );
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
          url: quickFeedUrl.trim(),
          title: quickFeedTitle.trim(),
          channelId: editingId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");

      setQuickFeedSuccess(`成功添加源「${data.title}」并已自动关联！`);
      setQuickFeedUrl("");
      setQuickFeedTitle("");

      if (!selectedSourceIds.includes(data.id)) {
        setSelectedSourceIds((prev) => [...prev, data.id]);
      }

      await loadData();
    } catch (e) {
      setQuickFeedError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setQuickAdding(false);
    }
  };

  // IME 安全的回车快捷添加（规避中文输入法候选词回车与 Safari keyCode 229 问题）
  const handleQuickFeedKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      void handleQuickAddFeed();
    }
  };

  const toggleSourceSelection = (feedId: string) => {
    setSelectedSourceIds((prev) =>
      prev.includes(feedId)
        ? prev.filter((id) => id !== feedId)
        : [...prev, feedId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("请填写频道名称");
      nameInputRef.current?.focus();
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
      const res = await fetch("/api/channels", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");

      setShowModal(false);
      toast.success(`频道「${name.trim()}」已保存成功！`);
      loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, chName: string) => {
    const ok = await confirm({
      title: "删除频道规则与存档",
      content:
        "确定要删除该频道及其定制规则吗？频道下的所有订阅源将被移除，生成的简报存档也将一并清理，此操作不可撤销。",
      targetName: chName,
      confirmText: "确认删除频道",
      cancelText: "取消",
      variant: "danger",
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/channels?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `请求失败 (${res.status})`);
      }
      toast.success("频道已删除");
      loadData();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleDetachFeed = async (
    feedId: string,
    currentChannelId: string,
    feedTitle: string
  ) => {
    const otherChannels = channels.filter((c) => c.id !== currentChannelId);
    if (otherChannels.length === 0) {
      const ok = await confirm({
        title: "删除订阅源",
        content:
          "当前仅有此频道，从该频道移除将直接彻底删除该订阅源。是否确认删除？",
        targetName: feedTitle,
        confirmText: "确认删除源",
        cancelText: "取消",
        variant: "danger",
      });
      if (ok) {
        try {
          const res = await fetch(`/api/feeds?id=${feedId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            throw new Error(err?.error || `请求失败 (${res.status})`);
          }
          toast.success("已删除该源");
          loadData();
        } catch (e) {
          console.error(e);
          toast.error(e instanceof Error ? e.message : "删除失败");
        }
      }
      return;
    }

    const targetChannel = otherChannels[0];
    const ok = await confirm({
      title: "转移订阅源",
      content: `是否将该订阅源从当前频道移出，并重新绑定至「${targetChannel.name}」？`,
      targetName: feedTitle,
      confirmText: "确认转移",
      cancelText: "取消",
      variant: "warning",
    });

    if (ok) {
      try {
        const res = await fetch("/api/feeds", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: feedId, channelId: targetChannel.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error || `请求失败 (${res.status})`);
        }
        toast.success(`已将源转移至「${targetChannel.name}」`);
        loadData();
      } catch (e) {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "转移失败");
      }
    }
  };

  const modalFilteredFeeds = useMemo(() => {
    if (!feedFilterQuery.trim()) return allFeeds;
    const q = feedFilterQuery.toLowerCase();
    return allFeeds.filter(
      (f) =>
        f.title?.toLowerCase().includes(q) || f.url?.toLowerCase().includes(q)
    );
  }, [allFeeds, feedFilterQuery]);

  return (
    <div className="space-y-6">
      {/* 顶部操作区 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-base font-bold text-ink">
            频道管理、订阅源与规则定制
          </h2>
          <p className="text-xs text-ink-muted mt-0.5">
            自由分配各频道的专属 RSS 订阅源、专属 Prompt 风格与关键词过滤白/黑名单。
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="min-h-[34px] flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-action text-action-fg text-xs font-semibold hover:bg-action-hover transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>新建定制频道</span>
        </button>
      </div>

      {/* 频道卡片列表 */}
      {loading ? (
        <div className="p-12 text-center text-ink-muted bg-card rounded-xl border border-line flex flex-col items-center gap-2.5">
          <LoadingSpinner label="正在加载频道列表" size="md" />
          <div className="text-xs">加载频道列表中...</div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 list-none p-0 m-0">
          {channels.map((ch) => {
            const channelSources = ch.sources || [];

            return (
              <li
                key={ch.id}
                className="bg-card rounded-xl border border-line p-5 shadow-xs flex flex-col justify-between hover:border-line-strong transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className="w-8 h-8 rounded-lg bg-brand-soft text-brand-ink border border-brand-border/60 flex items-center justify-center font-bold"
                      aria-hidden="true"
                    >
                      <Layers className="w-4 h-4" />
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(ch)}
                        aria-label={`编辑频道 ${ch.name}`}
                        className="min-h-[30px] min-w-[30px] p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ch.id, ch.name)}
                        aria-label={`删除频道 ${ch.name}`}
                        className="min-h-[30px] min-w-[30px] p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <h3 className="font-serif-title text-base font-bold text-ink mb-1 group-hover:text-brand transition-colors">
                    {ch.name}
                  </h3>
                  <div className="text-xs font-mono text-ink-muted mb-2">
                    slug: {ch.slug}
                  </div>

                  <p className="text-xs text-ink-2 leading-relaxed mb-3 line-clamp-2">
                    {ch.description || "暂无描述"}
                  </p>

                  {/* 频道专属订阅源清单展示 */}
                  <div className="mt-3 pt-3 border-t border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink-2 flex items-center gap-1">
                        <Rss
                          className="w-3 h-3 text-brand"
                          aria-hidden="true"
                        />
                        <span>已分配源 ({channelSources.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(ch)}
                        className="text-xs text-brand hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>配置/绑定源</span>
                      </button>
                    </div>

                    {channelSources.length > 0 ? (
                      <ul className="space-y-1 max-h-32 overflow-y-auto pe-1 list-none p-0 m-0">
                        {channelSources.map((src) => (
                          <li
                            key={src.id}
                            className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded bg-subtle border border-line group/feed hover:border-line-strong"
                          >
                            <span
                              className="font-medium text-ink-2 truncate max-w-[170px]"
                              title={src.title}
                            >
                              {src.title}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px] text-ink-muted font-mono">
                                {src._count?.articles || 0}篇
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDetachFeed(src.id, ch.id, src.title)
                                }
                                aria-label={`从 ${ch.name} 移除或转移订阅源 ${src.title}`}
                                className="min-h-[24px] min-w-[24px] inline-flex items-center justify-center rounded text-ink-muted hover:text-danger transition-opacity cursor-pointer [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/feed:opacity-100 [@media(hover:hover)]:group-focus-within/feed:opacity-100 focus-visible:opacity-100"
                              >
                                <X className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-ink-muted py-2 text-center bg-subtle/60 rounded border border-dashed border-line">
                        暂未分配源，可点击上方配置
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-line flex items-center justify-between text-xs text-ink-muted font-mono">
                  <span>推送: {ch.scheduleTime}</span>
                  <button
                    type="button"
                    onClick={() => openEditModal(ch)}
                    className="text-ink-2 hover:text-ink font-sans font-medium cursor-pointer"
                  >
                    修改规则 →
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* 创建 / 编辑频道弹窗（原生 <dialog> + 语义表单 + field-sizing 自动增高文本框） */}
      <ModalDialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        closedBy={saving ? "none" : "closerequest"}
        preventClose={saving}
        ariaLabelledBy={`${baseId}-modal-title`}
        className="w-[min(42rem,calc(100vw-2rem))] max-h-[90dvh] rounded-2xl shadow-2xl overflow-hidden"
      >
        <form
          onSubmit={handleSave}
          noValidate
          className="flex flex-col max-h-[90dvh]"
        >
          <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
            <h1
              id={`${baseId}-modal-title`}
              className="font-serif-title text-lg font-bold text-ink"
            >
              {editingId ? "编辑频道规则与订阅源" : "新建定制频道"}
            </h1>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              disabled={saving}
              aria-label="关闭频道编辑窗口"
              className="min-h-[28px] min-w-[28px] p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle cursor-pointer inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="mwg-scroll-shadows p-6 space-y-5 flex-1">
            {/* 基本属性 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor={`${baseId}-name`}
                  className="block text-xs font-semibold text-ink-2 mb-1.5"
                >
                  频道名称 <span aria-hidden="true" className="text-danger">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  id={`${baseId}-name`}
                  name="channelName"
                  type="text"
                  required
                  autoFocus
                  aria-invalid={errorMsg && !name.trim() ? "true" : "false"}
                  placeholder="如：科技与前沿 AI"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className="mwg-field-control w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink"
                />
              </div>
              <div>
                <label
                  htmlFor={`${baseId}-slug`}
                  className="block text-xs font-semibold text-ink-2 mb-1.5"
                >
                  英文标识 (Slug)
                </label>
                <input
                  id={`${baseId}-slug`}
                  name="channelSlug"
                  type="text"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="如：tech-ai"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor={`${baseId}-desc`}
                className="block text-xs font-semibold text-ink-2 mb-1.5"
              >
                频道简介 / 导语
              </label>
              <textarea
                id={`${baseId}-desc`}
                name="description"
                rows={2}
                placeholder="该频道聚焦的话题与定位，将在晨报首页作为导语呈现..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mwg-autogrow px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink"
              />
            </div>

            {/* 频道订阅源配置区 */}
            <fieldset className="p-4 rounded-xl border border-brand-border/60 bg-brand-soft/25 space-y-3.5">
              <legend className="text-xs font-bold text-ink px-1 inline-flex items-center gap-1.5">
                <Rss className="w-3.5 h-3.5 text-brand" aria-hidden="true" />
                <span>频道订阅源配置 (已关联 {selectedSourceIds.length} 个源)</span>
              </legend>

              {/* 快捷新建并关联新源 */}
              {editingId && (
                <div className="bg-card p-3 rounded-lg border border-line space-y-2">
                  <div className="text-xs font-semibold text-ink-2 flex items-center gap-1">
                    <Plus
                      className="w-3.5 h-3.5 text-brand"
                      aria-hidden="true"
                    />
                    <span>快捷添加新 RSS 源并直接绑定至本频道</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-7">
                      <label
                        htmlFor={`${baseId}-quickUrl`}
                        className="visually-hidden"
                      >
                        新 RSS 订阅地址
                      </label>
                      <input
                        id={`${baseId}-quickUrl`}
                        type="url"
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="https://example.com/rss.xml"
                        value={quickFeedUrl}
                        onChange={(e) => setQuickFeedUrl(e.target.value)}
                        onKeyDown={handleQuickFeedKeyDown}
                        className="w-full px-2.5 py-1.5 text-sm sm:text-xs rounded border border-line-strong/70 font-mono bg-card text-ink"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label
                        htmlFor={`${baseId}-quickTitle`}
                        className="visually-hidden"
                      >
                        源名称（选填）
                      </label>
                      <input
                        id={`${baseId}-quickTitle`}
                        type="text"
                        placeholder="源名称 (选填)"
                        value={quickFeedTitle}
                        onChange={(e) => setQuickFeedTitle(e.target.value)}
                        onKeyDown={handleQuickFeedKeyDown}
                        className="w-full px-2.5 py-1.5 text-sm sm:text-xs rounded border border-line-strong/70 bg-card text-ink"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleQuickAddFeed}
                      disabled={quickAdding}
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-brand text-white font-medium rounded hover:bg-brand-hover disabled:opacity-50 transition-colors text-center cursor-pointer"
                    >
                      {quickAdding ? "探测中..." : "探测添加"}
                    </button>
                  </div>
                  {quickFeedError && (
                    <p role="alert" className="text-xs text-danger">
                      {quickFeedError}
                    </p>
                  )}
                  {quickFeedSuccess && (
                    <p role="status" className="text-xs text-success font-medium">
                      {quickFeedSuccess}
                    </p>
                  )}
                </div>
              )}

              {/* 从系统所有源中勾选 / 取消勾选（带 <search> 快筛） */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-semibold text-ink-2">
                    从系统所有源中选择关联（勾选即归入本频道）：
                  </span>
                  <search className="relative w-48">
                    <label
                      htmlFor={`${baseId}-feedFilter`}
                      className="visually-hidden"
                    >
                      快速筛选订阅源
                    </label>
                    <Search
                      className="w-3.5 h-3.5 text-ink-muted absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id={`${baseId}-feedFilter`}
                      type="search"
                      enterKeyHint="search"
                      placeholder="快筛订阅源..."
                      value={feedFilterQuery}
                      onChange={(e) => setFeedFilterQuery(e.target.value)}
                      className="w-full ps-8 pe-2 py-1 text-xs bg-card text-ink rounded border border-line-strong/70"
                    />
                  </search>
                </div>

                {allFeeds.length === 0 ? (
                  <div className="text-xs text-ink-muted py-3 text-center bg-card rounded border border-line">
                    系统中尚未添加任何 RSS 源，请先添加源或使用上方快捷添加
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1.5 bg-card rounded-lg border border-line">
                    {modalFilteredFeeds.map((feed) => {
                      const isChecked = selectedSourceIds.includes(feed.id);
                      const isFromOther =
                        feed.channelId &&
                        editingId &&
                        feed.channelId !== editingId;

                      return (
                        <label
                          key={feed.id}
                          className="flex items-start gap-2.5 p-2 rounded-lg border border-line bg-subtle/40 hover:border-line-strong has-[:checked]:border-brand-border has-[:checked]:bg-brand-soft/50 text-xs cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSourceSelection(feed.id)}
                            className="mt-0.5 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-ink truncate">
                              {feed.title}
                            </div>
                            <div className="text-[11px] text-ink-muted font-mono truncate">
                              {feed.url}
                            </div>
                            {isFromOther && feed.channel && (
                              <div className="text-[11px] text-brand mt-0.5">
                                原归属: {feed.channel.name}（勾选后移至本频道）
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </fieldset>

            {/* 专属 Prompt 定制 + 预设库 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label
                  htmlFor={`${baseId}-prompt`}
                  className="text-xs font-semibold text-ink-2 flex items-center gap-1.5"
                >
                  <Sparkles
                    className="w-3.5 h-3.5 text-brand"
                    aria-hidden="true"
                  />
                  <span>专属 AI 提炼 Prompt 定制（选填）</span>
                </label>
                <span className="text-xs text-ink-muted">
                  点击下方预设一键套用
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap pb-1">
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => setPromptTemplate(preset.text)}
                    className="min-h-[28px] px-2.5 py-1 bg-subtle hover:bg-brand-soft hover:text-brand-ink text-ink-2 border border-line rounded-md text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Wand2
                      className="w-3 h-3 text-brand"
                      aria-hidden="true"
                    />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>

              <textarea
                id={`${baseId}-prompt`}
                name="promptTemplate"
                rows={3}
                placeholder="如：重点关注模型架构演进与技术路线，跨源去重，语气专业简炼，过滤浮夸公关稿..."
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                className="mwg-autogrow px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs font-mono bg-card text-ink"
              />
            </div>

            {/* 关键词过滤规则 */}
            <fieldset className="space-y-3 pt-3 border-t border-line">
              <legend className="text-xs font-bold text-ink">
                关键词过滤规则 (可选)
              </legend>
              <div>
                <label
                  htmlFor={`${baseId}-include`}
                  className="block text-xs text-ink-2 mb-1"
                >
                  白名单关键词（逗号分隔，包含任一词才会被纳入晨报）：
                </label>
                <input
                  id={`${baseId}-include`}
                  name="includeKeywords"
                  type="text"
                  placeholder="大模型, 智能体, 开源, 架构"
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink"
                />
              </div>
              <div>
                <label
                  htmlFor={`${baseId}-exclude`}
                  className="block text-xs text-ink-2 mb-1"
                >
                  黑名单关键词（逗号分隔，标题包含任一词将被自动排除）：
                </label>
                <input
                  id={`${baseId}-exclude`}
                  name="excludeKeywords"
                  type="text"
                  placeholder="招聘, 兼职, 赞助, 推广, 广告"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line-strong/70 text-sm sm:text-xs bg-card text-ink"
                />
              </div>
            </fieldset>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 bg-danger-soft border border-danger-border rounded-lg text-xs text-danger flex items-center gap-1.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-line bg-subtle flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowModal(false)}
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
              {saving ? "保存中..." : "保存频道设置"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
