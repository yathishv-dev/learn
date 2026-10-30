"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  CircleCheck,
  Edit3,
  Package,
  Plus,
  ReceiptIndianRupee,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { money, quantity } from "@/lib/business";
import { translator, type TranslationKey } from "@/lib/i18n";
import type {
  BusinessReport,
  Expense,
  Language,
  Product,
  Profile,
  Sale,
  Screen,
} from "@/lib/types";
import { Button, EmptyState, Field } from "./ui";

export function localDate(value: string, language: Language, short = false) {
  return new Intl.DateTimeFormat(language === "kn" ? "kn-IN" : "en-IN", {
    day: "numeric",
    month: short ? "short" : "long",
  }).format(new Date(`${value}T12:00:00Z`));
}
function ProductName({
  product,
  language,
}: {
  product: Product;
  language: Language;
}) {
  return (
    <div className="product-name">
      <span className="product-icon">
        <Package size={18} strokeWidth={1.6} aria-hidden="true" />
      </span>
      <div>
        <strong>
          {language === "kn" && product.kannada_name
            ? product.kannada_name
            : product.name}
        </strong>
        {product.kannada_name && (
          <small>
            {language === "kn" ? product.name : product.kannada_name}
          </small>
        )}
      </div>
    </div>
  );
}

export function SalesChart({
  report,
  language,
}: {
  report: BusinessReport;
  language: Language;
}) {
  const t = translator(language);
  const data = report.daily;
  if (!data.some((row) => row.sales_paise || row.expenses_paise))
    return (
      <EmptyState
        icon={ChartIcon}
        title={t("noChart")}
        description={t("noChartText")}
      />
    );
  const width = 720,
    height = 196,
    left = 62,
    right = 20,
    top = 12,
    bottom = 32;
  const maximum =
    Math.max(
      10000,
      ...data.flatMap((item) => [item.sales_paise, item.expenses_paise]),
    ) * 1.15;
  const x = (i: number) =>
    data.length === 1
      ? (width + left - right) / 2
      : left + (i * (width - left - right)) / (data.length - 1);
  const y = (amount: number) =>
    top + (height - top - bottom) * (1 - amount / maximum);
  const points = (key: "sales_paise" | "expenses_paise") =>
    data.map((item, i) => `${x(i)},${y(item[key])}`).join(" ");
  const labels = [
    ...new Set([
      0,
      Math.floor((data.length - 1) / 3),
      Math.floor(((data.length - 1) * 2) / 3),
      data.length - 1,
    ]),
  ];
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("salesChartHint")}
      >
        <defs>
          <linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#c4afd9" stopOpacity=".43" />
            <stop offset="100%" stopColor="#e6e0f0" stopOpacity=".06" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => {
          const value = (maximum * i) / 3;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={width - right}
                y1={y(value)}
                y2={y(value)}
                stroke="#ebe7e3"
                strokeDasharray="3 5"
              />
              <text x={left - 12} y={y(value) + 4} textAnchor="end">
                {money(value, language, true)}
              </text>
            </g>
          );
        })}
        <polygon
          points={`${x(0)},${y(0)} ${points("sales_paise")} ${x(data.length - 1)},${y(0)}`}
          fill="url(#sales-area)"
        />
        <polyline
          points={points("sales_paise")}
          fill="none"
          stroke="#6f4e37"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polyline
          points={points("expenses_paise")}
          fill="none"
          stroke="#b5a2c6"
          strokeWidth="2"
          strokeDasharray="4 4"
          strokeLinejoin="round"
        />
        {data.map((row, i) => (
          <circle
            key={row.date}
            cx={x(i)}
            cy={y(row.sales_paise)}
            r={data.length > 31 ? 1.5 : 3.5}
            fill="#6f4e37"
            stroke="#fff"
            strokeWidth="1.5"
          >
            <title>
              {localDate(row.date, language)}: {t("sales")}{" "}
              {money(row.sales_paise, language)}, {t("expenses")}{" "}
              {money(row.expenses_paise, language)}
            </title>
          </circle>
        ))}
        {labels.map((i) => (
          <text key={i} x={x(i)} y={height - 4} textAnchor="middle">
            {localDate(data[i].date, language, true)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <span>
          <i />
          {t("salesLabel")}
        </span>
        <span>
          <i className="legend-expense" />
          {t("expenseLabel")}
        </span>
      </div>
    </div>
  );
}
const ChartIcon: LucideIcon = ArrowUpRight;

export function Overview({
  report,
  sales,
  products,
  language,
  navigate,
  editProduct,
  addSale,
}: {
  report: BusinessReport;
  sales: Sale[];
  products: Product[];
  language: Language;
  navigate: (screen: Screen) => void;
  editProduct: (product: Product) => void;
  addSale: () => void;
}) {
  const t = translator(language);
  const metrics: {
    label: TranslationKey;
    value: string;
    hint: string;
    Icon: LucideIcon;
    color: string;
  }[] = [
    {
      label: "totalSales",
      value: money(report.sales_paise, language),
      hint: `${report.transactions} ${t("transactions")}`,
      Icon: ArrowUpRight,
      color: "mocha",
    },
    {
      label: "totalExpenses",
      value: money(report.expenses_paise, language),
      hint: t("periodLabel"),
      Icon: ArrowDownLeft,
      color: "silver",
    },
    {
      label: "netProfit",
      value: money(report.profit_paise, language),
      hint: t("profitHint"),
      Icon: Wallet,
      color: "lavender",
    },
    {
      label: "products",
      value: quantity(report.active_products),
      hint: `${money(report.stock_value_paise, language, true)} ${t("inventoryValue")}`,
      Icon: Boxes,
      color: "cream",
    },
  ];
  return (
    <>
      <div className="metrics-grid">
        {metrics.map(({ label, value, hint, Icon, color }) => (
          <section key={label} className="metric-card">
            <div className="metric-top">
              <span>{t(label)}</span>
              <i className={`metric-icon ${color}`}>
                <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              </i>
            </div>
            <strong>{value}</strong>
            <p>{hint}</p>
          </section>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("salesOverview")}</h2>
              <p>{t("salesChartHint")}</p>
            </div>
            <span className="subtle-tag">
              {report.start_date === report.end_date
                ? localDate(report.start_date, language, true)
                : `${localDate(report.start_date, language, true)} – ${localDate(report.end_date, language, true)}`}
            </span>
          </div>
          <SalesChart report={report} language={language} />
        </section>
        <section className="panel stock-panel">
          <div className="panel-heading">
            <div>
              <h2>{t("lowStock")}</h2>
              <p>{t("lowStockSubtitle")}</p>
            </div>
            <span className="count-badge">{report.low_stock.length}</span>
          </div>
          {report.low_stock.length ? (
            <>
              <div className="low-stock-list">
                {report.low_stock.slice(0, 4).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="low-stock-row"
                    onClick={() => {
                      const product = products.find(
                        (product) => product.id === item.id,
                      );
                      if (product) editProduct(product);
                    }}
                    aria-label={`${t("restock")}: ${item.name}`}
                  >
                    <span className="stock-alert-icon">
                      <Package size={18} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>
                        {language === "kn" && item.kannada_name
                          ? item.kannada_name
                          : item.name}
                      </strong>
                      <small>
                        {quantity(item.stock)} {t(item.unit)} {t("remaining")}
                      </small>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="text-link stock-view-all"
                onClick={() => navigate("inventory")}
              >
                {t("viewAll")}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </>
          ) : (
            <EmptyState
              icon={CircleCheck}
              title={t("healthyStock")}
              description={t("healthyStockText")}
            />
          )}
        </section>
      </div>
      <div className="overview-bottom">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <h2>{t("recentActivity")}</h2>
            <button
              type="button"
              className="text-link"
              onClick={() => navigate("sales")}
            >
              {t("viewAll")}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          <SalesTable
            sales={sales.slice(0, 5)}
            language={language}
            compact
            emptyAction={
              <Button variant="secondary" onClick={addSale}>
                <Plus size={16} aria-hidden="true" />
                {t("addSale")}
              </Button>
            }
          />
        </section>
        <section className="insight-panel">
          <div className="insight-star">
            <Sparkles size={26} strokeWidth={1.3} aria-hidden="true" />
          </div>
          <span className="eyebrow">VYAPAAR ASSISTANT</span>
          <h2>{t("quickInsight")}</h2>
          <p>{t("insightText")}</p>
          <Button variant="secondary" onClick={() => navigate("assistant")}>
            {t("askAssistant")}
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <div className="insight-decoration" aria-hidden="true">
            ✳
          </div>
        </section>
      </div>
    </>
  );
}

export function Inventory({
  products,
  language,
  addProduct,
  editProduct,
  archive,
}: {
  products: Product[];
  language: Language;
  addProduct: () => void;
  editProduct: (item: Product) => void;
  archive: (item: Product) => void;
}) {
  const t = translator(language);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const filtered = products.filter(
    (item) =>
      `${item.name} ${item.kannada_name} ${item.category}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!lowOnly || item.stock <= item.low_stock_threshold),
  );
  return (
    <section className="panel">
      <div className="table-toolbar">
        <div className="segmented">
          <button
            type="button"
            aria-pressed={!lowOnly}
            onClick={() => setLowOnly(false)}
          >
            {t("allProducts")}
            <span>{products.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={lowOnly}
            onClick={() => setLowOnly(true)}
          >
            {t("lowOnly")}
            <span>
              {
                products.filter(
                  (item) => item.stock <= item.low_stock_threshold,
                ).length
              }
            </span>
          </button>
        </div>
        <label className="search-box">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            aria-label={t("searchProducts")}
            placeholder={t("searchProducts")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(
                  [
                    "product",
                    "category",
                    "stock",
                    "price",
                    "status",
                    "actions",
                  ] as const
                ).map((key) => (
                  <th key={key}>{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <ProductName product={item} language={language} />
                  </td>
                  <td className="muted">
                    {item.category === "General" ? t("general") : item.category}
                  </td>
                  <td>
                    <strong>{quantity(item.stock)}</strong>{" "}
                    <span className="muted">{t(item.unit)}</span>
                  </td>
                  <td>{money(item.price_paise, language)}</td>
                  <td>
                    <span
                      className={`status-tag ${item.stock <= item.low_stock_threshold ? "status-low" : "status-good"}`}
                    >
                      <i />
                      {t(
                        item.stock === 0
                          ? "outOfStock"
                          : item.stock <= item.low_stock_threshold
                            ? "low"
                            : "inStock",
                      )}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => editProduct(item)}
                        aria-label={`${t("edit")}: ${item.name}`}
                      >
                        <Edit3 size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => archive(item)}
                        aria-label={`${t("archive")}: ${item.name}`}
                      >
                        <Boxes size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title={t(products.length ? "noResults" : "emptyInventory")}
          description={t(
            products.length ? "noResultsText" : "emptyInventoryText",
          )}
          action={
            !products.length && (
              <Button onClick={addProduct}>
                <Plus size={16} aria-hidden="true" />
                {t("addProduct")}
              </Button>
            )
          }
        />
      )}
      <div className="table-footer">
        {filtered.length} / {products.length} {t("items")}
      </div>
    </section>
  );
}

export function SalesTable({
  sales,
  language,
  compact = false,
  emptyAction,
}: {
  sales: Sale[];
  language: Language;
  compact?: boolean;
  emptyAction?: React.ReactNode;
}) {
  const t = translator(language);
  if (!sales.length)
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t("noSales")}
        description={t("noSalesText")}
        action={emptyAction}
      />
    );
  return (
    <div className="table-scroll">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>
            <th>{t("product")}</th>
            <th>{t("date")}</th>
            <th>{t("qty")}</th>
            <th className="align-right">{t("amount")}</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id}>
              <td>
                <div className="product-name">
                  <span className="product-icon">
                    <ShoppingBag
                      size={17}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>
                  <strong>{sale.product_name}</strong>
                </div>
              </td>
              <td className="muted">
                {localDate(sale.sale_date, language, true)}
              </td>
              <td>
                {quantity(sale.quantity)}{" "}
                <span className="muted">{t(sale.unit)}</span>
              </td>
              <td className="align-right">
                <strong>{money(sale.total_paise, language)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SalesScreen({
  sales,
  report,
  language,
  add,
}: {
  sales: Sale[];
  report: BusinessReport;
  language: Language;
  add: () => void;
}) {
  const t = translator(language),
    [search, setSearch] = useState("");
  const filtered = sales.filter((sale) =>
    sale.product_name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="period-total">
        <span>
          <ShoppingBag size={20} aria-hidden="true" />
          {t("periodSales")}
        </span>
        <strong>{money(report.sales_paise, language)}</strong>
        <small>
          {report.transactions} {t("transactions")}
        </small>
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <h2>{t("sales")}</h2>
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              aria-label={t("searchSales")}
              placeholder={t("searchSales")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        {filtered.length || !sales.length ? (
          <SalesTable
            sales={filtered}
            language={language}
            emptyAction={
              <Button onClick={add}>
                <Plus size={16} aria-hidden="true" />
                {t("addSale")}
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title={t("noResults")}
            description={t("noResultsText")}
          />
        )}
        <div className="table-footer">
          {sales.length >= 200
            ? t("filteredLimit")
            : `${filtered.length} ${t("records")}`}
        </div>
      </section>
    </>
  );
}

export function ExpensesScreen({
  expenses,
  report,
  language,
  add,
  edit,
  remove,
}: {
  expenses: Expense[];
  report: BusinessReport;
  language: Language;
  add: () => void;
  edit: (expense: Expense) => void;
  remove: (expense: Expense) => void;
}) {
  const t = translator(language),
    [search, setSearch] = useState("");
  const filtered = expenses.filter((expense) =>
    `${expense.description} ${t(expense.category)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="period-total">
        <span>
          <ReceiptIndianRupee size={20} aria-hidden="true" />
          {t("periodExpenses")}
        </span>
        <strong>{money(report.expenses_paise, language)}</strong>
      </div>
      <div className="expenses-layout">
        <section className="panel">
          <div className="table-toolbar">
            <h2>{t("expenses")}</h2>
            <label className="search-box">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                aria-label={t("searchExpenses")}
                placeholder={t("searchExpenses")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          {filtered.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {(
                      [
                        "expenseDescription",
                        "category",
                        "date",
                        "amount",
                        "actions",
                      ] as const
                    ).map((key) => (
                      <th key={key}>{t(key)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((expense) => (
                    <tr key={expense.id}>
                      <td>
                        <strong>{expense.description}</strong>
                      </td>
                      <td>
                        <span className="category-tag">
                          {t(expense.category)}
                        </span>
                      </td>
                      <td className="muted">
                        {localDate(expense.expense_date, language, true)}
                      </td>
                      <td>
                        <strong>{money(expense.amount_paise, language)}</strong>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => edit(expense)}
                            aria-label={`${t("edit")}: ${expense.description}`}
                          >
                            <Edit3 size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => remove(expense)}
                            aria-label={`${t("delete")}: ${expense.description}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={ReceiptIndianRupee}
              title={t(expenses.length ? "noResults" : "noExpenses")}
              description={t(
                expenses.length ? "noResultsText" : "noExpensesText",
              )}
              action={
                !expenses.length && (
                  <Button onClick={add}>
                    <Plus size={16} aria-hidden="true" />
                    {t("addExpense")}
                  </Button>
                )
              }
            />
          )}
          <div className="table-footer">
            {expenses.length >= 200
              ? t("filteredLimit")
              : `${filtered.length} ${t("records")}`}
          </div>
        </section>
        <aside className="panel expense-breakdown">
          <h2>{t("expenseBreakdown")}</h2>
          {report.expense_categories.length ? (
            report.expense_categories.map((item) => (
              <div className="expense-category-row" key={item.category}>
                <div>
                  <span>{t(item.category as Expense["category"])}</span>
                  <strong>{money(item.amount_paise, language)}</strong>
                </div>
                <div className="category-track">
                  <i
                    style={{
                      width: `${(item.amount_paise / report.expenses_paise) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState icon={Wallet} title={t("noExpenseCategories")} />
          )}
        </aside>
      </div>
    </>
  );
}

export function SettingsScreen({
  profile,
  email,
  language,
  onSave,
  signOut,
}: {
  profile: Profile;
  email: string;
  language: Language;
  onSave: (values: Omit<Profile, "id">) => Promise<void>;
  signOut: () => void;
}) {
  const t = translator(language),
    [values, setValues] = useState(profile),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSave(values);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="settings-form" onSubmit={submit}>
      <section className="panel settings-panel">
        <div className="settings-section-heading">
          <span className="settings-icon">
            <ShoppingBag size={20} aria-hidden="true" />
          </span>
          <div>
            <h2>{t("shopDetails")}</h2>
            <p>{email}</p>
          </div>
        </div>
        <div className="field-grid">
          <Field label={t("ownerName")}>
            <input
              required
              maxLength={80}
              value={values.owner_name}
              onChange={(event) =>
                setValues({ ...values, owner_name: event.target.value })
              }
            />
          </Field>
          <Field label={t("shopName")}>
            <input
              required
              maxLength={120}
              value={values.shop_name}
              onChange={(event) =>
                setValues({ ...values, shop_name: event.target.value })
              }
            />
          </Field>
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>{t("languagePreferences")}</h2>
        <div className="setting-row">
          <div>
            <h3>{t("uiLanguage")}</h3>
            <p>{t("uiLanguageHint")}</p>
          </div>
          <select
            aria-label={t("uiLanguage")}
            value={values.ui_language}
            onChange={(event) =>
              setValues({
                ...values,
                ui_language: event.target.value as Language,
              })
            }
          >
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
        </div>
        <div className="setting-row">
          <div>
            <h3>{t("aiLanguage")}</h3>
            <p>{t("aiLanguageHint")}</p>
          </div>
          <select
            aria-label={t("aiLanguage")}
            value={values.ai_language}
            onChange={(event) =>
              setValues({
                ...values,
                ai_language: event.target.value as Language,
              })
            }
          >
            <option value="en">English</option>
            <option value="kn">ಕನ್ನಡ</option>
          </select>
        </div>
        <label className="setting-row switch-row">
          <div>
            <h3>{t("autoSpeak")}</h3>
            <p>{t("autoSpeakHint")}</p>
          </div>
          <input
            type="checkbox"
            role="switch"
            checked={values.auto_speak}
            onChange={(event) =>
              setValues({ ...values, auto_speak: event.target.checked })
            }
          />
        </label>
      </section>
      <div className="settings-actions">
        <Button variant="secondary" onClick={signOut} disabled={busy}>
          {t("signOut")}
        </Button>
        <Button type="submit" loading={busy}>
          <Check size={16} aria-hidden="true" />
          {t("saveSettings")}
        </Button>
      </div>
    </form>
  );
}
