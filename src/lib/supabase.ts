import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  if (!client)
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  return client;
}

export async function apiRequest<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "REQUEST_FAILED");
  return result as T;
}
