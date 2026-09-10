"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  ExternalLink,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Clock,
  User,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");

  // TTS 状态
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [isPausedTts, setIsPausedTts] = useState(false);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  // 1. 请求文章正文详情
  useEffect(() => {
    if (!url) {
      setArticle(null);
      return;
    }

    setLoading(true);
    setError(null);
    setIsPlayingTts(false);
    setIsPausedTts(false);

    const encoded = encodeURIComponent(url);
    fetch(`/api/articles/detail?url=${encoded}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "获取正文失败");
        }
        return res.json();
      })
      .then((data: ArticleDetail) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("加载文章失败:", err);
        setError(err.message || "正文加载异常");
        setLoading(false);
      });
  }, [url]);

  // 2. 键盘 ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 3. 将正文拆分为段落
  const paragraphs = useMemo(() => {
    if (!article?.content) return [];
    return article.content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }, [article?.content]);

  // 4. 将正文分句供 TTS 朗读
  const sentences = useMemo(() => {
    if (!article?.content) return [];
    return article.content
      .replace(/([。！？\n；!?]+)/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [article?.content]);

  // TTS 播报引擎控制器
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const rateRef = useRef(ttsRate);
  rateRef.current = ttsRate;

  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
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
    };
  }, []);

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
        setIsPlayingTts(false);
        setIsPausedTts(false);
        isPlayingRef.current = false;
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

        if (zhVoice) {
          utterance.voice = zhVoice;
        }
      } catch {
        // ignore voice selection error
      }

      utterance.onend = () => {
        if (isPlayingRef.current && !isPausedRef.current) {
          speakSentence(index + 1);
        }
      };

      utterance.onerror = (e) => {
        if (e.error === "canceled" || e.error === "interrupted" || !isPlayingRef.current) {
          return;
        }
        if (isPlayingRef.current && !isPausedRef.current) {
          setTimeout(() => speakSentence(index + 1), 50);
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("ArticleReaderModal TTS error:", err);
      setIsPlayingTts(false);
      setIsPausedTts(false);
      isPlayingRef.current = false;
    }
  };

  const handlePlayTts = () => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !window.speechSynthesis ||
      typeof window.SpeechSynthesisUtterance === "undefined"
    ) {
      alert("当前浏览器暂不支持语音朗读");
      return;
    }
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
      if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.pause === "function") {
        window.speechSynthesis.pause();
      }
    } catch {
      // ignore
    }
    setIsPausedTts(true);
    isPausedRef.current = true;
  };

  const handleStopTts = () => {
    isPlayingRef.current = false;
    isPausedRef.current = false;
    try {
      if (typeof window !== "undefined" && window.speechSynthesis && typeof window.speechSynthesis.cancel === "function") {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
    setIsPlayingTts(false);
    setIsPausedTts(false);
    setCurrentSentenceIndex(0);
    currentIndexRef.current = 0;
  };

  if (!url) return null;

  const displayTitle = article?.title || initialTitle || "文章详情";
  const displaySource = article?.sourceName || initialSourceName || "来源源站";
  const wordCount = article?.content?.length || 0;
  const estimatedMins = Math.max(1, Math.ceil(wordCount / 450));

  const fontSizeClass =
    fontSize === "sm"
      ? "text-sm leading-relaxed"
      : fontSize === "lg"
      ? "text-lg leading-[1.9]"
      : "text-[15px] sm:text-base leading-[1.85]";

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleStopTts();
          onClose();
        }
      }}
    >
      <div className="bg-[#fcfbf9] w-full h-full sm:h-auto max-w-4xl lg:max-w-5xl sm:max-h-[92vh] rounded-none sm:rounded-2xl border-0 sm:border border-[#eae6df] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* 顶部控制与标题栏 */}
        <div className="border-b border-[#eae6df] px-4 sm:px-6 py-3 sm:py-4 bg-white flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-stone-500 font-mono truncate">
            <span className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-sans font-medium shrink-0">
              {displaySource}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3 text-stone-400" />
              约 {estimatedMins} 分钟
            </span>
            {wordCount > 0 && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">{wordCount} 字</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 字号调节 */}
            <div className="hidden sm:flex items-center border border-[#eae6df] rounded-lg p-0.5 text-xs text-stone-600 bg-stone-50">
              <button
                onClick={() => setFontSize("sm")}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  fontSize === "sm" ? "bg-white font-bold shadow-xs text-stone-900" : "hover:text-stone-900"
                }`}
                title="小字号"
              >
                A-
              </button>
              <button
                onClick={() => setFontSize("base")}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  fontSize === "base" ? "bg-white font-bold shadow-xs text-stone-900" : "hover:text-stone-900"
                }`}
                title="默认字号"
              >
                标准
              </button>
              <button
                onClick={() => setFontSize("lg")}
                className={`px-2 py-0.5 rounded cursor-pointer ${
                  fontSize === "lg" ? "bg-white font-bold shadow-xs text-stone-900" : "hover:text-stone-900"
                }`}
                title="大字号"
              >
                A+
              </button>
            </div>

            {/* 打开原始网页 */}
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 text-xs text-stone-600 hover:text-stone-950 hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1 border border-stone-200"
              title="在原始网站打开"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">源站原文</span>
            </a>

            {/* 关闭按钮 */}
            <button
              onClick={() => {
                handleStopTts();
                onClose();
              }}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="关闭 (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 次顶部音频播报操作条 */}
        {article?.content && (
          <div className="bg-amber-50/70 border-b border-amber-200/50 px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3 text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-medium">正文语音伴读</span>
              {isPlayingTts && (
                <span className="text-[11px] text-amber-700/80 font-mono">
                  [{currentSentenceIndex + 1}/{sentences.length}]
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isPlayingTts || isPausedTts ? (
                <button
                  onClick={handlePlayTts}
                  className="px-3 py-1 bg-stone-900 text-white rounded-md font-medium text-xs hover:bg-amber-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isPausedTts ? "继续" : "朗读正文"}</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseTts}
                  className="px-3 py-1 bg-amber-200 text-amber-900 rounded-md font-medium text-xs hover:bg-amber-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3 h-3 fill-current" />
                  <span>暂停</span>
                </button>
              )}

              {(isPlayingTts || isPausedTts) && (
                <button
                  onClick={handleStopTts}
                  className="p-1 text-stone-500 hover:text-rose-600 rounded cursor-pointer"
                  title="停止朗读"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button
                onClick={() =>
                  setTtsRate((prev) => (prev === 1.0 ? 1.25 : prev === 1.25 ? 1.5 : 1.0))
                }
                className="font-mono text-[11px] px-1.5 py-0.5 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 cursor-pointer"
                title="调整朗读倍速"
              >
                {ttsRate}x
              </button>
            </div>
          </div>
        )}

        {/* 内容滚动作业区 */}
        <div className="overflow-y-auto px-4 sm:px-10 lg:px-12 py-5 sm:py-8 space-y-5 sm:space-y-6 flex-1 bg-white">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-700" />
              <p className="text-xs font-serif">正在提取并解析文章详情...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
              <p className="text-sm text-stone-700 font-medium">未能直接获取正文</p>
              <p className="text-xs text-stone-400 max-w-md mx-auto">{error}</p>
              <div className="pt-3">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors inline-flex items-center gap-1.5"
                >
                  前往原网页查看 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <>
              {/* 标题区 */}
              <div className="border-b border-[#eae6df] pb-5 sm:pb-6 space-y-2.5">
                <h1 className="font-serif-title text-xl sm:text-2xl lg:text-3xl font-bold text-stone-950 tracking-tight leading-snug">
                  {displayTitle}
                </h1>

                <div className="flex items-center gap-3 text-xs text-stone-400 font-mono flex-wrap">
                  {article?.author && (
                    <span className="flex items-center gap-1 text-stone-600">
                      <User className="w-3 h-3 text-stone-400" />
                      {article.author}
                    </span>
                  )}
                  {article?.publishedAt && (
                    <span>
                      发布于 {new Date(article.publishedAt).toLocaleDateString("zh-CN")}
                    </span>
                  )}
                  <span className="bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded text-[11px]">
                    {article?.isFullText ? "全文提取就绪" : "摘要模式"}
                  </span>
                </div>
              </div>

              {/* 正文段落区 */}
              <div className={`text-stone-800 font-sans space-y-4 text-justify ${fontSizeClass}`}>
                {paragraphs.map((para, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>

              {/* 若非完全全文，显示温馨提示并提供直通链接 */}
              {!article?.isFullText && (
                <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 space-y-2">
                  <div className="font-medium flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                    <span>提示：当前源站仅提供摘要预览或受页面反爬限制</span>
                  </div>
                  <p className="text-stone-600 leading-relaxed">
                    如需查看图文排版、完整代码或评论，可直接点击下方按钮直达源网站。
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 hover:underline pt-1"
                  >
                    在源站阅读完整正文 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部信息与外链操作 */}
        <div className="border-t border-[#eae6df] px-4 sm:px-6 py-2.5 sm:py-3 bg-stone-50 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span className="truncate max-w-sm font-mono text-[11px] text-stone-400">
            {url}
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-stone-700 hover:text-amber-800 font-medium transition-colors"
          >
            <span>访问源网页</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
