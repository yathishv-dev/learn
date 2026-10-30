"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/types";
import { translator } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useSpeechInput(
  language: Language,
  uiLanguage: Language,
  onTranscript: (text: string) => void,
) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  useEffect(() => {
    callback.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    setSupported(
      Boolean(
        (window as RecognitionWindow).SpeechRecognition ||
        (window as RecognitionWindow).webkitSpeechRecognition,
      ),
    );
    return () => {
      recognition.current?.abort();
    };
  }, []);
  useEffect(() => {
    recognition.current?.abort();
    setListening(false);
  }, [language]);
  const stop = useCallback(() => recognition.current?.stop(), []);
  const start = useCallback(() => {
    const t = translator(uiLanguage);
    const Constructor =
      (window as RecognitionWindow).SpeechRecognition ||
      (window as RecognitionWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setError(t("voiceUnsupported"));
      return;
    }
    recognition.current?.abort();
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = language === "kn" ? "kn-IN" : "en-IN";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i].isFinal)
          parts.push(event.results[i][0].transcript);
      if (parts.length) callback.current(parts.join(" "));
    };
    instance.onerror = (event) => {
      if (event.error !== "aborted")
        setError(
          t(
            event.error === "not-allowed" ||
              event.error === "service-not-allowed"
              ? "micDenied"
              : "micError",
          ),
        );
      setListening(false);
    };
    instance.onend = () => setListening(false);
    setError("");
    try {
      instance.start();
      setListening(true);
    } catch {
      setError(t("micError"));
    }
  }, [language, uiLanguage]);
  return { supported, listening, error, start, stop };
}

export function useSpeechOutput(language: Language, uiLanguage: Language) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", update);
      window.speechSynthesis.cancel();
    };
  }, []);
  const stop = useCallback(() => {
    request.current?.abort();
    request.current = null;
    window.speechSynthesis?.cancel();
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = null;
    }
    setSpeaking(false);
  }, []);
  useEffect(
    () => () => {
      request.current?.abort();
      audio.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    },
    [],
  );
  useEffect(() => {
    stop();
    setError("");
  }, [language, stop]);
  const speak = useCallback(
    (text: string) => {
      setError("");
      const voice =
        voices.find(
          (item) =>
            item.lang.toLowerCase().replace("_", "-") === `${language}-in`,
        ) ||
        voices.find((item) => item.lang.toLowerCase().startsWith(language));
      stop();
      if (!("speechSynthesis" in window) || !voice) {
        const controller = new AbortController();
        request.current = controller;
        setSpeaking(true);
        void (async () => {
          try {
            const {
              data: { session },
            } = await getSupabase().auth.getSession();
            if (!session) throw new Error("AUTH_REQUIRED");
            const response = await fetch("/api/speech", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ text }),
              signal: controller.signal,
            });
            if (!response.ok) throw new Error("SPEECH_FAILED");
            const blob = await response.blob();
            if (controller.signal.aborted) return;
            audioUrl.current = URL.createObjectURL(blob);
            audio.current = new Audio(audioUrl.current);
            audio.current.onended = () => {
              stop();
            };
            await audio.current.play();
          } catch {
            if (!controller.signal.aborted) {
              stop();
              setError(translator(uiLanguage)("speechUnavailable"));
            }
          }
        })();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === "kn" ? "kn-IN" : "en-IN";
      utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => {
        setSpeaking(false);
        setError(translator(uiLanguage)("speechUnavailable"));
      };
      window.speechSynthesis.speak(utterance);
    },
    [language, uiLanguage, voices, stop],
  );
  return { speaking, error, speak, stop };
}
