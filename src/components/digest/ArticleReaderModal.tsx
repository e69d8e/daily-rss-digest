"use client";

import { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import {
  X,
  ExternalLink,
  Volume2,
  Play,
  Pause,
  Square,
  Clock,
  User,
  BookOpen,
  AlertTriangle,
  Type,
} from "lucide-react";
import ModalDialog from "@/components/ui/ModalDialog";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import CopyButton from "@/components/ui/CopyButton";
import { isTopModalElement } from "@/lib/modalStack";

interface ArticleReaderModalProps {
  url: string | null;
  initialTitle?: string;
  initialSourceName?: string;
  onClose: () => void;
}

interface ArticleDetail {
  id: string | null;
  title: string;
  author: string;
  sourceName: string;
  publishedAt: string | null;
  link: string;
  snippet: string;
  content: string;
  isFullText: boolean;
}

export default function ArticleReaderModal({
  url,
  initialTitle,
  initialSourceName,
  onClose,
}: ArticleReaderModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [fontSerif, setFontSerif] = useState(false);

  // TTS 状态
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [isPausedTts, setIsPausedTts] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsNotice, setTtsNotice] = useState("");
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const rateRef = useRef(ttsRate);
  rateRef.current = ttsRate;

  const stopTts = useCallback(() => {
    isPlayingRef.current = false;
    isPausedRef.current = false;
    try {
      if (
        typeof window !== "undefined" &&
        window.speechSynthesis &&
        typeof window.speechSynthesis.cancel === "function"
      ) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    setIsPlayingTts(false);
    setIsPausedTts(false);
    setCurrentSentenceIndex(0);
    currentIndexRef.current = 0;
  }, []);

  // 1. 请求文章正文详情（active + AbortController 防止过期请求覆盖）
  useEffect(() => {
    if (!url) {
      stopTts();
      setArticle(null);
      setTtsNotice("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setTtsNotice("");
    stopTts();

    if (progressBarRef.current) {
      progressBarRef.current.style.transform = "scaleX(0)";
    }

    const encoded = encodeURIComponent(url);
    fetch(`/api/articles/detail?url=${encoded}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || "获取正文失败");
        }
        return res.json();
      })
      .then((data: ArticleDetail) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("加载文章失败:", err);
        setError(err instanceof Error ? err.message : "正文加载异常");
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [url, stopTts]);

  // 卸载时清理语音
  useEffect(() => stopTts, [stopTts]);

  // 2. 键盘翻屏快捷键 (J / K) —— 仅当前阅读器为顶层模态框时响应；Esc 交由原生 <dialog> 接管
  useEffect(() => {
    if (!url) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopModalElement(dialogRef.current)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const prefersReduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";

      if (e.key === "j" || e.key === "J") {
        scrollContainerRef.current?.scrollBy({ top: 140, behavior });
      } else if (e.key === "k" || e.key === "K") {
        scrollContainerRef.current?.scrollBy({ top: -140, behavior });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [url]);

  // 3. 滚动阅读进度条：现代浏览器使用 CSS Scroll-Driven Animations (`scroll-timeline`)，
  //    仅在不支持 `animation-timeline: scroll()` 时回退到无 React 重渲染的被动 scroll 监听
  useEffect(() => {
    if (!url) return;
    const scroller = scrollContainerRef.current;
    const bar = progressBarRef.current;
    if (!scroller || !bar || typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const nativeSupported =
      !prefersReduced &&
      Boolean(window.CSS?.supports?.("animation-timeline", "scroll()"));
    if (nativeSupported) {
      bar.style.removeProperty("transform");
      return;
    }

    const updateProgress = () => {
      const total = scroller.scrollHeight - scroller.clientHeight;
      const ratio =
        total <= 0 ? 1 : Math.min(1, Math.max(0, scroller.scrollTop / total));
      bar.style.transform = `scaleX(${ratio})`;
    };

    updateProgress();
    scroller.addEventListener("scroll", updateProgress, { passive: true });
    return () => scroller.removeEventListener("scroll", updateProgress);
  }, [url, article]);

  // 4. 将正文拆分为段落
  const paragraphs = useMemo(() => {
    if (!article?.content) return [];
    return article.content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [article?.content]);

  // 5. 将正文分句供 TTS 朗读
  const sentences = useMemo(() => {
    if (!article?.content) return [];
    return article.content
      .replace(/([。！？\n；!?]+)/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [article?.content]);

  const speakSentence = (index: number) => {
    if (!isPlayingRef.current || index >= sentences.length) {
      setIsPlayingTts(false);
      setIsPausedTts(false);
      isPlayingRef.current = false;
      isPausedRef.current = false;
      currentIndexRef.current = 0;
      setCurrentSentenceIndex(0);
      return;
    }

    currentIndexRef.current = index;
    setCurrentSentenceIndex(index);

    try {
      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        typeof window.SpeechSynthesisUtterance === "undefined"
      ) {
        stopTts();
        return;
      }

      const sentence = sentences[index];
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = "zh-CN";
      utterance.rate = rateRef.current;

      try {
        const voices = window.speechSynthesis.getVoices();
        const zhVoice =
          voices.find(
            (v) =>
              v.lang === "zh-CN" ||
              v.lang === "zh_CN" ||
              v.lang.toLowerCase().includes("zh-cn")
          ) || voices.find((v) => v.lang.startsWith("zh"));

        if (zhVoice) utterance.voice = zhVoice;
      } catch {
        // ignore
      }

      utterance.onend = () => {
        if (isPlayingRef.current && !isPausedRef.current) {
          speakSentence(index + 1);
        }
      };

      utterance.onerror = (e) => {
        if (
          e.error === "canceled" ||
          e.error === "interrupted" ||
          !isPlayingRef.current
        ) {
          return;
        }
        if (isPlayingRef.current && !isPausedRef.current) {
          setTimeout(() => speakSentence(index + 1), 50);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("ArticleReaderModal TTS error:", err);
      stopTts();
    }
  };

  const handlePlayTts = () => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance === "undefined"
    ) {
      setTtsNotice("当前浏览器环境未检测到语音朗读引擎");
      return;
    }
    setTtsNotice("");
    if (sentences.length === 0) return;

    try {
      if (isPausedTts) {
        if (typeof window.speechSynthesis.resume === "function") {
          window.speechSynthesis.resume();
        }
        setIsPausedTts(false);
        setIsPlayingTts(true);
        isPlayingRef.current = true;
        isPausedRef.current = false;
        return;
      }

      isPlayingRef.current = true;
      isPausedRef.current = false;
      setIsPlayingTts(true);
      setIsPausedTts(false);

      if (typeof window.speechSynthesis.cancel === "function") {
        window.speechSynthesis.cancel();
      }
      setTimeout(() => {
        if (isPlayingRef.current) {
          speakSentence(0);
        }
      }, 60);
    } catch (e) {
      console.warn("handlePlayTts error:", e);
    }
  };

  const handlePauseTts = () => {
    try {
      if (
        typeof window !== "undefined" &&
        window.speechSynthesis &&
        typeof window.speechSynthesis.pause === "function"
      ) {
        window.speechSynthesis.pause();
      }
    } catch {
      // ignore
    }
    setIsPausedTts(true);
    isPausedRef.current = true;
  };

  const handleClose = useCallback(() => {
    stopTts();
    onClose();
  }, [stopTts, onClose]);

  const displayTitle = article?.title || initialTitle || "文章详情";
  const displaySource = article?.sourceName || initialSourceName || "来源源站";
  const wordCount = article?.content?.length || 0;
  const estimatedMins = Math.max(1, Math.ceil(wordCount / 450));

  const fontSizeClass =
    fontSize === "sm"
      ? "text-sm leading-relaxed"
      : fontSize === "lg"
      ? "text-lg leading-[1.95]"
      : "text-[15px] sm:text-base leading-[1.85]";

  const fontFamilyClass = fontSerif
    ? "font-serif text-ink"
    : "font-sans text-ink-2";

  return (
    <ModalDialog
      isOpen={Boolean(url)}
      onClose={handleClose}
      closedBy="any"
      ariaLabelledBy={titleId}
      dialogRef={dialogRef}
      className="mwg-reader-shell w-full h-dvh sm:h-[min(92dvh,56rem)] max-w-4xl lg:max-w-5xl rounded-none sm:rounded-2xl shadow-2xl overflow-hidden bg-subtle"
    >
      {/* 顶部阅读进度指示线（纯装饰，使用 CSS Scroll-Driven Animation + transform 回退） */}
      <div
        aria-hidden="true"
        className="w-full bg-muted-surface h-1 absolute top-0 inset-x-0 z-20 overflow-hidden"
      >
        <div ref={progressBarRef} className="mwg-reading-progress-fill" />
      </div>

      {/* 顶部控制与标题栏 */}
      <header className="border-b border-line px-4 sm:px-6 py-3 bg-card flex items-center justify-between gap-2 sm:gap-4 shrink-0 mt-1">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-ink-muted font-mono truncate min-w-0">
          <span className="bg-subtle text-ink-2 px-2 py-0.5 rounded border border-line font-sans font-medium shrink-0">
            {displaySource}
          </span>
          <span aria-hidden="true">•</span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-ink-muted" aria-hidden="true" />
            <span>约 {estimatedMins} 分钟</span>
          </span>
          {wordCount > 0 && (
            <>
              <span className="hidden sm:inline" aria-hidden="true">
                •
              </span>
              <span className="hidden sm:inline">{wordCount} 字</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 字体样式切换 (衬线 / 黑体) */}
          <button
            type="button"
            onClick={() => setFontSerif(!fontSerif)}
            aria-pressed={fontSerif}
            className={`min-h-[30px] px-2 py-1 rounded-lg border text-xs transition-colors cursor-pointer hidden sm:inline-flex items-center gap-1 ${
              fontSerif
                ? "bg-brand-soft text-brand-ink border-brand-border font-serif font-bold"
                : "bg-card text-ink-2 border-line hover:bg-subtle"
            }`}
          >
            <Type className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{fontSerif ? "衬线" : "黑体"}</span>
          </button>

          {/* 字号调节 */}
          <div
            role="group"
            aria-label="正文字号"
            className="hidden sm:flex items-center border border-line rounded-lg p-0.5 text-xs text-ink-2 bg-subtle"
          >
            {(
              [
                { id: "sm", label: "A-", aria: "小字号" },
                { id: "base", label: "标准", aria: "标准字号" },
                { id: "lg", label: "A+", aria: "大字号" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFontSize(opt.id)}
                aria-pressed={fontSize === opt.id}
                aria-label={opt.aria}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  fontSize === opt.id
                    ? "bg-card font-bold shadow-2xs text-ink"
                    : "hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 复制原文链接 */}
          {url && (
            <CopyButton
              getText={() => url}
              ariaLabel="复制原文链接"
              className="p-1.5 text-ink-muted hover:text-ink hover:bg-subtle rounded-lg transition-colors border border-line bg-card"
            />
          )}

          {/* 打开原始网页 */}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`在原始网站打开：${displayTitle}`}
              className="min-h-[30px] px-2.5 py-1 text-xs text-ink-2 hover:text-ink hover:bg-subtle rounded-lg transition-colors inline-flex items-center gap-1 border border-line bg-card"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">源站原文</span>
            </a>
          )}

          {/* 可见关闭按钮 */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="关闭文章阅读器"
            autoFocus
            className="min-h-[32px] min-w-[32px] p-1.5 text-ink-muted hover:text-ink hover:bg-subtle rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 次顶部音频伴读条 */}
      {article?.content && (
        <div className="bg-brand-soft border-b border-brand-border/50 px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs text-brand-ink shrink-0 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Volume2 className="w-4 h-4 text-brand shrink-0" aria-hidden="true" />
            <span className="font-semibold">正文语音伴读</span>
            {isPlayingTts && (
              <span className="text-xs text-brand-ink/80 font-mono truncate">
                [{currentSentenceIndex + 1}/{sentences.length}]
              </span>
            )}
            {ttsNotice && (
              <span role="status" className="text-xs text-danger font-medium">
                {ttsNotice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isPlayingTts || isPausedTts ? (
              <button
                type="button"
                onClick={handlePlayTts}
                className="min-h-[28px] px-3 py-1 bg-action text-action-fg rounded-md font-medium text-xs hover:bg-action-hover transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Play className="w-3 h-3 fill-current" aria-hidden="true" />
                <span>{isPausedTts ? "继续" : "朗读正文"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseTts}
                className="min-h-[28px] px-3 py-1 bg-card text-brand-ink border border-brand-border rounded-md font-medium text-xs hover:bg-subtle transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Pause className="w-3 h-3 fill-current" aria-hidden="true" />
                <span>暂停</span>
              </button>
            )}

            {(isPlayingTts || isPausedTts) && (
              <button
                type="button"
                onClick={stopTts}
                aria-label="停止朗读"
                className="min-h-[28px] min-w-[28px] p-1 text-ink-2 hover:text-danger rounded cursor-pointer inline-flex items-center justify-center"
              >
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setTtsRate((prev) =>
                  prev === 1.0 ? 1.25 : prev === 1.25 ? 1.5 : 1.0
                )
              }
              aria-label={`调整朗读倍速，当前 ${ttsRate} 倍速`}
              className="min-h-[28px] font-mono text-xs px-2 py-0.5 border border-brand-border rounded text-brand-ink hover:bg-card/60 cursor-pointer transition-colors"
            >
              {ttsRate}x
            </button>
          </div>
        </div>
      )}

      {/* 内容滚动作业区（带纵向滚动阴影提示与 Scroll-Timeline 进度驱动） */}
      <div
        ref={scrollContainerRef}
        className="mwg-reader-scroll mwg-scroll-shadows flex-1 bg-card px-4 sm:px-10 lg:px-12 py-5 sm:py-8"
      >
        <div className="max-w-[68ch] mx-auto space-y-5 sm:space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-ink-muted">
              <LoadingSpinner label="正在提炼排版文章详情" size="md" />
              <p className="text-xs font-serif text-ink-muted">
                正在提炼排版文章详情...
              </p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3" role="alert">
              <AlertTriangle
                className="w-8 h-8 text-warning mx-auto"
                aria-hidden="true"
              />
              <h1 id={titleId} className="text-base text-ink font-semibold">
                未能直接获取正文
              </h1>
              <p className="text-xs text-ink-muted max-w-md mx-auto">{error}</p>
              {url && (
                <div className="pt-3">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-action text-action-fg rounded-lg text-xs font-semibold hover:bg-action-hover transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>前往原网页查看</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <article className="prose-pretty space-y-5 sm:space-y-6">
              {/* 标题区（模态框内顶层主标题使用 h1） */}
              <div className="border-b border-line pb-5 sm:pb-6 space-y-2.5">
                <h1
                  id={titleId}
                  className="font-serif-title editorial-title font-bold text-ink tracking-tight"
                >
                  {displayTitle}
                </h1>

                <div className="flex items-center gap-3 text-xs text-ink-muted font-mono flex-wrap">
                  {article?.author && (
                    <span className="flex items-center gap-1 text-ink-2">
                      <User
                        className="w-3 h-3 text-ink-muted"
                        aria-hidden="true"
                      />
                      <span>{article.author}</span>
                    </span>
                  )}
                  {article?.publishedAt && (
                    <time dateTime={article.publishedAt}>
                      发布于{" "}
                      {new Date(article.publishedAt).toLocaleDateString("zh-CN")}
                    </time>
                  )}
                  <span className="bg-subtle text-ink-2 px-1.5 py-0.5 rounded border border-line text-xs">
                    {article?.isFullText ? "全文提取就绪" : "摘要预览模式"}
                  </span>
                  <span className="text-ink-muted font-sans hidden sm:inline">
                    · 按 J / K 可上下翻动
                  </span>
                </div>
              </div>

              {/* 正文段落区 */}
              <div
                className={`space-y-4 text-start ${fontFamilyClass} ${fontSizeClass}`}
              >
                {paragraphs.map((para, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              {/* 若非完全全文，显示提示与直达按钮 */}
              {!article?.isFullText && url && (
                <div className="bg-brand-soft border border-brand-border/60 rounded-xl p-4 text-xs text-brand-ink space-y-2 mt-6">
                  <div className="font-semibold flex items-center gap-1.5">
                    <BookOpen
                      className="w-3.5 h-3.5 text-brand"
                      aria-hidden="true"
                    />
                    <span>
                      提示：当前源站仅提供摘要预览或正文受防爬虫机制保护
                    </span>
                  </div>
                  <p className="text-ink-2 leading-relaxed">
                    如需查看原始图片、完整代码块或读者互动评论，可直接点击下方链接直达源网站。
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand hover:text-brand-hover hover:underline pt-1"
                  >
                    <span>在源站阅读完整图文正文</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              )}
            </article>
          )}
        </div>
      </div>

      {/* 底部信息与外链操作 */}
      <footer className="border-t border-line px-4 sm:px-6 py-2.5 sm:py-3 bg-subtle flex items-center justify-between gap-4 text-xs text-ink-muted shrink-0">
        <span className="truncate max-w-sm font-mono text-xs text-ink-muted">
          {url}
        </span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-ink-2 hover:text-brand font-medium transition-colors shrink-0"
          >
            <span>访问源网页</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        )}
      </footer>
    </ModalDialog>
  );
}
