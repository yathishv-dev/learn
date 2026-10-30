"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { BusinessReport, Expense, Product, Sale } from "@/lib/types";

export function useShopData(ownerId: string, start: string, end: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<BusinessReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setBusy(true);
    setError(null);
    try {
      const db = getSupabase();
      const fetchProducts = async () => {
        const records: Product[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await db
            .from("products")
            .select("*")
            .eq("user_id", ownerId)
            .eq("active", true)
            .order("name")
            .order("id")
            .range(offset, offset + 499);
          if (error) throw error;
          records.push(...(data as Product[]));
          if (data.length < 500) break;
        }
        return records;
      };
      const [items, saleResult, expenseResult, reportResult] =
        await Promise.all([
          fetchProducts(),
          db
            .from("sales")
            .select("*")
            .eq("user_id", ownerId)
            .gte("sale_date", start)
            .lte("sale_date", end)
            .order("sale_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(200),
          db
            .from("expenses")
            .select("*")
            .eq("user_id", ownerId)
            .gte("expense_date", start)
            .lte("expense_date", end)
            .order("expense_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(200),
          db.rpc("business_report", { p_start: start, p_end: end }),
        ]);
      if (saleResult.error) throw saleResult.error;
      if (expenseResult.error) throw expenseResult.error;
      if (reportResult.error) throw reportResult.error;
      if (current !== generation.current) return;
      setProducts(items);
      setSales(saleResult.data as Sale[]);
      setExpenses(expenseResult.data as Expense[]);
      setReport(reportResult.data as BusinessReport);
    } catch (error) {
      if (current === generation.current) setError(error);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }, [ownerId, start, end]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  return { products, sales, expenses, report, busy, error, refresh };
}
