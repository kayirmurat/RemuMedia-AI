import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureBucket(client: SupabaseClient, bucket: string): Promise<void> {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`Supabase bucket listelenemedi: ${listError.message}`);
  if (buckets?.some((b) => b.name === bucket)) return;

  const { error: createError } = await client.storage.createBucket(bucket, { public: false });
  if (createError) throw new Error(`Supabase bucket oluşturulamadı: ${createError.message}`);
}
