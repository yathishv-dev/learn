"use client";

import { useState } from "react";
import {
  ArrowRight,
  AudioLines,
  Languages,
  Mic,
  Square,
  Sparkles,
} from "lucide-react";
import { useSpeechInput } from "@/hooks/use-speech";
import { friendlyError, translator } from "@/lib/i18n";
import { apiRequest } from "@/lib/supabase";
import type { EntryDraft, Language } from "@/lib/types";
import { Alert, Button, Field, Modal } from "./ui";

export function VoiceEntry({
  language,
  preferredLanguage,
  onDraft,
  onClose,
}: {
  language: Language;
  preferredLanguage: Language;
  onDraft: (draft: EntryDraft) => void;
  onClose: () => void;
}) {
  const t = translator(language);
  const [inputLanguage, setInputLanguage] = useState(preferredLanguage);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const speech = useSpeechInput(inputLanguage, language, (text) =>
    setTranscript((value) => (value ? `${value} ${text}` : text)),
  );
  async function createDraft() {
    setError("");
    if (transcript.trim().length < 3) {
      setError(t("draftEmpty"));
      return;
    }
    speech.stop();
    setBusy(true);
    try {
      const { draft } = await apiRequest<{ draft: EntryDraft }>(
        "/api/voice/parse",
        { transcript, language: inputLanguage },
      );
      onDraft(draft);
    } catch (error) {
      setError(friendlyError(error, language));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={t("voiceTitle")}
      subtitle={t("voiceSubtitle")}
      closeLabel={t("close")}
      onClose={onClose}
      busy={busy}
    >
      <div className="voice-language">
        <Languages size={18} aria-hidden="true" />
        <span>{t("inputLanguage")}</span>
        <select
          aria-label={t("inputLanguage")}
          value={inputLanguage}
          disabled={busy || speech.listening}
          onChange={(event) => setInputLanguage(event.target.value as Language)}
        >
          <option value="en">English</option>
          <option value="kn">ಕನ್ನಡ</option>
        </select>
      </div>
      <div
        className={`voice-recorder ${speech.listening ? "is-listening" : ""}`}
      >
        <button
          type="button"
          className="record-button"
          disabled={!speech.supported || busy}
          aria-label={t(speech.listening ? "stopListening" : "startListening")}
          onClick={speech.listening ? speech.stop : speech.start}
        >
          {speech.listening ? (
            <Square size={26} fill="currentColor" aria-hidden="true" />
          ) : (
            <Mic size={32} strokeWidth={1.6} aria-hidden="true" />
          )}
        </button>
        <p aria-live="polite">
          {t(speech.listening ? "listening" : "startListening")}
        </p>
        <div className="voice-waves" aria-hidden="true">
          {Array.from({ length: 23 }, (_, i) => (
            <i
              key={i}
              style={{
                height: `${8 + (Math.sin(i * 1.5) + 1) * 11}px`,
                animationDelay: `${i * 0.07}s`,
              }}
            />
          ))}
        </div>
      </div>
      {!speech.supported && <Alert>{t("voiceUnsupported")}</Alert>}
      {(error || speech.error) && <Alert>{error || speech.error}</Alert>}
      <Field label={t("transcript")}>
        <textarea
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          rows={3}
          maxLength={1500}
          placeholder={t("transcriptPlaceholder")}
          disabled={busy}
        />
      </Field>
      <div className="voice-examples">
        <span>
          <Sparkles size={14} aria-hidden="true" />
          {t("voiceExampleTitle")}
        </span>
        <p lang={inputLanguage}>
          {inputLanguage === "kn"
            ? "“ಇಂದು 2 ಕೆಜಿ ಅಕ್ಕಿ ಮಾರಾಟ ಮಾಡಿದೆ”"
            : "“Sold 2 kg of rice today”"}
        </p>
        <p lang={inputLanguage}>
          {inputLanguage === "kn"
            ? "“ಇಂದು ಸಾರಿಗೆಗೆ 500 ರೂಪಾಯಿ ಖರ್ಚು ಮಾಡಿದೆ”"
            : "“Spent 500 rupees on transport today”"}
        </p>
      </div>
      <p className="field-hint voice-privacy">
        <AudioLines size={13} aria-hidden="true" />
        {t("speechPrivacy")}
      </p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("cancel")}
        </Button>
        <Button
          loading={busy}
          onClick={createDraft}
          disabled={speech.listening || !transcript.trim()}
        >
          {t(busy ? "makingDraft" : "makeDraft")}
          <ArrowRight size={17} aria-hidden="true" />
        </Button>
      </div>
    </Modal>
  );
}
