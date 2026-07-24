import { logger } from './logger';

export interface RetryOptions {
  /** Nombre maximum de tentatives (défaut: 3) */
  maxAttempts?: number;
  /** Délai initial en ms (défaut: 1000) */
  initialDelay?: number;
  /** Facteur de backoff exponentiel (défaut: 2) */
  backoffFactor?: number;
  /** Délai maximum entre les tentatives en ms (défaut: 10000) */
  maxDelay?: number;
  /** Codes HTTP à retry (défaut: [408, 429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
  /** Fonction pour déterminer si une erreur est retryable */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Callback appelé avant chaque retry */
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffFactor: 2,
  maxDelay: 10000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>): number {
  const delay = options.initialDelay * Math.pow(options.backoffFactor, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

function isRetryableError(error: any, response: Response | undefined, options: RetryOptions): boolean {
  if (error instanceof TypeError && error.message.includes('Network request failed')) {
    return true;
  }

  if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
    return true;
  }

  if (response) {
    const retryableCodes = options.retryableStatusCodes || DEFAULT_OPTIONS.retryableStatusCodes;
    if (retryableCodes.includes(response.status)) {
      return true;
    }

    if (response.status >= 400 && response.status < 500 && !retryableCodes.includes(response.status)) {
      return false;
    }
  }

  if (options.shouldRetry) {
    return options.shouldRetry(error, 0);
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();

      if (result instanceof Response) {
        lastResponse = result;

        if (isRetryableError(null, result, opts)) {
          throw new Error(`HTTP ${result.status}: ${result.statusText}`);
        }

        if (result.ok) {
          return result as T;
        }
      }

      return result;
    } catch (error: any) {
      lastError = error;

      if (attempt === opts.maxAttempts) {
        break;
      }

      if (!isRetryableError(error, lastResponse, opts)) {
        throw error;
      }

      const delay = calculateDelay(attempt, opts);

      if (options.onRetry) {
        options.onRetry(attempt, error);
      }

      if (__DEV__) {
        logger.warn(`Tentative ${attempt}/${opts.maxAttempts} échouée, retry dans ${delay}ms...`, undefined, { error: error.message, attempt, maxAttempts: opts.maxAttempts, delay });
      }

      await sleep(delay);
    }
  }

  if (__DEV__) {
    logger.error(`Toutes les tentatives (${opts.maxAttempts}) ont échoué`);
  }

  throw lastError;
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retry(
    () => fetch(url, init),
    {
      ...retryOptions,
      shouldRetry: (error, attempt) => {
        if (error instanceof Response) {
          const status = error.status;
          if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
            return false;
          }
        }

        if (retryOptions?.shouldRetry) {
          return retryOptions.shouldRetry(error, attempt);
        }

        return true;
      },
    }
  );
}

export async function retryApiCall<T>(
  apiCall: () => Promise<{ success: boolean; data?: T; message?: string }>,
  options: RetryOptions = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  return retry(
    async () => {
      const result = await apiCall();

      if (!result.success) {
        throw new Error(result.message || 'Erreur API');
      }

      return result;
    },
    {
      ...options,
      shouldRetry: (error, attempt) => {
        if (error.message?.includes('Session expirée') ||
            error.message?.includes('authentification')) {
          return false;
        }

        if (options.shouldRetry) {
          return options.shouldRetry(error, attempt);
        }

        return true;
      },
    }
  );
}
