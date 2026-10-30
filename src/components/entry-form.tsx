"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Check,
  ClipboardCheck,
  Package,
  ReceiptIndianRupee,
  ShoppingBag,
} from "lucide-react";
import { money, quantity, todayInIndia, toPaise } from "@/lib/business";
import { friendlyError, translator } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import type {
  EntryDraft,
  EntryKind,
  Expense,
  Language,
  Product,
} from "@/lib/types";
import { Alert, Button, Field, Modal } from "./ui";

export function EntryForm({
  kind,
  draft,
  product,
  expense,
  products,
  ownerId,
  language,
  onClose,
  onSaved,
  refresh,
}: {
  kind: EntryKind;
  draft?: EntryDraft;
  product?: Product;
  expense?: Expense;
  products: Product[];
  ownerId: string;
  language: Language;
  onClose: () => void;
  onSaved: (message: string) => void;
  refresh: () => Promise<void>;
}) {
  const t = translator(language);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState(draft?.product_id || "");
  const [saleQuantity, setSaleQuantity] = useState(
    String(draft?.quantity ?? ""),
  );
  const [conflict, setConflict] = useState(false);
  const requestId = useRef<string | null>(null);
  const selected = products.find((item) => item.id === productId);
  const draftStock =
    draft?.quantity == null
      ? product?.stock
      : draft.stock_change === "add" && product
        ? Math.round((product.stock + draft.quantity) * 1000) / 1000
        : draft.quantity;
  const title = draft
    ? t("reviewDraft")
    : kind === "sale"
      ? t("addSale")
      : kind === "product"
        ? t(product ? "editProduct" : "addProduct")
        : t("addExpense");
  const Icon =
    kind === "sale"
      ? ShoppingBag
      : kind === "product"
        ? Package
        : ReceiptIndianRupee;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date") || todayInIndia());
    if (date > todayInIndia()) {
      setError(t("invalidDate"));
      return;
    }
    const numericQuantity = Number(
      kind === "sale" ? saleQuantity : data.get("stock"),
    );
    if (
      kind !== "expense" &&
      (!Number.isFinite(numericQuantity) ||
        numericQuantity < (kind === "sale" ? 0.001 : 0) ||
        numericQuantity > 1_000_000 ||
        Math.abs(numericQuantity * 1000 - Math.round(numericQuantity * 1000)) >
          0.000001)
    ) {
      setError(t("invalidQuantity"));
      return;
    }
    if (kind === "sale" && (!selected || numericQuantity > selected.stock)) {
      setError(t(selected ? "insufficientStock" : "requiredFields"));
      return;
    }
    setBusy(true);
    requestId.current ??= crypto.randomUUID();
    try {
      const db = getSupabase();
      if (kind === "sale") {
        const { error } = await db.rpc("record_sale", {
          p_id: requestId.current,
          p_product_id: productId,
          p_quantity: numericQuantity,
          p_date: date,
          p_price_paise: selected!.price_paise,
        });
        if (error) throw error;
      } else if (kind === "product") {
        const values = {
          user_id: ownerId,
          name: String(data.get("name")).trim(),
          kannada_name: String(data.get("kannada_name") || "").trim(),
          category:
            String(data.get("category") || "General").trim() || "General",
          unit: String(data.get("unit")),
          stock: numericQuantity,
          price_paise: toPaise(String(data.get("price"))),
          cost_paise: toPaise(String(data.get("cost"))),
          low_stock_threshold: Number(data.get("threshold")),
        };
        if (product) {
          const { data: saved, error } = await db
            .from("products")
            .update(values)
            .eq("id", product.id)
            .eq("version", product.version)
            .select("id");
          if (error) throw error;
          if (!saved.length) {
            setConflict(true);
            // Do not silently overwrite stale stock. Close/reopen to review it.
            throw new Error("STOCK_CHANGED");
          }
        } else {
          const { error } = await db
            .from("products")
            .insert({ id: requestId.current, ...values });
          if (error) throw error;
        }
      } else {
        const values = {
          user_id: ownerId,
          description: String(data.get("description")).trim(),
          category: String(data.get("category")),
          amount_paise: toPaise(String(data.get("amount"))),
          expense_date: date,
        };
        const result = expense
          ? await db.from("expenses").update(values).eq("id", expense.id)
          : await db
              .from("expenses")
              .insert({ id: requestId.current, ...values });
        if (result.error) throw result.error;
      }
      onSaved(
        t(
          kind === "sale"
            ? "saleSaved"
            : kind === "product"
              ? "productSaved"
              : "expenseSaved",
        ),
      );
    } catch (err) {
      setError(friendlyError(err, language));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      subtitle={draft ? t("reviewHint") : undefined}
      closeLabel={t("close")}
      onClose={onClose}
      busy={busy}
    >
      {draft?.transcript && (
        <div className="review-transcript">
          <ClipboardCheck size={18} aria-hidden="true" />
          <div>
            <span>{t("transcript")}</span>
            <p>“{draft.transcript}”</p>
          </div>
        </div>
      )}
      {draft?.warning && <Alert>{draft.warning}</Alert>}
      <div className="form-kind">
        <Icon size={17} aria-hidden="true" />
        {t(
          kind === "sale"
            ? "sales"
            : kind === "product"
              ? "inventory"
              : "expenses",
        )}
        {draft && (
          <span>
            <Check size={13} aria-hidden="true" />
            {t("notSaved")}
          </span>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={submit} className="entry-form">
        {kind === "sale" && (
          <>
            <Field label={t("product")}>
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                <option value="">{t("chooseProduct")}</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {language === "kn" && item.kannada_name
                      ? item.kannada_name
                      : item.name}{" "}
                    · {quantity(item.stock)} {t(item.unit)}
                  </option>
                ))}
              </select>
            </Field>
            {!products.length && <Alert>{t("noProductForSale")}</Alert>}
            <div className="field-grid">
              <Field
                label={t("qty")}
                hint={
                  selected
                    ? `${t("available")}: ${quantity(selected.stock)} ${t(selected.unit)}`
                    : undefined
                }
              >
                <input
                  type="number"
                  min="0.001"
                  max={selected?.stock || 1_000_000}
                  step="0.001"
                  required
                  value={saleQuantity}
                  onChange={(event) => setSaleQuantity(event.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field label={t("saleDate")}>
                <input
                  name="date"
                  type="date"
                  required
                  max={todayInIndia()}
                  defaultValue={draft?.date || todayInIndia()}
                />
              </Field>
            </div>
            <div className="sale-total">
              <div>
                <span>{t("reviewTotal")}</span>
                <small>
                  {selected
                    ? `${money(selected.price_paise, language)} / ${t(selected.unit)}`
                    : t("unitPrice")}
                </small>
              </div>
              <strong>
                {money(
                  selected
                    ? Math.round(
                        selected.price_paise * (Number(saleQuantity) || 0),
                      )
                    : 0,
                  language,
                )}
              </strong>
            </div>
            <p className="field-hint">{t("saleHint")}</p>
          </>
        )}
        {kind === "product" && (
          <>
            <Field label={t("name")}>
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={product?.name || draft?.name || ""}
              />
            </Field>
            <Field label={t("kannadaName")}>
              <input
                name="kannada_name"
                maxLength={120}
                lang="kn"
                defaultValue={
                  product?.kannada_name || draft?.kannada_name || ""
                }
              />
            </Field>
            <div className="field-grid">
              <Field label={t("category")}>
                <input
                  name="category"
                  maxLength={60}
                  placeholder={t("categoryPlaceholder")}
                  defaultValue={product?.category || draft?.category || ""}
                />
              </Field>
              <Field label={t("unit")}>
                <select
                  name="unit"
                  defaultValue={product?.unit || draft?.unit || "piece"}
                >
                  {(["piece", "kg", "litre", "pack"] as const).map((unit) => (
                    <option key={unit} value={unit}>
                      {t(unit)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="field-grid">
              <Field label={`${t("price")} (₹)`}>
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  required
                  defaultValue={
                    draft?.price ?? (product ? product.price_paise / 100 : "")
                  }
                />
              </Field>
              <Field label={`${t("cost")} (₹)`}>
                <input
                  name="cost"
                  type="number"
                  min="0"
                  max="10000000"
                  step="0.01"
                  required
                  defaultValue={
                    draft?.cost ?? (product ? product.cost_paise / 100 : "")
                  }
                />
              </Field>
            </div>
            <div className="field-grid">
              <Field label={t("initialStock")}>
                <input
                  name="stock"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.001"
                  required
                  defaultValue={draftStock ?? ""}
                />
              </Field>
              <Field label={t("threshold")}>
                <input
                  name="threshold"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.001"
                  required
                  defaultValue={
                    draft?.threshold ?? product?.low_stock_threshold ?? 5
                  }
                />
              </Field>
            </div>
            <p className="field-hint">{t("thresholdHint")}</p>
          </>
        )}
        {kind === "expense" && (
          <>
            <Field label={t("expenseDescription")}>
              <input
                name="description"
                required
                maxLength={240}
                placeholder={t("descriptionPlaceholder")}
                defaultValue={expense?.description || draft?.description || ""}
              />
            </Field>
            <Field label={t("expenseCategory")}>
              <select
                name="category"
                defaultValue={expense?.category || draft?.category || "other"}
              >
                {(
                  [
                    "rent",
                    "utilities",
                    "transport",
                    "supplies",
                    "salary",
                    "other",
                  ] as const
                ).map((category) => (
                  <option key={category} value={category}>
                    {t(category)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="field-grid">
              <Field label={`${t("amount")} (₹)`}>
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  max="10000000"
                  step="0.01"
                  required
                  defaultValue={
                    expense ? expense.amount_paise / 100 : (draft?.amount ?? "")
                  }
                />
              </Field>
              <Field label={t("expenseDate")}>
                <input
                  name="date"
                  type="date"
                  required
                  max={todayInIndia()}
                  defaultValue={
                    expense?.expense_date || draft?.date || todayInIndia()
                  }
                />
              </Field>
            </div>
          </>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={conflict || (kind === "sale" && !products.length)}
          >
            <Check size={16} aria-hidden="true" />
            {t(
              kind === "sale"
                ? "saveSale"
                : kind === "product"
                  ? "saveProduct"
                  : "saveExpense",
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
