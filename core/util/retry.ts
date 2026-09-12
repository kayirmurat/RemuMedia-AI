export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// OpenAI SDK hataları .status taşır (429, 5xx = geçici); .status yoksa (bağlantı
// koptu, DNS hatası vb.) da geçici sayılır. 4xx (401/400/404 gibi) kalıcı kabul edilir.
export function defaultIsRetryable(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  if (status === undefined) return true;
  return status === 429 || (status >= 500 && status <= 599);
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 1000, isRetryable = defaultIsRetryable, onRetry } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryable(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** attempt;
      onRetry?.(attempt + 1, error, delayMs);
      await sleep(delayMs);
    }
  }
}
