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
