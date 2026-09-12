import { createClient } from "@supabase/supabase-js";

// Env değişkenleri eksikse sayfaların çökmek yerine anlaşılır bir mesaj
// gösterebilmesi için: önce bunu kontrol et, null dönerse supabaseServer()
// güvenle çağrılabilir.
export function getSupabaseConfigError(): string | null {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return "Supabase yapılandırılmamış: SUPABASE_URL ve SUPABASE_SECRET_KEY env değişkenlerini ekle.";
  }
  return null;
}

// Sadece sunucu tarafında kullanılır (server component / route handler).
// SUPABASE_SECRET_KEY hiçbir zaman tarayıcıya gönderilmez.
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY tanımlı değil.");
  }
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function supabaseBucket(): string {
  return process.env.SUPABASE_BUCKET || "remumedia";
}
