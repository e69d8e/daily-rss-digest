"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  Volume2,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";
import { isAnyModalOpen } from "@/lib/modalStack";

interface TtsPlayerProps {
  audioText: string;
  title: string;
}

export default function TtsPlayer({ audioText, title }: TtsPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [supported, setSupported] = useState(true);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isMainCardOutOfView, setIsMainCardOutOfView] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

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
    return Math.max(30, Math.round((totalChars / 240) * 60 / rate));
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
          if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === "function") {
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
      // 卸载时清理语音列表回调，避免指向已销毁的旧闭包
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

  useEffect(() => {
    handleStop();
  }, [audioText]);

  // 全局空格键监听：播放 / 暂停
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // 焦点在交互元素上时空格交给浏览器默认行为（激活按钮/链接）
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // 弹窗（阅读器/确认框/帮助面板等）打开时不接管空格，避免误触背景语音
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
      if (window.speechSynthesis && typeof window.speechSynthesis.pause === "function") {
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

  const toggleRate = () => {
    const nextRates = [1.0, 1.25, 1.5];
    const currentIndex = nextRates.indexOf(rate);
    const nextRate = nextRates[(currentIndex + 1) % nextRates.length];
    setRate(nextRate);
    rateRef.current = nextRate;

    if (isPlaying) {
      try {
        if (window.speechSynthesis && typeof window.speechSynthesis.cancel === "function") {
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

  const progress =
    sentences.length > 0
      ? Math.round(((currentSentenceIndex + 1) / sentences.length) * 100)
      : 0;

  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!supported) {
    return (
      <div className="p-3 bg-stone-100 rounded-lg text-xs text-stone-500">
        当前浏览器环境未检测到 Web Speech 语音播放引擎。
      </div>
    );
  }

  return (
    <>
      {/* 主播放器卡片 */}
      <div
        ref={containerRef}
        className="rounded-2xl border border-[#eae6df] bg-[#faf9f6] p-4 sm:p-5 shadow-2xs space-y-3.5 transition-all duration-200"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* 左侧：播放按钮 + 标题与波形动效 */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="w-11 h-11 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-amber-800 transition-all shrink-0 shadow-sm cursor-pointer hover:scale-105 active:scale-95"
              title={isPlaying ? "暂停播报 (Space)" : isPaused ? "继续播报 (Space)" : "开始听晨报 (Space)"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-[13px] font-bold text-stone-900 truncate">
                  {title || "今日智汇晨报"}
                </span>

                {isPlaying && (
                  <div className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-900 bg-amber-100/80 border border-amber-300/80 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 animate-pulse">
                    {/* 跳动音频波形指示条 */}
                    <div className="flex items-center gap-0.5 h-2.5">
                      <span className="w-0.5 h-full bg-amber-700 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-0.5 h-2 bg-amber-700 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-0.5 h-full bg-amber-700 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span>
                      播报中 ({currentSentenceIndex + 1}/{sentences.length})
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-stone-400 font-mono flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-amber-700" />
                  <span>AI 语音晨报</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>约 {formatTime(estimatedSeconds)}</span>
                </span>
                <span>•</span>
                <span>共 {sentences.length} 句</span>
                <span className="hidden sm:inline text-stone-300">•</span>
                <span className="hidden sm:inline text-stone-400 font-sans">按空格键启停</span>
              </div>
            </div>
          </div>

          {/* 右侧：语速调节 + 播音文稿展开 (自适应布局) */}
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#eae6df]/60 sm:ml-auto">
            {/* 语速 */}
            <button
              onClick={toggleRate}
              className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg border border-[#eae6df] bg-white text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
              title="调节朗读倍速"
            >
              {rate}x
            </button>

            {/* 停止按钮 */}
            {(isPlaying || isPaused) && (
              <button
                onClick={handleStop}
                className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg border border-[#eae6df] bg-white hover:bg-stone-100 transition-colors cursor-pointer shadow-2xs"
                title="停止播放"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            {/* 查看播音文稿 */}
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg border transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                showTranscript
                  ? "bg-amber-50 border-amber-300 text-amber-900"
                  : "bg-white border-[#eae6df] text-stone-600 hover:text-stone-900 hover:border-stone-400"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showTranscript ? "收起文稿" : "播音文稿"}</span>
            </button>
          </div>
        </div>

        {/* 进度条 */}
        {progress > 0 && (
          <div className="w-full bg-stone-200/80 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-800 h-full transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* 展开的播报文稿实录（卡拉OK式高亮） */}
        {showTranscript && (
          <div
            ref={transcriptRef}
            className="mt-2 p-4 bg-white rounded-xl border border-[#eae6df] text-xs leading-relaxed text-stone-700 font-sans max-h-60 overflow-y-auto space-y-2 animate-in fade-in"
          >
            <div className="font-semibold text-stone-900 pb-2 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-800" />
                <span>播报文稿实录（共 {sentences.length} 句）：</span>
              </div>
              {isPlaying && (
                <span className="text-[11px] font-mono text-amber-800">
                  朗读中: 第 {currentSentenceIndex + 1} 句
                </span>
              )}
            </div>

            <div className="leading-relaxed">
              {sentences.map((sentence, idx) => {
                const isCurrent = isPlaying && currentSentenceIndex === idx;
                return (
                  <span
                    key={idx}
                    onClick={() => {
                      if (isPlayingRef.current) {
                        speakSentence(idx);
                      }
                    }}
                    className={`inline-block mr-1 my-0.5 px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                      isCurrent
                        ? "bg-amber-100 text-amber-950 font-semibold ring-1 ring-amber-300"
                        : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                    }`}
                    title="点击跳转至此句朗读"
                  >
                    {sentence}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部随行迷你播放条（Docked Sticky Mini-Player）：当主播放器滚出视口且正在播放时浮现 */}
      {isMainCardOutOfView && (isPlaying || isPaused) && (
        <div className="fixed bottom-4 inset-x-0 mx-auto max-w-lg z-40 px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-stone-950/95 text-white rounded-2xl shadow-2xl border border-stone-700/60 p-2.5 px-4 flex items-center justify-between gap-3 backdrop-blur-md">
            {/* 播放 / 暂停 */}
            <button
              onClick={isPlaying ? handlePause : handlePlay}
              className="w-8 h-8 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center hover:bg-amber-400 transition-colors shrink-0 cursor-pointer shadow-xs"
              title={isPlaying ? "暂停" : "继续"}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              )}
            </button>

            {/* 当前朗读句与标题 */}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={scrollToTop}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-200 truncate">
                  {title || "智汇晨报"}
                </span>
                <span className="text-[10px] font-mono text-amber-400 shrink-0">
                  {currentSentenceIndex + 1}/{sentences.length}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate mt-0.5">
                {sentences[currentSentenceIndex] || "正在播放语音晨报..."}
              </p>
            </div>

            {/* 右侧：语速与回顶操作 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleRate}
                className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 hover:text-white transition-colors cursor-pointer"
                title="调节语速"
              >
                {rate}x
              </button>
              <button
                onClick={scrollToTop}
                className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
                title="回到播放器卡片位置"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
