export interface ImageGenerateOptions {
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
}

export interface ImageResult {
  filePath: string;
  provider: string;
  model: string;
  costUsd: number;
}

export interface ImageProvider {
  generate(prompt: string, options?: ImageGenerateOptions): Promise<ImageResult>;
}
