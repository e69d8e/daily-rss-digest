"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Pause, CheckCircle2 } from "lucide-react";

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

  // 智能按标点分句，解决 15 秒静音 Bug 并支持单句高亮
  const sentences = useMemo(() => {
    if (!audioText) return [];
    return audioText
      .replace(/([。！？\n；!?]+)/g, "$1|")
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [audioText]);

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentIndexRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

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
          // ignore voice loading error
        }
      };

      loadVoices();
      try {
        if ("onvoiceschanged" in window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = loadVoices;
        }
      } catch {
        // ignore listener attachment error
      }
    } catch (err) {
      console.warn("Web Speech API 初始化失败:", err);
      setSupported(false);
    }

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
        // ignore voice selection error
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

        console.warn(`TTS 播报跳过句 [${index}]: ${event.error || "未知原因"}`);
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

  if (!supported) {
    return (
      <div className="p-3 bg-stone-100 rounded-lg text-xs text-stone-500">
        当前浏览器环境未检测到 Web Speech 语音播放引擎。
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#eae6df] bg-[#faf9f6] p-3.5 sm:p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        {/* 左侧：圆形播放/暂停主按钮 + 标题与进度状态 */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={isPlaying ? handlePause : handlePlay}
            className="w-10 h-10 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-amber-800 transition-colors shrink-0 shadow-xs cursor-pointer"
            title={isPlaying ? "暂停播报" : isPaused ? "继续播报" : "开始听晨报"}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-stone-900 truncate">
                {title || "今日智汇晨报"}
              </span>

              {isPlaying && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-900 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
                  <span>
                    播报中 ({currentSentenceIndex + 1}/{sentences.length})
                  </span>
                </span>
              )}
            </div>

            <div className="text-[11px] text-stone-400 font-mono mt-0.5 whitespace-nowrap">
              AI 语音晨报 · 共 {sentences.length} 句
            </div>
          </div>
        </div>

        {/* 右侧：语速切换 + 停止按钮 + 查看文稿 (移动端自适应右对齐) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#eae6df]/60 sm:ml-auto">
          {/* 语速 */}
          <button
            onClick={toggleRate}
            className="px-2 py-1 text-xs font-mono font-medium rounded-md border border-[#eae6df] bg-white text-stone-700 hover:bg-stone-100 transition-colors whitespace-nowrap cursor-pointer"
            title="调节语速"
          >
            {rate}x
          </button>

          {/* 查看播音稿 */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="px-2.5 py-1 text-xs font-medium text-stone-600 hover:text-stone-950 rounded-md border border-transparent hover:border-[#eae6df] hover:bg-white transition-all whitespace-nowrap cursor-pointer"
          >
            {showTranscript ? "收起文稿" : "播音文稿"}
          </button>
        </div>
      </div>

      {/* 进度条 */}
      {progress > 0 && (
        <div className="w-full bg-stone-200/80 h-1 rounded-full overflow-hidden">
          <div
            className="bg-stone-900 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* 展开的播报文稿实录（高亮当前单句） */}
      {showTranscript && (
        <div className="mt-2 p-3 bg-white rounded-lg border border-[#eae6df] text-xs leading-relaxed text-stone-700 font-sans">
          <div className="font-semibold text-stone-900 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-800" />
              <span>播报文稿实录（共 {sentences.length} 句）：</span>
            </div>
            {isPlaying && (
              <span className="text-[11px] font-mono text-amber-800">
                正在朗读第 {currentSentenceIndex + 1} 句
              </span>
            )}
          </div>
          <div className="space-y-1">
            {sentences.map((sentence, idx) => {
              const isCurrent = isPlaying && currentSentenceIndex === idx;
              return (
                <span
                  key={idx}
                  className={`inline mr-1 transition-colors px-1 py-0.5 rounded ${
                    isCurrent
                      ? "bg-amber-100 text-amber-950 font-medium"
                      : "text-stone-600"
                  }`}
                >
                  {sentence}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
