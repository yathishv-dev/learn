"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  AudioLines,
  CalendarDays,
  Check,
  ChevronDown,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Package,
  Plus,
  ReceiptIndianRupee,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useShopData } from "@/hooks/use-shop-data";
import { daysAgo, reportRangeSchema, todayInIndia } from "@/lib/business";
import { friendlyError, translator } from "@/lib/i18n";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import type {
  EntryDraft,
  EntryKind,
  Expense,
  Language,
  Product,
  Profile,
  Screen,
} from "@/lib/types";
import { AuthScreen } from "./auth-screen";
import {
  ExpensesScreen,
  Inventory,
  Overview,
  SalesScreen,
  SettingsScreen,
} from "./business-screens";
import { ChatScreen } from "./chat-screen";
import { EntryForm } from "./entry-form";
import { VoiceEntry } from "./voice-entry";
import { Alert, Brand, Button, Field, Modal } from "./ui";

const screens: Screen[] = [
  "overview",
  "inventory",
  "sales",
  "expenses",
  "assistant",
  "settings",
];
type OpenModal =
  | {
      type: "entry";
      kind: EntryKind;
      product?: Product;
      expense?: Expense;
      draft?: EntryDraft;
    }
  | { type: "voice" }
  | { type: "archive"; product: Product }
  | { type: "delete"; expense: Expense }
  | { type: "dates" }
  | null;

