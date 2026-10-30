"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  AudioLines,
  CheckCheck,
  Languages,
  Mic,
  Plus,
  Send,
  Sparkles,
  Square,
  Volume2,
  Wallet,
  Boxes,
  ShoppingBag,
} from "lucide-react";
import { useSpeechInput, useSpeechOutput } from "@/hooks/use-speech";
import { money } from "@/lib/business";
import { friendlyError, translator, type TranslationKey } from "@/lib/i18n";
import { apiRequest } from "@/lib/supabase";
import type {
  BusinessReport,
  ChatMessage,
  Language,
  Profile,
} from "@/lib/types";
import { Alert, Button } from "./ui";

export function ChatScreen({
  profile,
  report,
  onSettings,
}: {
  profile: Profile;
  report: BusinessReport | null;
  onSettings: () => void;
}) {
  const language = profile.ui_language,
    t = translator(language);
  const aiT = translator(profile.ai_language);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const output = useSpeechOutput(profile.ai_language, language);
  const inputSpeech = useSpeechInput(profile.ai_language, language, (text) =>
    setInput((value) => (value ? `${value} ${text}` : text)),
  );
  useEffect(() => {
    setMessages([]);
    setError("");
    setInput("");
    request.current?.abort();
    request.current = null;
    setBusy(false);
  }, [profile.ai_language]);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (messages.length || busy)
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length, busy]);

  async function send(question: string) {
    if (!question.trim() || request.current) return;
    inputSpeech.stop();
    output.stop();
    setError("");
    const previous = messages;
    const next = [
      ...messages,
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: question.trim(),
      },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await apiRequest<{
        answer: string;
        sources: string[];
        language: Language;
      }>(
        "/api/chat",
        {
          messages: next
            .slice(-11)
            .map(({ role, content }) => ({ role, content })),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setMessages([
        ...next,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.answer,
          sources: result.sources,
        },
      ]);
      if (profile.auto_speak) output.speak(result.answer);
    } catch (err) {
      if (!controller.signal.aborted) {
        setMessages(previous);
        setInput(question);
        setError(friendlyError(err, language));
      }
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }
  const prompts: { key: TranslationKey; Icon: typeof ShoppingBag }[] = [
    { key: "askSales", Icon: ShoppingBag },
    { key: "askStock", Icon: Boxes },
    { key: "askExpenses", Icon: Wallet },
    { key: "askProfit", Icon: Sparkles },
  ];

  return (
    <div className="chat-layout">
      <section className="panel chat-panel">
        <div className="chat-toolbar">
          <div>
            <span className="assistant-avatar">
              <Sparkles size={20} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <div>
              <strong>{t("assistant")}</strong>
              <small>
                <i className="online-dot" />
                {profile.ai_language === "kn" ? "ಕನ್ನಡ" : "English"}
              </small>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              request.current?.abort();
              request.current = null;
              output.stop();
              setMessages([]);
              setInput("");
              setError("");
              setBusy(false);
            }}
          >
            <Plus size={16} aria-hidden="true" />
            <span>{t("clearChat")}</span>
          </Button>
        </div>
        <div
          className="chat-messages"
          role="log"
          aria-live="polite"
          aria-label={t("assistant")}
        >
          {!messages.length && (
            <div className="chat-welcome">
              <span className="chat-welcome-icon">
                <Sparkles size={34} strokeWidth={1.3} aria-hidden="true" />
              </span>
              <span className="eyebrow">VYAPAAR VOICE</span>
              <h2>{t("assistantWelcome")}</h2>
              <p>{t("assistantWelcomeText")}</p>
              <div className="prompt-grid">
                {prompts.map(({ key, Icon }) => (
                  <button
                    type="button"
                    key={key}
                    disabled={busy}
                    onClick={() => void send(aiT(key))}
                  >
                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                    <span>{t(key)}</span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message message-${message.role}`}
            >
              {message.role === "assistant" && (
                <span className="message-avatar">
                  <Sparkles size={17} aria-hidden="true" />
                </span>
              )}
              <div className="message-body">
                <div
                  className="message-text"
                  lang={
                    message.role === "assistant"
                      ? profile.ai_language
                      : undefined
                  }
                >
                  {message.content}
                </div>
                {message.role === "assistant" && (
                  <div className="message-footer">
                    <span>
                      <CheckCheck size={13} aria-hidden="true" />
                      {t("basedOn")}
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t(
                        output.speaking ? "stopSpeaking" : "readAloud",
                      )}
                      onClick={() =>
                        output.speaking
                          ? output.stop()
                          : output.speak(message.content)
                      }
                    >
                      {output.speaking ? (
                        <Square size={14} aria-hidden="true" />
                      ) : (
                        <Volume2 size={16} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                )}
                {message.sources && (
                  <div className="message-sources">
                    {message.sources.map((source) => (
                      <span key={source}>{source}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="chat-message message-assistant">
              <span className="message-avatar">
                <Sparkles size={17} aria-hidden="true" />
              </span>
              <div className="thinking">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                {t("thinking")}
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="chat-composer-wrap">
          {(error || inputSpeech.error || output.error) && (
            <Alert>{error || inputSpeech.error || output.error}</Alert>
          )}
          <form className="chat-composer" onSubmit={submit}>
            <textarea
              rows={1}
              maxLength={2000}
              aria-label={t("chatPlaceholder")}
              placeholder={
                inputSpeech.listening ? t("listening") : t("chatPlaceholder")
              }
              value={input}
              disabled={busy}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send(input);
                }
              }}
            />
            <button
              type="button"
              className={`icon-btn ${inputSpeech.listening ? "recording" : ""}`}
              aria-label={t(
                inputSpeech.listening ? "stopListening" : "voiceQuestion",
              )}
              disabled={busy || !inputSpeech.supported}
              onClick={
                inputSpeech.listening ? inputSpeech.stop : inputSpeech.start
              }
            >
              {inputSpeech.listening ? (
                <Square size={17} aria-hidden="true" />
              ) : (
                <Mic size={19} aria-hidden="true" />
              )}
            </button>
            <button
              type="submit"
              className="send-button"
              disabled={busy || !input.trim() || inputSpeech.listening}
              aria-label={t("send")}
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="chat-disclaimer">{t("chatDisclaimer")}</p>
        </div>
      </section>
      <aside className="chat-context">
        <div className="panel context-language">
          <span className="context-icon">
            <Languages size={22} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h3>{t("supportTitle")}</h3>
          <p>{t("aiLanguageHint")}</p>
          <span className="language-pill">
            {profile.ai_language === "kn" ? "ಕನ್ನಡ" : "English"}
          </span>
          <button type="button" className="text-link" onClick={onSettings}>
            {t("goToSettings")}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        {report && (
          <div className="panel context-data">
            <h3>{t("stockSummary")}</h3>
            <div>
              <span>{t("products")}</span>
              <strong>{report.active_products}</strong>
            </div>
            <div>
              <span>{t("lowStock")}</span>
              <strong>{report.low_stock.length}</strong>
            </div>
            <div>
              <span>{t("periodSales")}</span>
              <strong>{money(report.sales_paise, language, true)}</strong>
            </div>
          </div>
        )}
        <p className="context-note">
          <AudioLines size={16} aria-hidden="true" />
          {t("supportText")}
        </p>
      </aside>
    </div>
  );
}
