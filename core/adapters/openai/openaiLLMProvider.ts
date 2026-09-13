import OpenAI from "openai";
import type { LLMGenerateOptions, LLMProvider, LLMResult } from "../../providers/llm.js";
import { withRetry } from "../../util/retry.js";
import { createLogger, type Logger } from "../../logger/logger.js";

// Yaklaşık fiyatlandırma (gpt-4o-mini, Eylül 2026 itibarıyla) — sadece maliyet TAHMİNİ içindir,
// gerçek faturalandırma OpenAI panelinden takip edilmelidir.
const PRICE_PER_1M_INPUT_USD = 0.15;
const PRICE_PER_1M_OUTPUT_USD = 0.6;
// web_search_preview aracının kendi sabit kullanım ücreti (token maliyetine ek) — TAHMİN.
const WEB_SEARCH_CALL_COST_USD = 0.025;

export class OpenAILLMProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;
  private logger: Logger;

  constructor(apiKey: string, model = "gpt-4o-mini", logger: Logger = createLogger()) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.logger = logger;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const response = await withRetry(
      () =>
        this.client.chat.completions.create({
          model: this.model,
          messages: [
            ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
            { role: "user" as const, content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens,
        }),
      {
        onRetry: (attempt, error, delayMs) =>
          this.logger.warn("OpenAI LLM isteği geçici olarak başarısız oldu, tekrar deneniyor", {
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          }),
      },
    );

    const text = response.choices[0]?.message?.content ?? "";
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * PRICE_PER_1M_INPUT_USD +
      (outputTokens / 1_000_000) * PRICE_PER_1M_OUTPUT_USD;

    return {
      text,
      provider: "openai",
      model: this.model,
      costUsd,
      usage: { inputTokens, outputTokens },
    };
  }

  // Responses API + built-in web_search_preview aracı: model gerçekten web'de
  // arama yapıp bulduğu kaynaklara dayanarak yanıt üretir. Araştırma adımı
  // için kullanılır — sadece ezber bilgiye (halüsinasyon riski) güvenmemek için.
  async generateWithSearch(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const response = await withRetry(
      () =>
        this.client.responses.create({
          model: this.model,
          instructions: options.system,
          input: prompt,
          tools: [{ type: "web_search_preview" }],
        }),
      {
        onRetry: (attempt, error, delayMs) =>
          this.logger.warn("OpenAI web araması geçici olarak başarısız oldu, tekrar deneniyor", {
            attempt,
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          }),
      },
    );

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * PRICE_PER_1M_INPUT_USD +
      (outputTokens / 1_000_000) * PRICE_PER_1M_OUTPUT_USD +
      WEB_SEARCH_CALL_COST_USD;

    return {
      text: response.output_text,
      provider: "openai",
      model: this.model,
      costUsd,
      usage: { inputTokens, outputTokens },
    };
  }
}
