import OpenAI from "openai";
import type { LLMGenerateOptions, LLMProvider, LLMResult } from "../../providers/llm.js";

// Yaklaşık fiyatlandırma (gpt-4o-mini, Eylül 2026 itibarıyla) — sadece maliyet TAHMİNİ içindir,
// gerçek faturalandırma OpenAI panelinden takip edilmelidir.
const PRICE_PER_1M_INPUT_USD = 0.15;
const PRICE_PER_1M_OUTPUT_USD = 0.6;

export class OpenAILLMProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<LLMResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
        { role: "user" as const, content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    });

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
}
