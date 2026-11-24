/**
 * Runs the primary AI provider and transparently falls back to a secondary one.
 * The primary provider is used whenever it answers; the fallback only kicks in
 * when the primary fails (quota exhausted, rate limited, server error, ...).
 */
const isTransientError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return /429|500|502|503|504|service unavailable|too many requests|high demand|timeout|fetch failed/i.test(message);
};

export const generateWithModelChain = async <T>(options: {
  models: string[];
  run: (model: string) => Promise<T>;
  label?: string;
}): Promise<T> => {
  const failures: string[] = [];

  for (const model of options.models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await options.run(model);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === 2 || !isTransientError(error)) {
          failures.push(`${model}: ${message.split('\n')[0].slice(0, 300)}`);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }

  throw new Error(`${options.label ?? 'AI models'} all failed:\n${failures.join('\n')}`);
};

export const generateWithFallback = async <T>(options: {
  primary: () => Promise<T>;
  fallback: () => Promise<T>;
  primaryName?: string;
  fallbackName?: string;
}): Promise<T> => {
  const primaryName = options.primaryName ?? 'primary provider';
  const fallbackName = options.fallbackName ?? 'fallback provider';

  try {
    return await options.primary();
  } catch (primaryError) {
    const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
    console.warn(`${primaryName} failed, falling back to ${fallbackName}: ${primaryMessage}`);

    try {
      return await options.fallback();
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`${primaryName} failed: ${primaryMessage} | ${fallbackName} failed: ${fallbackMessage}`);
    }
  }
};
