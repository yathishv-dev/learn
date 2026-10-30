import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { BusinessReport } from "../src/lib/types";

test(
  "Postgres migration, business calculations and account isolation",
  { timeout: 120_000 },
  async (t) => {
    const db = new PGlite();
    t.after(() => db.close());
    const ownerA = "00000000-0000-4000-8000-000000000001";
    const ownerB = "00000000-0000-4000-8000-000000000002";
    // Recreate Supabase's auth boundary for the actual migration. All subsequent
    // business queries run as authenticated, which does not bypass RLS.
    await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;`);
    for (const file of (await readdir("supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    await db.query("insert into auth.users(id) values($1),($2)", [
      ownerA,
      ownerB,
    ]);
    await db.exec("set role authenticated");
    const asOwner = async (owner: string) => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        owner,
      ]);
    };
    for (const owner of [ownerA, ownerB]) {
      await asOwner(owner);
      await db.query(
        "insert into public.profiles(id,owner_name,shop_name) values($1,'Owner','Shop')",
        [owner],
      );
    }
    await asOwner(ownerA);
    const productA = crypto.randomUUID(),
      saleA = crypto.randomUUID();
    await db.query(
      "insert into public.products(id,name,stock,price_paise,cost_paise,unit,low_stock_threshold) values($1,'Rice',10,10000,6000,'kg',9)",
      [productA],
    );
    const stock = async (id: string) =>
      Number(
        (
          await db.query<{ stock: string }>(
            "select stock from public.products where id=$1",
            [id],
          )
        ).rows[0]?.stock,
      );
    const report = async (start = "2020-01-02", end = start) =>
      (
        await db.query<{ result: BusinessReport }>(
          "select public.business_report($1::date,$2::date) as result",
          [start, end],
        )
      ).rows[0].result;
    const sell = (
      id: string,
      productId: string,
      amount: number,
      date = "2020-01-02",
      price = 10000,
    ) =>
      db.query(
        "select public.record_sale($1::uuid,$2::uuid,$3::numeric,$4::date,$5::bigint)",
        [id, productId, amount, date, price],
      );

    await t.test(
      "fractional sales atomically reduce stock and calculate profit in paise",
      async () => {
        await sell(saleA, productA, 1.25);
        await db.query(
          "insert into public.expenses(description,category,amount_paise,expense_date) values('Delivery','transport',1000,'2020-01-02')",
        );
        assert.equal(await stock(productA), 8.75);
        const result = await report();
        assert.equal(result.sales_paise, 12500);
        assert.equal(result.cost_of_goods_paise, 7500);
        assert.equal(result.expenses_paise, 1000);
        assert.equal(result.profit_paise, 4000);
        assert.equal(result.transactions, 1);
        assert.equal(result.stock_value_paise, 52500);
        assert.equal(result.low_stock.length, 1);
        assert.equal(result.daily.length, 1);
      },
    );
    await t.test(
      "a retry is idempotent and historical figures survive price changes",
      async () => {
        await db.query(
          "update public.products set price_paise=20000,cost_paise=9999 where id=$1",
          [productA],
        );
        await sell(saleA, productA, 1.25);
        assert.equal(await stock(productA), 8.75);
        assert.equal((await report()).profit_paise, 4000);
        await assert.rejects(sell(saleA, productA, 2), /REQUEST_ID_REUSED/);
        await assert.rejects(
          sell(crypto.randomUUID(), productA, 1),
          /PRICE_CHANGED/,
        );
        assert.equal(await stock(productA), 8.75);
      },
    );
    await t.test(
      "oversells and invalid inputs roll back without a stock decrement",
      async () => {
        await assert.rejects(
          sell(crypto.randomUUID(), productA, 1000, "2020-01-02", 20000),
          /INSUFFICIENT_STOCK/,
        );
        await assert.rejects(
          sell(crypto.randomUUID(), productA, -1),
          /INVALID_QUANTITY/,
        );
        await assert.rejects(
          sell(crypto.randomUUID(), productA, 0.0001),
          /INVALID_QUANTITY/,
        );
        await assert.rejects(
          sell(crypto.randomUUID(), productA, 1, "2999-01-01"),
          /INVALID_DATE/,
        );
        assert.equal(await stock(productA), 8.75);
        assert.equal((await report()).transactions, 1);
      },
    );
    await t.test(
      "direct inserts cannot forge transaction prices, costs or stock",
      async () => {
        const id = crypto.randomUUID();
        await db.query(
          "insert into public.sales(id,product_id,quantity,unit_price_paise,total_paise,cost_paise,sale_date) values($1,$2,1,1,1,1,'2020-01-03')",
          [id, productA],
        );
        const { rows } = await db.query<{
          unit_price_paise: number;
          total_paise: number;
          cost_paise: number;
        }>(
          "select unit_price_paise,total_paise,cost_paise from public.sales where id=$1",
          [id],
        );
        assert.equal(Number(rows[0].unit_price_paise), 20000);
        assert.equal(Number(rows[0].total_paise), 20000);
        assert.equal(Number(rows[0].cost_paise), 9999);
        const before = await stock(productA);
        await assert.rejects(
          db.query(
            "insert into public.sales(id,product_id,quantity,sale_date) values($1,$2,1,'2020-01-03')",
            [id, productA],
          ),
          /duplicate key/,
        );
        assert.equal(await stock(productA), before);
      },
    );
    await t.test(
      "stale inventory edits cannot overwrite stock changed by a sale",
      async () => {
        const { rows } = await db.query<{ version: number }>(
          "select version from public.products where id=$1",
          [productA],
        );
        await sell(crypto.randomUUID(), productA, 1, "2020-01-04", 20000);
        const result = await db.query(
          "update public.products set stock=50 where id=$1 and version=$2 returning id",
          [productA, rows[0].version],
        );
        assert.equal(result.rows.length, 0);
        assert.equal(await stock(productA), 6.75);
      },
    );
    await t.test(
      "the report aggregates more than the Data API's default 1000-row limit",
      async () => {
        await db.query(
          "insert into public.sales(id,product_id,quantity,sale_date) select gen_random_uuid(),$1::uuid,0.001,'2020-02-01' from generate_series(1,1005)",
          [productA],
        );
        const result = await report("2020-02-01");
        assert.equal(result.transactions, 1005);
        assert.equal(result.sales_paise, 20100);
      },
    );
    await t.test(
      "another owner cannot read, sell, reassign or modify this shop's data",
      async () => {
        await asOwner(ownerB);
        const productB = crypto.randomUUID();
        await db.query(
          "insert into public.products(id,name,stock,price_paise,cost_paise) values($1,'Rice',2,5000,3000)",
          [productB],
        );
        assert.equal(
          (await db.query("select id from public.products")).rows.length,
          1,
        );
        assert.equal(
          (await db.query("select id from public.sales")).rows.length,
          0,
        );
        assert.equal((await report()).sales_paise, 0);
        await assert.rejects(
          sell(crypto.randomUUID(), productA, 1),
          /PRODUCT_NOT_FOUND/,
        );
        const update = await db.query(
          "update public.products set stock=999 where id=$1 returning id",
          [productA],
        );
        assert.equal(update.rows.length, 0);
        await assert.rejects(
          db.query("update public.products set user_id=$1 where id=$2", [
            ownerA,
            productB,
          ]),
          /row-level security/,
        );
        await assert.rejects(
          db.query(
            "insert into public.expenses(user_id,description,amount_paise) values($1,'Other shop',100)",
            [ownerA],
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query("update public.sales set total_paise=0"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "AI usage limit is per shop and backed by the database",
      async () => {
        for (let i = 0; i < 20; i++)
          await db.query("select public.consume_ai_request()");
        await assert.rejects(
          db.query("select public.consume_ai_request()"),
          /AI_RATE_LIMIT/,
        );
        await asOwner(ownerA);
        await db.query("select public.consume_ai_request()");
        assert.equal(
          (await db.query("select id from public.ai_requests")).rows.length,
          1,
        );
      },
    );
    await t.test(
      "anonymous access and unbounded report ranges are rejected",
      async () => {
        await assert.rejects(
          report("2020-01-01", "2026-01-01"),
          /INVALID_DATE_RANGE/,
        );
        await db.exec("reset role; set role anon");
        await assert.rejects(
          db.query("select * from public.products"),
          /permission denied/,
        );
        await assert.rejects(
          db.query("select public.business_report('2020-01-01','2020-01-01')"),
          /permission denied/,
        );
      },
    );
  },
);
