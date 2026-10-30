import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dateSchema,
  daysAgo,
  money,
  reportRangeSchema,
  todayInIndia,
  toPaise,
} from "../src/lib/business";

test("shop dates use India time on both sides of midnight", () => {
  assert.equal(todayInIndia(new Date("2026-10-30T18:29:59Z")), "2026-10-30");
  assert.equal(todayInIndia(new Date("2026-10-30T18:30:00Z")), "2026-10-31");
  assert.equal(daysAgo(6, "2026-03-02"), "2026-02-24");
});
test("amounts are integer paise with no floating point cents", () => {
  assert.equal(toPaise("0.29"), 29);
  assert.equal(toPaise("10.01"), 1001);
  assert.equal(toPaise("1.005"), 101);
  assert.throws(() => toPaise(-1));
  assert.throws(() => toPaise("not an amount"));
  assert.match(money(12550), /125\.50/);
});
test("report ranges reject impossible dates, reversed dates and unbounded reads", () => {
  assert.equal(dateSchema.safeParse("2026-02-29").success, false);
  assert.equal(dateSchema.safeParse("2024-02-29").success, true);
  assert.equal(
    reportRangeSchema.safeParse({ start: "2026-03-01", end: "2026-02-01" })
      .success,
    false,
  );
  assert.equal(
    reportRangeSchema.safeParse({ start: "2020-01-01", end: "2026-01-01" })
      .success,
    false,
  );
  assert.equal(
    reportRangeSchema.safeParse({ start: "2026-01-01", end: "2026-10-30" })
      .success,
    true,
  );
});
