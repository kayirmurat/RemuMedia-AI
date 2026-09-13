export interface StorageProvider {
  saveFile(localPath: string, key: string): Promise<string>;
  writeText(key: string, content: string): Promise<string>;
  readText(key: string): Promise<string>;
  resolvePath(key: string): string;
  // storage.saveFile/writeText'in döndürdüğü yol her zaman yerel bir dosya
  // sistemi yolu OLMAYABİLİR (ör. Supabase modunda "supabase://..." URI'si) —
  // ffmpeg gibi yerel dosya bekleyen araçlar için bu yolu gerçek bir yerel
  // dosyaya indirir/kopyalar. Workflow farklı bir makinede (ör. yeni bir
  // GitHub Actions runner'ında) devam ederse orijinal yerel geçici dosya
  // artık mevcut olmayabilir; bu yüzden context'te ham yerel yol değil,
  // storedPath saklanmalı ve ihtiyaç anında bununla materialize edilmelidir.
  ensureLocalFile(storedPath: string, destPath: string): Promise<string>;
}
