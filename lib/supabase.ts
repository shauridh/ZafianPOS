import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient() {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: 2 } },
      })
    : null;
  return client;
}

export const outletId =
  process.env.NEXT_PUBLIC_OUTLET_ID ?? "00000000-0000-0000-0000-000000000001";
