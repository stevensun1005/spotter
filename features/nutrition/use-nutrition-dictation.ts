"use client";

import { useEffect, useRef, useState } from "react";

interface Recognition {
  lang: string;
  onresult: ((event: { results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

function detach(recognition: Recognition) {
  recognition.onresult = recognition.onerror = recognition.onend = null;
}

export function useNutritionDictation(onText: (text: string) => void, active = true) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<Recognition | undefined>(undefined);
  const receiveText = useRef(onText);
  useEffect(() => { receiveText.current = onText; }, [onText]);
  useEffect(() => {
    if (!active) return;
    return () => {
      const recognition = current.current;
      current.current = undefined;
      setListening(false);
      setError("");
      if (recognition) {
        detach(recognition);
        try { recognition.abort(); } catch { /* The browser may have ended this session. */ }
      }
    };
  }, [active]);

  function end(recognition: Recognition) {
    if (current.current !== recognition) return;
    current.current = undefined;
    detach(recognition);
    setListening(false);
  }

  function toggle() {
    if (!active) return;
    if (current.current) {
      const recognition = current.current;
      try { recognition.stop(); } catch { end(recognition); }
      return;
    }
    const browser = window as SpeechWindow;
    const Speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Speech) {
      setError("可用手机键盘的听写功能，或直接输入。");
      return;
    }
    try {
      const recognition = new Speech();
      current.current = recognition;
      recognition.lang = "zh-CN";
      recognition.onresult = (event) => {
        if (current.current !== recognition) return;
        const text = (event.results[0]?.[0]?.transcript ?? "").trim().replace(/[。！？!?]$/u, "");
        if (text) receiveText.current(text);
      };
      recognition.onerror = (event) => {
        if (current.current !== recognition) return;
        setError(event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "麦克风权限未开启，可用键盘听写或手动输入。"
          : "未能听清，请重试、使用键盘听写或直接输入。");
        end(recognition);
      };
      recognition.onend = () => end(recognition);
      setError("");
      setListening(true);
      recognition.start();
    } catch {
      if (current.current) end(current.current);
      setError("此浏览器无法启动听写，可用键盘听写或直接输入。");
    }
  }

  return { listening: active && listening, error: active ? error : "", toggle };
}
