import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Profile } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function authenticatedShop(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ApiError(503, "SUPABASE_NOT_CONFIGURED");
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ApiError(401, "AUTH_REQUIRED");
  // This client retains the caller's RLS permissions. No service-role key.
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const {
    data: { user },
    error,
  } = await db.auth.getUser(token);
  if (error || !user) throw new ApiError(401, "AUTH_REQUIRED");
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("id,owner_name,shop_name,ui_language,ai_language,auto_speak")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) throw new ApiError(409, "PROFILE_NOT_FOUND");
  return { db, user, profile: profile as Profile };
}

export function requireAI(speech = false) {
  if (!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN))
    throw new ApiError(503, "AI_NOT_CONFIGURED");
  const model = speech ? process.env.AI_SPEECH_MODEL : process.env.AI_MODEL;
  if (!model) throw new ApiError(503, "AI_NOT_CONFIGURED");
  return model;
}

export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 24_000) throw new ApiError(413, "REQUEST_TOO_LARGE");
  const text = await request.text();
  if (text.length > 24_000) throw new ApiError(413, "REQUEST_TOO_LARGE");
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new ApiError(400, "INVALID_REQUEST");
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  // Keep provider credentials, stack traces, and database details out of responses.
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "";
  if (message.includes("AI_RATE_LIMIT"))
    return Response.json({ error: "AI_RATE_LIMIT" }, { status: 429 });
  return Response.json({ error: "REQUEST_FAILED" }, { status: 502 });
}
