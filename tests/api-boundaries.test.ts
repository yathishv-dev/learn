import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { ApiError, errorResponse, readBody } from "../src/lib/server";

test("API input rejects malformed JSON, invalid values and oversized bodies", async () => {
  const schema = z.object({ question: z.string().min(1).max(100) });
  const make = (body: string) =>
    new Request("http://localhost/api/chat", { method: "POST", body });
  assert.deepEqual(
    await readBody(make('{"question":"Today’s sales?"}'), schema),
    { question: "Today’s sales?" },
  );
  await assert.rejects(readBody(make("{broken"), schema), /INVALID_REQUEST/);
  await assert.rejects(
    readBody(make('{"question":""}'), schema),
    /INVALID_REQUEST/,
  );
  await assert.rejects(
    readBody(make("a".repeat(24_001)), schema),
    /REQUEST_TOO_LARGE/,
  );
});
test("API failures hide provider and database details", async () => {
  const response = errorResponse(
    new Error("secret provider token / database password"),
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "REQUEST_FAILED" });
  const auth = errorResponse(new ApiError(401, "AUTH_REQUIRED"));
  assert.equal(auth.status, 401);
  assert.deepEqual(await auth.json(), { error: "AUTH_REQUIRED" });
  assert.equal(errorResponse(new Error("AI_RATE_LIMIT")).status, 429);
});