export function Application() {
  const [language, setLanguage] = useState<Language>("en");
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem("vyapaar-ui-language") === "kn")
        setLanguage("kn");
    } catch {
      /* Preferences still work in memory. */
    }
    if (!supabaseConfigured) return;
    const db = getSupabase();
    let active = true;
    void db.auth.getSession().then(({ data, error }) => {
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
        if (error) setProfileError(true);
      }
    });
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((_event, current) => {
      if (active) {
        setSession(current);
        setAuthLoading(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileError(false);
      return;
    }
    let active = true;
    setProfileError(false);
    async function load() {
      const db = getSupabase();
      try {
        const { data, error } = await db
          .from("profiles")
          .select("*")
          .eq("id", userId!)
          .maybeSingle();
        if (error) throw error;
        let current = data as Profile | null;
        if (!current) {
          const {
            data: { user },
            error: userError,
          } = await db.auth.getUser();
          if (userError || !user || user.id !== userId)
            throw userError || new Error("AUTH_REQUIRED");
          const metadata = user.user_metadata;
          const values: Profile = {
            id: user.id,
            owner_name:
              typeof metadata.owner_name === "string"
                ? metadata.owner_name.trim().slice(0, 80) || "Owner"
                : "Owner",
            shop_name:
              typeof metadata.shop_name === "string"
                ? metadata.shop_name.trim().slice(0, 120) || "My shop"
                : "My shop",
            ui_language: metadata.ui_language === "kn" ? "kn" : "en",
            ai_language: metadata.ai_language === "kn" ? "kn" : "en",
            auto_speak: metadata.auto_speak !== false,
          };
          const { data: inserted, error: insertError } = await db
            .from("profiles")
            .insert(values)
            .select("*")
            .single();
          if (insertError?.code === "23505") {
            const { data: existing, error: readError } = await db
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .single();
            if (readError) throw readError;
            current = existing as Profile;
          } else {
            if (insertError) throw insertError;
            current = inserted as Profile;
          }
        }
        if (active) {
          setProfile(current);
          setLanguage(current.ui_language);
        }
      } catch {
        if (active) setProfileError(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [userId, retry]);
  useEffect(() => {
    const selected = profile?.ui_language || language;
    document.documentElement.lang = selected;
    try {
      localStorage.setItem("vyapaar-ui-language", selected);
    } catch {
      /* Optional browser preference. */
    }
  }, [profile?.ui_language, language]);

  async function signOut() {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error) setProfileError(true);
  }
  const t = translator(profile?.ui_language || language);
  if (
    authLoading ||
    (session && !profileError && profile?.id !== session.user.id)
  )
    return (
      <main className="loading-screen">
        <Brand />
        <LoaderCircle size={28} className="spin" aria-hidden="true" />
        <p role="status">{t("loading")}</p>
      </main>
    );
  if (session && profileError)
    return (
      <main className="loading-screen">
        <Brand />
        <Alert>{t("connectionError")}</Alert>
        <div className="inline-actions">
          <Button onClick={() => setRetry((value) => value + 1)}>
            {t("retry")}
          </Button>
          <Button variant="secondary" onClick={() => void signOut()}>
            {t("signOut")}
          </Button>
        </div>
      </main>
    );
  if (!session || !profile)
    return <AuthScreen language={language} setLanguage={setLanguage} />;
  return (
    <Workspace
      key={session.user.id}
      profile={profile}
      email={session.user.email || ""}
      setProfile={setProfile}
      signOut={() => void signOut()}
    />
  );
}

function Workspace({
  profile,
  email,
  setProfile,
  signOut,
}: {
  profile: Profile;
  email: string;
  setProfile: (profile: Profile) => void;
  signOut: () => void;
}) {
  const language = profile.ui_language,
    t = translator(language);
  const [screen, setScreen] = useState<Screen>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeMenuButton = useRef<HTMLButtonElement>(null);
  const [range, setRange] = useState("week");
  const [dates, setDates] = useState({
    start: daysAgo(6),
    end: todayInIndia(),
  });
  const [modal, setModal] = useState<OpenModal>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [languageBusy, setLanguageBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
    null,
  );
  const data = useShopData(profile.id, dates.start, dates.end);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 800px)");
    const sync = () => {
      setIsMobile(query.matches);
      if (!query.matches) setMobileNav(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const sync = () => {
      const value = location.hash.slice(1) as Screen;
      setScreen(screens.includes(value) ? value : "overview");
      setMobileNav(false);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!mobileNav) return;
    closeMenuButton.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      menuButton.current?.focus();
    };
  }, [mobileNav]);
  const navigate = useCallback((value: Screen) => {
    setScreen(value);
    setMobileNav(false);
    location.hash = value;
  }, []);
  const openEntry = (kind: EntryKind, product?: Product, expense?: Expense) =>
    setModal({ type: "entry", kind, product, expense });
  async function saveProfile(values: Omit<Profile, "id">) {
    try {
      const { data: updated, error } = await getSupabase()
        .from("profiles")
        .update({
          owner_name: values.owner_name.trim(),
          shop_name: values.shop_name.trim(),
          ui_language: values.ui_language,
          ai_language: values.ai_language,
          auto_speak: values.auto_speak,
        })
        .eq("id", profile.id)
        .select("*")
        .single();
      if (error) throw error;
      setProfile(updated as Profile);
      setToast({ text: translator(values.ui_language)("settingsSaved") });
    } catch (error) {
      setToast({ text: friendlyError(error, language), error: true });
    }
  }
  async function changeLanguage(value: Language) {
    setLanguageBusy(true);
    await saveProfile({ ...profile, ui_language: value });
    setLanguageBusy(false);
  }
  function changeRange(value: string) {
    if (value === "custom") {
      setModal({ type: "dates" });
      return;
    }
    setRange(value);
    const end = todayInIndia();
    setDates({
      start:
        value === "today"
          ? end
          : value === "month"
            ? daysAgo(29, end)
            : value === "allTime"
              ? `${end.slice(0, 4)}-01-01`
              : daysAgo(6, end),
      end,
    });
  }
  async function confirmMutation() {
    if (modal?.type !== "archive" && modal?.type !== "delete") return;
    setConfirmBusy(true);
    try {
      const db = getSupabase();
      if (modal.type === "archive") {
        const { data: updated, error } = await db
          .from("products")
          .update({ active: false })
          .eq("id", modal.product.id)
          .eq("version", modal.product.version)
          .select("id");
        if (error) throw error;
        if (!updated.length) throw new Error("STOCK_CHANGED");
      } else {
        const { error } = await db
          .from("expenses")
          .delete()
          .eq("id", modal.expense.id);
        if (error) throw error;
      }
      setToast({
        text: t(modal.type === "archive" ? "archived" : "expenseDeleted"),
      });
      setModal(null);
      await data.refresh();
    } catch (error) {
      setToast({ text: friendlyError(error, language), error: true });
      await data.refresh();
    } finally {
      setConfirmBusy(false);
    }
  }
  const nav = [
    { screen: "overview" as const, Icon: LayoutDashboard },
    { screen: "inventory" as const, Icon: Package },
    { screen: "sales" as const, Icon: ShoppingBag },
    { screen: "expenses" as const, Icon: ReceiptIndianRupee },
    { screen: "assistant" as const, Icon: MessageCircle },
  ];
  const showRange = ["overview", "sales", "expenses"].includes(screen);
  const subtitles = {
    overview: "overviewSubtitle",
    inventory: "inventorySubtitle",
    sales: "salesSubtitle",
    expenses: "expenseSubtitle",
    assistant: "assistantSubtitle",
    settings: "settingsSubtitle",
  } as const;

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">
        {t("skipNavigation")}
      </a>
      {mobileNav && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label={t("close")}
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside
        className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}
        inert={isMobile && !mobileNav}
        aria-hidden={isMobile && !mobileNav ? true : undefined}
      >
        <div className="sidebar-brand">
          <Brand light />
          <button
            type="button"
            className="icon-btn mobile-nav-close"
            ref={closeMenuButton}
            aria-label={t("close")}
            onClick={() => setMobileNav(false)}
          >
            <X size={21} aria-hidden="true" />
          </button>
        </div>
        <div className="shop-identity">
          <span className="shop-avatar">
            {profile.shop_name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{profile.shop_name}</strong>
            <span>{t("workspace")}</span>
          </div>
        </div>
        <span className="nav-eyebrow">{t("workspace")}</span>
        <nav aria-label={t("workspace")}>
          {nav.map(({ screen: value, Icon }) => (
            <a
              key={value}
              href={`#${value}`}
              aria-current={screen === value ? "page" : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(value);
              }}
            >
              <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
              <span>{t(value)}</span>
              {value === "inventory" &&
                Boolean(data.report?.low_stock.length) && (
                  <i className="nav-count">{data.report!.low_stock.length}</i>
                )}
              {value === "assistant" && (
                <Sparkles
                  size={13}
                  className="nav-sparkle"
                  aria-hidden="true"
                />
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-voice-card">
          <span className="sidebar-voice-icon">
            <AudioLines size={22} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <h3>{t("supportTitle")}</h3>
          <p>{t("supportText")}</p>
          <button type="button" onClick={() => setModal({ type: "voice" })}>
            {t("voiceEntry")}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
        <div className="sidebar-bottom">
          <a
            href="#settings"
            aria-current={screen === "settings" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate("settings");
            }}
          >
            <Settings size={19} strokeWidth={1.6} aria-hidden="true" />
            {t("settings")}
          </a>
          <div className="sidebar-profile">
            <span className="owner-avatar">
              {profile.owner_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{profile.owner_name}</strong>
              <span>{email}</span>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={t("signOut")}
              onClick={signOut}
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main" inert={isMobile && mobileNav}>
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-btn menu-button"
              ref={menuButton}
              aria-label={t("menu")}
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(true)}
            >
              <Menu size={23} aria-hidden="true" />
            </button>
            <span className="breadcrumb-shop">{profile.shop_name}</span>
            <ChevronDown
              size={12}
              className="breadcrumb-chevron"
              aria-hidden="true"
            />
            <span>{t(screen)}</span>
          </div>
          <div className="topbar-right">
            {!data.error && !data.busy && (
              <span className="connection-indicator">
                <i className={data.error ? "offline-dot" : "online-dot"} />
                {t("connectionStatus")}
              </span>
            )}
            <label className="header-language">
              <span aria-hidden="true">ಅ / A</span>
              <select
                aria-label={t("uiLanguage")}
                value={language}
                disabled={languageBusy}
                onChange={(event) =>
                  void changeLanguage(event.target.value as Language)
                }
              >
                <option value="en">English</option>
                <option value="kn">ಕನ್ನಡ</option>
              </select>
            </label>
            <button
              type="button"
              className="header-avatar"
              aria-label={t("settings")}
              onClick={() => navigate("settings")}
            >
              {profile.owner_name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main
          className={`page-content screen-${screen}`}
          id="main-content"
          tabIndex={-1}
        >
          <div className="page-heading">
            <div>
              <span className="page-eyebrow">
                {new Intl.DateTimeFormat(
                  language === "kn" ? "kn-IN" : "en-IN",
                  {
                    timeZone: "Asia/Kolkata",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                ).format(new Date())}
              </span>
              <h1>
                {screen === "overview"
                  ? `${t("greeting")}, ${profile.owner_name.split(" ")[0]}`
                  : screen === "assistant"
                    ? t("helloAssistant")
                    : t(screen)}
                {screen === "overview" && (
                  <span className="greeting-dot">.</span>
                )}
              </h1>
              <p>{t(subtitles[screen])}</p>
            </div>
            <div className="page-actions">
              {showRange && (
                <label className="range-select">
                  <CalendarDays size={16} aria-hidden="true" />
                  <select
                    value={range}
                    aria-label={t("date")}
                    onChange={(event) => changeRange(event.target.value)}
                  >
                    {(
                      ["today", "week", "month", "allTime", "custom"] as const
                    ).map((value) => (
                      <option key={value} value={value}>
                        {t(value)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {screen !== "assistant" && screen !== "settings" && (
                <Button
                  onClick={() =>
                    openEntry(
                      screen === "inventory"
                        ? "product"
                        : screen === "expenses"
                          ? "expense"
                          : "sale",
                    )
                  }
                >
                  <Plus size={17} aria-hidden="true" />
                  {t(
                    screen === "inventory"
                      ? "addProduct"
                      : screen === "expenses"
                        ? "addExpense"
                        : "addSale",
                  )}
                </Button>
              )}
            </div>
          </div>
          {screen === "overview" && (
            <section className="voice-banner">
              <div className="voice-banner-icon">
                <Mic size={25} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="voice-banner-copy">
                <h2>{t("voiceTitle")}</h2>
                <p>{t("voiceSubtitle")}</p>
              </div>
              <div className="banner-wave" aria-hidden="true">
                {Array.from({ length: 15 }, (_, i) => (
                  <i
                    key={i}
                    style={{ height: `${8 + (Math.sin(i * 1.4) + 1) * 13}px` }}
                  />
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={() => setModal({ type: "voice" })}
              >
                {t("voiceEntry")}
                <ArrowRight size={16} aria-hidden="true" />
              </Button>
            </section>
          )}
          {Boolean(data.error) && (
            <div className="data-error">
              <Alert>{t("connectionError")}</Alert>
              <Button
                variant="secondary"
                onClick={() => void data.refresh()}
                loading={data.busy}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {t("retry")}
              </Button>
            </div>
          )}
          {data.busy &&
          !data.report &&
          screen !== "settings" &&
          screen !== "assistant" ? (
            <div className="section-loading" role="status">
              <LoaderCircle className="spin" size={27} aria-hidden="true" />
              {t("loading")}
            </div>
          ) : (
            <>
              {screen === "overview" && data.report && (
                <Overview
                  report={data.report}
                  sales={data.sales}
                  products={data.products}
                  language={language}
                  navigate={navigate}
                  editProduct={(product) => openEntry("product", product)}
                  addSale={() => openEntry("sale")}
                />
              )}
              {screen === "inventory" && (
                <Inventory
                  products={data.products}
                  language={language}
                  addProduct={() => openEntry("product")}
                  editProduct={(product) => openEntry("product", product)}
                  archive={(product) => setModal({ type: "archive", product })}
                />
              )}
              {screen === "sales" && data.report && (
                <SalesScreen
                  sales={data.sales}
                  report={data.report}
                  language={language}
                  add={() => openEntry("sale")}
                />
              )}
              {screen === "expenses" && data.report && (
                <ExpensesScreen
                  expenses={data.expenses}
                  report={data.report}
                  language={language}
                  add={() => openEntry("expense")}
                  edit={(expense) => openEntry("expense", undefined, expense)}
                  remove={(expense) => setModal({ type: "delete", expense })}
                />
              )}
              {screen === "assistant" && (
                <ChatScreen
                  profile={profile}
                  report={data.report}
                  onSettings={() => navigate("settings")}
                />
              )}
              {screen === "settings" && (
                <SettingsScreen
                  profile={profile}
                  email={email}
                  language={language}
                  onSave={saveProfile}
                  signOut={signOut}
                />
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>
              <ShieldCheck size={13} aria-hidden="true" />
              {t("privacyLine")}
            </span>
            <span>Vyapaar Voice · MakerSprint PS 06</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "toast-error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <Check size={18} aria-hidden="true" />
          <span>{toast.text}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label={t("close")}
            onClick={() => setToast(null)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      {modal?.type === "entry" && (
        <EntryForm
          key={modal.product?.id || modal.expense?.id || modal.kind}
          {...modal}
          products={data.products}
          ownerId={profile.id}
          language={language}
          onClose={() => setModal(null)}
          onSaved={(message) => {
            setModal(null);
            setToast({ text: message });
            void data.refresh();
          }}
          refresh={data.refresh}
        />
      )}
      {modal?.type === "voice" && (
        <VoiceEntry
          language={language}
          preferredLanguage={profile.ai_language}
          onClose={() => setModal(null)}
          onDraft={(draft) =>
            setModal({
              type: "entry",
              kind: draft.kind,
              draft,
              product:
                draft.kind === "product"
                  ? data.products.find(
                      (product) => product.id === draft.product_id,
                    )
                  : undefined,
            })
          }
        />
      )}
      {(modal?.type === "archive" || modal?.type === "delete") && (
        <Modal
          title={t(
            modal.type === "archive" ? "confirmArchive" : "confirmDelete",
          )}
          subtitle={t(
            modal.type === "archive" ? "archiveConfirm" : "expenseDelete",
          )}
          closeLabel={t("close")}
          busy={confirmBusy}
          onClose={() => setModal(null)}
        >
          <p className="confirm-item">
            {modal.type === "archive"
              ? modal.product.name
              : modal.expense.description}
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => setModal(null)}
              disabled={confirmBusy}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="danger"
              loading={confirmBusy}
              onClick={() => void confirmMutation()}
            >
              {t(modal.type === "archive" ? "archive" : "delete")}
            </Button>
          </div>
        </Modal>
      )}
      {modal?.type === "dates" && (
        <DateRangeModal
          language={language}
          dates={dates}
          onClose={() => setModal(null)}
          onApply={(value) => {
            setDates(value);
            setRange("custom");
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function DateRangeModal({
  language,
  dates,
  onClose,
  onApply,
}: {
  language: Language;
  dates: { start: string; end: string };
  onClose: () => void;
  onApply: (dates: { start: string; end: string }) => void;
}) {
  const t = translator(language),
    [error, setError] = useState("");
  return (
    <Modal title={t("custom")} closeLabel={t("close")} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const result = reportRangeSchema.safeParse({
            start: form.get("start"),
            end: form.get("end"),
          });
          if (!result.success || result.data.end > todayInIndia()) {
            setError(
              language === "kn"
                ? "ಇಂದಿನವರೆಗಿನ ಗರಿಷ್ಠ 367 ದಿನಗಳ ಅವಧಿ ಆಯ್ಕೆಮಾಡಿ."
                : "Choose an ordered range of up to 367 days, ending today or earlier.",
            );
            return;
          }
          onApply(result.data);
        }}
      >
        {error && <Alert>{error}</Alert>}
        <div className="field-grid">
          <Field label={t("from")}>
            <input
              name="start"
              type="date"
              required
              defaultValue={dates.start}
              max={todayInIndia()}
            />
          </Field>
          <Field label={t("to")}>
            <input
              name="end"
              type="date"
              required
              defaultValue={dates.end}
              max={todayInIndia()}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit">{t("apply")}</Button>
        </div>
      </form>
    </Modal>
  );
}
