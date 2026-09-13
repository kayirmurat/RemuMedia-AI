export interface LLMGenerateOptions {
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResult {
  text: string;
  provider: string;
  model: string;
  costUsd: number;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LLMProvider {
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult>;
  // Destekleyen sağlayıcılarda gerçek web araması yaparak yanıt üretir
  // (araştırma adımı için — halüsinasyon riskini azaltır). Opsiyonel:
  // desteklemeyen bir sağlayıcı bunu hiç uygulamayabilir.
  generateWithSearch?(prompt: string, options?: LLMGenerateOptions): Promise<LLMResult>;
}
