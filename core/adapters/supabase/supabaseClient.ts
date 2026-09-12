import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
