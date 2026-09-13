import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorageProvider } from "../../providers/storage.js";
import { withRetry } from "../../util/retry.js";

function guessContentType(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".mp3")) return "audio/mpeg";
  if (key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".srt")) return "application/x-subrip";
  if (key.endsWith(".json")) return "application/json";
  return "text/plain; charset=utf-8";
}

export class SupabaseStorageProvider implements StorageProvider {
  constructor(
    private client: SupabaseClient,
    private bucket: string,
  ) {}

  resolvePath(key: string): string {
    return `supabase://${this.bucket}/${key}`;
  }

  async saveFile(localPath: string, key: string): Promise<string> {
    const buffer = await fs.readFile(localPath);
    await withRetry(async () => {
      const { error } = await this.client.storage
        .from(this.bucket)
        .upload(key, buffer, { upsert: true, contentType: guessContentType(key) });
      if (error) throw new Error(`Supabase storage yükleme hatası (${key}): ${error.message}`);
    });
    return this.resolvePath(key);
  }

  async writeText(key: string, content: string): Promise<string> {
    await withRetry(async () => {
      const { error } = await this.client.storage
        .from(this.bucket)
        .upload(key, Buffer.from(content, "utf-8"), { upsert: true, contentType: guessContentType(key) });
      if (error) throw new Error(`Supabase storage yazma hatası (${key}): ${error.message}`);
    });
    return this.resolvePath(key);
  }

  async readText(key: string): Promise<string> {
    return withRetry(async () => {
      const { data, error } = await this.client.storage.from(this.bucket).download(key);
      if (error) throw new Error(`Supabase storage okuma hatası (${key}): ${error.message}`);
      return data.text();
    });
  }

  async ensureLocalFile(storedPath: string, destPath: string): Promise<string> {
    const match = storedPath.match(/^supabase:\/\/[^/]+\/(.+)$/);
    if (!match) return storedPath;
    const key = match[1]!;
    return withRetry(async () => {
      const { data, error } = await this.client.storage.from(this.bucket).download(key);
      if (error) throw new Error(`Supabase storage indirme hatası (${key}): ${error.message}`);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, Buffer.from(await data.arrayBuffer()));
      return destPath;
    });
  }
}
