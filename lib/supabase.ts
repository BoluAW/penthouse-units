import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set both as " +
        "server-only environment variables — no NEXT_PUBLIC_ prefix."
    );
  }

  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  return client;
}

/**
 * Built on first use rather than at import.
 *
 * Next evaluates route modules while collecting page data during the build,
 * so validating the keys at module scope makes every build depend on runtime
 * secrets — which fails a deploy before the environment is even configured.
 * A missing key now surfaces on the first query instead, where it belongs.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
