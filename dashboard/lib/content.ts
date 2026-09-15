import { supabaseServer, supabaseBucket } from "./supabase";
import { storageKeyFromPath } from "./types";

export async function readArtifactText(path: string): Promise<string> {
  const key = storageKeyFromPath(path);
  if (!key) return "";
  const client = supabaseServer();
  const { data, error } = await client.storage.from(supabaseBucket()).download(key);
  if (error) return `(okunamadı: ${error.message})`;
  return data.text();
}

// Yayınlama API'lerinin (YouTube/Instagram/TikTok) videoyu indirebilmesi
// için geçici, imzalı bir URL üretir. 2 saat yeterli — büyük bir video
// yükleme/işleme akışının tamamı bu süre içinde biter.
export async function getArtifactSignedUrl(path: string, expirySeconds = 7200): Promise<string> {
  const key = storageKeyFromPath(path);
  if (!key) throw new Error("Bu artifact Supabase Storage'da değil (yerel mod yayınlama desteklemiyor).");
  const client = supabaseServer();
  const { data, error } = await client.storage.from(supabaseBucket()).createSignedUrl(key, expirySeconds);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
