"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  AudioLines,
  ChartNoAxesCombined,
  Check,
  Languages,
  LockKeyhole,
  Mic,
  Sparkles,
  Store,
} from "lucide-react";
import { friendlyError, translator } from "@/lib/i18n";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import type { Language } from "@/lib/types";
import { Alert, Brand, Button, Field } from "./ui";

export function AuthScreen({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (value: Language) => void;
}) {
  const [register, setRegister] = useState(true);
  const [aiLanguage, setAiLanguage] = useState<Language>(language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);
  const t = translator(language);

  useEffect(() => {
    if (!resendLocked) return;
    const timer = window.setTimeout(() => setResendLocked(false), 60_000);
    return () => window.clearTimeout(timer);
  }, [resendLocked]);

  async function resendConfirmation() {
    if (!confirmationEmail || resending || resendLocked) return;
    setResending(true);
    setError("");
    try {
      const { error } = await getSupabase().auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setNotice(t("confirmationResent"));
      setResendLocked(true);
    } catch (error) {
      setError(friendlyError(error, language));
    } finally {
      setResending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setConfirmationEmail("");
    if (!supabaseConfigured) {
      setError(t("setupText"));
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    if (register && password !== form.get("confirmPassword")) {
      setError(t("mismatch"));
      return;
    }
    setBusy(true);
    try {
      const db = getSupabase();
      if (register) {
        const { data, error: authError } = await db.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              owner_name: String(form.get("ownerName")).trim(),
              shop_name: String(form.get("shopName")).trim(),
              ui_language: language,
              ai_language: aiLanguage,
              auto_speak: true,
            },
          },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice(t("checkEmail"));
          setConfirmationEmail(email);
          setRegister(false);
        }
      } else {
        const { error: authError } = await db.auth.signInWithPassword({
          email,
          password,
        });
        if (
          authError?.code === "email_not_confirmed" ||
          authError?.message.includes("Email not confirmed")
        ) {
          setConfirmationEmail(email);
          setNotice(t("confirmBeforeSignIn"));
        } else if (authError) throw authError;
      }
    } catch (err) {
      setError(friendlyError(err, language));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand light />
        <div className="story-main">
          <div className="story-pill">
            <span className="small-dot" />
            {t("supportTitle")}
          </div>
          <h1>
            {t("welcome")
              .split("\n")
              .map((line, i) => (
                <span key={line} className={i ? "lavender-text" : ""}>
                  {line}
                </span>
              ))}
          </h1>
          <p className="story-description">{t("welcomeText")}</p>
          <div className="voice-illustration" aria-hidden="true">
            <div className="illustration-ring ring-one" />
            <div className="illustration-ring ring-two" />
            <div className="illustration-orb">
              <Mic size={38} strokeWidth={1.3} />
            </div>
            <span className="floating-language language-en">
              Hello, business.
            </span>
            <span className="floating-language language-kn">
              ನಮಸ್ಕಾರ, ವ್ಯಾಪಾರ.
            </span>
            <div className="illustration-bars">
              {Array.from({ length: 19 }, (_, i) => (
                <i
                  key={i}
                  style={{ height: `${12 + (Math.sin(i * 1.3) + 1) * 17}px` }}
                />
              ))}
            </div>
            <span className="illustration-check">
              <Check size={17} />
            </span>
          </div>
          <div className="story-features">
            {[
              { Icon: AudioLines, title: "voiceFirst", text: "voiceFirstText" },
              {
                Icon: ChartNoAxesCombined,
                title: "realInsights",
                text: "realInsightsText",
              },
              {
                Icon: Languages,
                title: "yourLanguage",
                text: "yourLanguageText",
              },
            ].map(({ Icon, title, text }) => (
              <div className="story-feature" key={title}>
                <span>
                  <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <h3>{t(title as "voiceFirst")}</h3>
                  <p>{t(text as "voiceFirstText")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="story-footer">
          <span>VYAPAAR VOICE</span>
          <span>{t("powered")}</span>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-top">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="language-toggle" aria-label={t("uiLanguage")}>
            <button
              type="button"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
            <button
              type="button"
              aria-pressed={language === "kn"}
              onClick={() => setLanguage("kn")}
            >
              ಕನ್ನಡ
            </button>
          </div>
        </div>
        <div className="auth-form-container">
          <div className="auth-symbol">
            <Store size={25} strokeWidth={1.5} aria-hidden="true" />
            <Sparkles size={14} className="auth-sparkle" aria-hidden="true" />
          </div>
          <h2>{t(register ? "registration" : "loginTitle")}</h2>
          <p className="auth-subtitle">
            {t(register ? "registrationSubtitle" : "loginSubtitle")}
          </p>
          {!supabaseConfigured && (
            <Alert>
              <strong>{t("setupBadge")}</strong>
              <br />
              {t("setupText")}
            </Alert>
          )}
          {error && <Alert>{error}</Alert>}
          {notice && <Alert info>{notice}</Alert>}
          {confirmationEmail && (
            <Button
              variant="secondary"
              loading={resending}
              disabled={busy || resendLocked}
              onClick={() => void resendConfirmation()}
            >
              {t(resendLocked ? "confirmationRequested" : "resendConfirmation")}
            </Button>
          )}
          <form onSubmit={submit} className="auth-form">
            {register && (
              <div className="field-grid">
                <Field label={t("ownerName")}>
                  <input
                    name="ownerName"
                    required
                    maxLength={80}
                    autoComplete="name"
                    placeholder={
                      language === "kn" ? "ನಿಮ್ಮ ಹೆಸರು" : "Your name"
                    }
                  />
                </Field>
                <Field label={t("shopName")}>
                  <input
                    name="shopName"
                    required
                    maxLength={120}
                    autoComplete="organization"
                    placeholder={
                      language === "kn" ? "ನಿಮ್ಮ ಅಂಗಡಿ" : "Your shop"
                    }
                  />
                </Field>
              </div>
            )}
            <Field label={t("email")}>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                onChange={(event) => {
                  if (
                    confirmationEmail &&
                    event.target.value.trim() !== confirmationEmail
                  ) {
                    setConfirmationEmail("");
                    setNotice("");
                  }
                }}
              />
            </Field>
            <div className={register ? "field-grid" : ""}>
              <Field label={t("password")}>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={register ? 8 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder={t("passwordHint")}
                />
              </Field>
              {register && (
                <Field label={t("confirmPassword")}>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </Field>
              )}
            </div>
            {register && (
              <div className="registration-languages">
                <div className="registration-languages-title">
                  <Languages size={17} aria-hidden="true" />
                  <span>{t("selectAtRegistration")}</span>
                </div>
                <div className="field-grid">
                  <Field label={t("uiLanguage")}>
                    <select
                      value={language}
                      onChange={(event) =>
                        setLanguage(event.target.value as Language)
                      }
                    >
                      <option value="en">English</option>
                      <option value="kn">ಕನ್ನಡ</option>
                    </select>
                  </Field>
                  <Field label={t("aiLanguage")}>
                    <select
                      value={aiLanguage}
                      onChange={(event) =>
                        setAiLanguage(event.target.value as Language)
                      }
                    >
                      <option value="en">English</option>
                      <option value="kn">ಕನ್ನಡ</option>
                    </select>
                  </Field>
                </div>
                <p>{t("languageSavedLater")}</p>
              </div>
            )}
            <Button
              type="submit"
              loading={busy}
              disabled={!supabaseConfigured || resending}
              className="auth-submit"
            >
              {t(register ? "createAccount" : "signIn")}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>
          <p className="auth-switch">
            {t(register ? "alreadyAccount" : "newAccount")}{" "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
                setNotice("");
                setConfirmationEmail("");
              }}
            >
              {t(register ? "signIn" : "registerLink")}
            </button>
          </p>
          <p className="privacy-line">
            <LockKeyhole size={13} aria-hidden="true" />
            {t("privacyLine")}
          </p>
        </div>
        <p className="auth-bottom">{t("tagline")}</p>
      </section>
    </main>
  );
}
