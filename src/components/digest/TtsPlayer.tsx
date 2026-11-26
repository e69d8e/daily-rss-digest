"use client";

import { useState, useEffect, useRef, useMemo, useId } from "react";
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  Volume2,
  ChevronUp,
  FileText,
  Clock,
} from "lucide-react";
import { isAnyModalOpen } from "@/lib/modalStack";

interface TtsPlayerProps {
  audioText: string;
  title: string;
}

export default function TtsPlayer({ audioText, title }: TtsPlayerProps) {
  const transcriptId = useId();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [supported, setSupported] = useState(true);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptHidden, setTranscriptHidden] = useState(true);
  const [isMainCardOutOfView, setIsMainCardOutOfView] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const expandableRef = useRef<HTMLDivElement>(null);

  // 智能按标点分句，解决 15 秒静音 Bug 并支持单句高亮
  const sentences = useMemo(() => {
    if (!audioText) return [];
    return audioText
      .replace(/([。！？\n；!?]+)/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [audioText]);

  // 预计收听时间 (每分钟约 240 字)
  const estimatedSeconds = useMemo(() => {
    const totalChars = audioText.length;
    return Math.max(30, Math.round(((totalChars / 240) * 60) / rate));
  }, [audioText, rate]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}分${s > 0 ? `${s}秒` : ""}` : `${s}秒`;
  };

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  // 折叠面板固有尺寸过渡与 hidden 状态同步（确保收起后移出无障碍树与 Tab 顺序）
  const toggleTranscript = () => {
    if (!showTranscript) {
      setTranscriptHidden(false);
      requestAnimationFrame(() => {
        setShowTranscript(true);
      });
    } else {
      setShowTranscript(false);
      const el = expandableRef.current;
      if (!el) {
        setTranscriptHidden(true);
        return;
      }
      requestAnimationFrame(() => {
        const transitions = el
          .getAnimations()
          .filter((a) => a instanceof CSSTransition);
        if (transitions.length === 0) {
          setTranscriptHidden(true);
          return;
        }
        void Promise.allSettled(transitions.map((t) => t.finished)).then(() => {
          if (el.getAttribute("data-open") !== "true") {
            setTranscriptHidden(true);
          }
        });
      });
    }
  };

  // 监控主播放器是否滚出视口
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainCardOutOfView(!entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Web Speech API 初始化
  useEffect(() => {
    try {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        !window.speechSynthesis ||
        typeof window.speechSynthesis.getVoices !== "function" ||
        typeof window.SpeechSynthesisUtterance === "undefined"
      ) {
        setSupported(false);
        return;
      }

      const loadVoices = () => {
        try {
          if (
            window.speechSynthesis &&
            typeof window.speechSynthesis.getVoices === "function"
          ) {
            window.speechSynthesis.getVoices();
          }
        } catch {
          // ignore
        }
      };

      loadVoices();
      if ("onvoiceschanged" in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    } catch (err) {
      console.warn("Web Speech API 初始化失败:", err);
      setSupported(false);
    }

    return () => {
      try {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      } catch {
        // ignore
      }
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

  const handleStop = () => {
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
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
    currentIndexRef.current = 0;
  };

  useEffect(() => {
    handleStop();
  }, [audioText]);

  const speakSentence = (index: number) => {
    if (!isPlayingRef.current || index >= sentences.length) {
      setIsPlaying(false);
      setIsPaused(false);
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
        setSupported(false);
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
        // ignore
      }

      utterance.onend = () => {
        if (isPlayingRef.current && !isPausedRef.current) {
          speakSentence(index + 1);
        }
      };

      utterance.onerror = (event) => {
        if (
          event.error === "canceled" ||
          event.error === "interrupted" ||
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
      console.warn("TTS 播放出错:", err);
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
    }
  };

  const handlePlay = () => {
    if (!supported || sentences.length === 0) return;

    try {
      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        typeof window.speechSynthesis.speak !== "function"
      ) {
        setSupported(false);
        return;
      }

      if (isPaused) {
        if (typeof window.speechSynthesis.resume === "function") {
          window.speechSynthesis.resume();
        }
        setIsPaused(false);
        setIsPlaying(true);
        isPlayingRef.current = true;
        isPausedRef.current = false;

        setTimeout(() => {
          if (!window.speechSynthesis?.speaking && isPlayingRef.current) {
            speakSentence(currentIndexRef.current);
          }
        }, 100);
        return;
      }

      isPlayingRef.current = true;
      isPausedRef.current = false;
      setIsPlaying(true);
      setIsPaused(false);

      if (typeof window.speechSynthesis.cancel === "function") {
        window.speechSynthesis.cancel();
      }
      setTimeout(() => {
        if (isPlayingRef.current) {
          speakSentence(0);
        }
      }, 60);
    } catch (err) {
      console.warn("TTS handlePlay error:", err);
      setSupported(false);
    }
  };

  const handlePause = () => {
    if (!supported) return;
    try {
      if (
        window.speechSynthesis &&
        typeof window.speechSynthesis.pause === "function"
      ) {
        window.speechSynthesis.pause();
      }
    } catch {
      // ignore
    }
    setIsPaused(true);
    setIsPlaying(false);
    isPlayingRef.current = false;
    isPausedRef.current = true;
  };

  // 全局空格键监听：播放 / 暂停
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !target ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.tagName === "SELECT" ||
        target.tagName === "SUMMARY" ||
        target.isContentEditable
      ) {
        return;
      }

      if (isAnyModalOpen()) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlayingRef.current) {
          handlePause();
        } else {
          handlePlay();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPaused]);

  const toggleRate = () => {
    const nextRates = [1.0, 1.25, 1.5];
    const currentIndex = nextRates.indexOf(rate);
    const nextRate = nextRates[(currentIndex + 1) % nextRates.length];
    setRate(nextRate);
    rateRef.current = nextRate;

    if (isPlaying) {
      try {
        if (
          window.speechSynthesis &&
          typeof window.speechSynthesis.cancel === "function"
        ) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore
      }
      setTimeout(() => {
        if (isPlayingRef.current) {
          speakSentence(currentIndexRef.current);
        }
      }, 60);
    }
  };

  const handleJumpToSentence = (idx: number) => {
    if (!supported) return;
    isPlayingRef.current = true;
    isPausedRef.current = false;
    setIsPlaying(true);
    setIsPaused(false);
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (isPlayingRef.current) {
        speakSentence(idx);
      }
    }, 40);
  };

  const scrollToTop = () => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = prefersReduced ? "auto" : "smooth";
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior, block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior });
    }
  };

  if (!supported) {
    return (
      <div className="p-3 bg-subtle border border-line rounded-xl text-xs text-ink-muted">
        当前浏览器环境未检测到 Web Speech 语音播放引擎。
      </div>
    );
  }

  return (
    <>
      {/* 主播放器卡片 */}
      <section
        ref={containerRef}
        aria-label="语音晨报播放器"
        className="rounded-2xl border border-line bg-subtle p-4 sm:p-5 shadow-2xs space-y-3.5 transition-colors duration-200"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* 左侧：播放按钮 + 标题与波形动效 */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={isPlaying ? handlePause : handlePlay}
              aria-label={
                isPlaying
                  ? "暂停播报"
                  : isPaused
                  ? "继续播报"
                  : "开始听晨报"
              }
              title={
                isPlaying
                  ? "暂停播报 (Space)"
                  : isPaused
                  ? "继续播报 (Space)"
                  : "开始听晨报 (Space)"
              }
              className="w-11 h-11 rounded-full bg-action text-action-fg flex items-center justify-center hover:bg-action-hover transition-colors motion-safe:hover:scale-105 motion-safe:active:scale-95 shrink-0 shadow-sm cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
              ) : (
                <Play
                  className="w-4 h-4 fill-current ms-0.5"
                  aria-hidden="true"
                />
              )}
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-ink truncate">
                  {title || "今日智汇晨报"}
                </span>

                {isPlaying && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-brand-ink bg-brand-soft border border-brand-border px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                    <span
                      className="flex items-center gap-0.5 h-2.5"
                      aria-hidden="true"
                    >
                      <span
                        className="w-0.5 h-full bg-brand motion-safe:animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-0.5 h-2 bg-brand motion-safe:animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-0.5 h-full bg-brand motion-safe:animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </span>
                    <span>
                      播报中 ({currentSentenceIndex + 1}/{sentences.length})
                    </span>
                  </span>
                )}
              </div>

              <div className="text-xs text-ink-muted font-mono flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Volume2
                    className="w-3.5 h-3.5 text-brand"
                    aria-hidden="true"
                  />
                  <span>AI 语音晨报</span>
                </span>
                <span aria-hidden="true">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>约 {formatTime(estimatedSeconds)}</span>
                </span>
                <span aria-hidden="true">•</span>
                <span>共 {sentences.length} 句</span>
                <span
                  className="hidden sm:inline text-line-strong"
                  aria-hidden="true"
                >
                  •
                </span>
                <span className="hidden sm:inline text-ink-muted font-sans">
                  按空格键启停
                </span>
              </div>
            </div>
          </div>

          {/* 右侧：语速调节 + 停止 + 播音文稿展开 */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-line sm:ms-auto">
            <button
              type="button"
              onClick={toggleRate}
              aria-label={`调节朗读倍速，当前 ${rate} 倍速`}
              className="min-h-[30px] px-2.5 py-1 text-xs font-mono font-medium rounded-lg border border-line bg-card text-ink-2 hover:text-ink hover:bg-muted-surface transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
            >
              {rate}x
            </button>

            {(isPlaying || isPaused) && (
              <button
                type="button"
                onClick={handleStop}
                aria-label="停止播放"
                className="min-h-[30px] min-w-[30px] p-1.5 text-ink-muted hover:text-danger rounded-lg border border-line bg-card hover:bg-danger-soft transition-colors cursor-pointer shadow-2xs inline-flex items-center justify-center"
              >
                <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleTranscript}
              aria-expanded={showTranscript}
              aria-controls={transcriptId}
              className={`min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer shadow-2xs ${
                showTranscript
                  ? "bg-brand-soft border-brand-border text-brand-ink"
                  : "bg-card border-line text-ink-2 hover:text-ink hover:border-line-strong"
              }`}
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{showTranscript ? "收起文稿" : "播音文稿"}</span>
            </button>
          </div>
        </div>

        {/* 原生 <progress> 播报进度条 */}
        {sentences.length > 0 && (isPlaying || isPaused || currentSentenceIndex > 0) && (
          <progress
            className="mwg-progress"
            value={currentSentenceIndex + 1}
            max={sentences.length}
            aria-label={`语音晨报播报进度，第 ${currentSentenceIndex + 1} 句，共 ${sentences.length} 句`}
          />
        )}

        {/* 展开的播报文稿实录（固有尺寸平滑展开 + 语义按钮单句跳转） */}
        <div
          ref={expandableRef}
          id={transcriptId}
          hidden={transcriptHidden}
          data-open={showTranscript ? "true" : "false"}
          className="mwg-expandable"
        >
          <div className="mt-2 p-4 bg-card rounded-xl border border-line text-xs leading-relaxed text-ink-2 font-sans max-h-60 overflow-y-auto space-y-2">
            <div className="font-semibold text-ink pb-2 border-b border-line flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-brand"
                  aria-hidden="true"
                />
                <span>播报文稿实录（共 {sentences.length} 句，点击任意句可跳播）：</span>
              </div>
              {isPlaying && (
                <span className="text-xs font-mono text-brand shrink-0">
                  第 {currentSentenceIndex + 1} 句
                </span>
              )}
            </div>

            <div className="leading-relaxed flex flex-wrap gap-1">
              {sentences.map((sentence, idx) => {
                const isCurrent = isPlaying && currentSentenceIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleJumpToSentence(idx)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={`text-start px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                      isCurrent
                        ? "bg-brand-soft text-brand-ink font-semibold ring-1 ring-brand-border"
                        : "text-ink-2 hover:text-ink hover:bg-subtle"
                    }`}
                  >
                    {sentence}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 底部随行迷你播放条（Docked Sticky Mini-Player） */}
      {isMainCardOutOfView && (isPlaying || isPaused) && (
        <aside
          aria-label="迷你语音播放器"
          className="fixed bottom-4 inset-x-0 mx-auto max-w-lg z-40 px-4 motion-safe:animate-in motion-safe:slide-in-from-bottom-5 duration-200"
        >
          <div className="bg-inverted/95 text-inverted-fg rounded-2xl shadow-2xl border border-inverted-line p-2.5 px-4 flex items-center justify-between gap-3 backdrop-blur-md">
            <button
              type="button"
              onClick={isPlaying ? handlePause : handlePlay}
              aria-label={isPlaying ? "暂停语音播报" : "继续语音播报"}
              className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center hover:bg-amber-400 transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              ) : (
                <Play
                  className="w-3.5 h-3.5 fill-current ms-0.5"
                  aria-hidden="true"
                />
              )}
            </button>

            <button
              type="button"
              onClick={scrollToTop}
              className="min-w-0 flex-1 text-start cursor-pointer rounded-md"
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-medium text-inverted-fg truncate">
                  {title || "智汇晨报"}
                </span>
                <span className="text-[11px] font-mono text-amber-400 shrink-0">
                  {currentSentenceIndex + 1}/{sentences.length}
                </span>
              </span>
              <span className="block text-xs text-inverted-muted truncate mt-0.5">
                {sentences[currentSentenceIndex] || "正在播放语音晨报..."}
              </span>
            </button>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggleRate}
                aria-label={`调节倍速，当前 ${rate} 倍速`}
                className="font-mono text-xs px-2 py-1 rounded bg-white/10 text-inverted-fg hover:bg-white/20 transition-colors cursor-pointer"
              >
                {rate}x
              </button>
              <button
                type="button"
                onClick={scrollToTop}
                aria-label="回到主播放器位置"
                className="min-h-[28px] min-w-[28px] p-1 rounded-md text-inverted-muted hover:text-inverted-fg hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center justify-center"
              >
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
