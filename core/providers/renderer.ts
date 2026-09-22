export interface RenderScene {
  imagePath: string;
  audioPath: string;
  durationSeconds: number;
  // Verilirse, sahne bu akan video klibiyle (Ken Burns yerine) render edilir —
  // imagePath yine de kapak fotoğrafı gibi görsel-tabanlı ihtiyaçlar için tutulur.
  videoPath?: string;
}

export type AspectRatio = "9:16" | "16:9" | "1:1";

export const ASPECT_RATIO_RESOLUTIONS: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

export interface RenderResult {
  filePath: string;
}

export interface MediaProbe {
  durationSeconds: number;
  width: number;
  height: number;
  hasVideo: boolean;
  hasAudio: boolean;
}

export interface Renderer {
  assemble(params: {
    scenes: RenderScene[];
    subtitlesPath: string;
    outputPath: string;
    aspectRatio: AspectRatio;
    musicPath?: string | null;
  }): Promise<RenderResult>;
  probe(filePath: string): Promise<MediaProbe>;
  // Videonun ilk (hook) sahnesinin görseline çarpıcı bir başlık metni
  // bindirerek platformlarda (YouTube/Instagram) kapak fotoğrafı olarak
  // kullanılabilecek tek karelik bir görsel üretir.
  renderCoverImage(params: {
    imagePath: string;
    hookText: string;
    aspectRatio: AspectRatio;
    outputPath: string;
  }): Promise<void>;
}
