export type Language = "en" | "kn";
export type Screen =
  "overview" | "inventory" | "sales" | "expenses" | "assistant" | "settings";
export type EntryKind = "sale" | "product" | "expense";
export type Unit = "piece" | "kg" | "litre" | "pack";
export type ExpenseCategory =
  "rent" | "utilities" | "transport" | "supplies" | "salary" | "other";

export interface Profile {
  id: string;
  owner_name: string;
  shop_name: string;
  ui_language: Language;
  ai_language: Language;
  auto_speak: boolean;
}
export interface Product {
  id: string;
  user_id: string;
  name: string;
  kannada_name: string;
  category: string;
  unit: Unit;
  stock: number;
  price_paise: number;
  cost_paise: number;
  low_stock_threshold: number;
  active: boolean;
  version: number;
  created_at: string;
}
export interface Sale {
  id: string;
  product_id: string;
  user_id: string;
  product_name: string;
  unit: Unit;
  quantity: number;
  unit_price_paise: number;
  total_paise: number;
  cost_paise: number;
  sale_date: string;
  created_at: string;
}
export interface Expense {
  id: string;
  user_id: string;
  description: string;
  category: ExpenseCategory;
  amount_paise: number;
  expense_date: string;
  created_at: string;
}
export interface BusinessReport {
  start_date: string;
  end_date: string;
  sales_paise: number;
  expenses_paise: number;
  cost_of_goods_paise: number;
  profit_paise: number;
  transactions: number;
  units_sold: number;
  active_products: number;
  stock_value_paise: number;
  low_stock: Pick<
    Product,
    "id" | "name" | "kannada_name" | "stock" | "unit" | "low_stock_threshold"
  >[];
  daily: { date: string; sales_paise: number; expenses_paise: number }[];
  top_products: { name: string; quantity: number; sales_paise: number }[];
  expense_categories: { category: string; amount_paise: number }[];
}
export interface EntryDraft {
  kind: EntryKind;
  product_id?: string;
  name?: string;
  kannada_name?: string;
  category?: string;
  unit?: Unit;
  quantity?: number;
  price?: number;
  cost?: number;
  threshold?: number;
  stock_change?: "set" | "add";
  warning?: string;
  description?: string;
  amount?: number;
  date?: string;
  transcript?: string;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}
