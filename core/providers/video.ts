export interface VideoGenerateOptions {
  durationSeconds?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  // Klibin bittiği kareyi bir sonraki sahnenin başlangıç karesiyle
  // hizalamak için opsiyonel — şu an kullanılmıyor ama sağlayıcı destekliyor.
  lastFrameImagePath?: string;
}

export interface VideoResult {
  filePath: string;
  provider: string;
  model: string;
  costUsd: number;
  durationSeconds: number;
}

// Sabit bir başlangıç karesini (ör. karakter bindirilmiş sahne görseli) kısa,
// akan bir video klibe dönüştüren "image-to-video" sağlayıcı arayüzü.
export interface VideoProvider {
  generateFromImage(imagePath: string, prompt: string, options?: VideoGenerateOptions): Promise<VideoResult>;
}
