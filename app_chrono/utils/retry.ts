/**
 * Utilitaire de retry pour les appels API
 * Implémente une stratégie de retry avec backoff exponentiel
 */

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

/**
 * Calcule le délai avant le prochain retry avec backoff exponentiel
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>>): number {
  const delay = options.initialDelay * Math.pow(options.backoffFactor, attempt - 1);
  return Math.min(delay, options.maxDelay);
}

/**
 * Détermine si une erreur est retryable
 */
function isRetryableError(error: any, response?: Response, options: RetryOptions = {}): boolean {
  // Erreur réseau (timeout, connexion refusée, etc.)
  if (error instanceof TypeError && error.message.includes('Network request failed')) {
    return true;
  }

  // Erreur de timeout
  if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
    return true;
  }

  // Erreur HTTP avec code retryable
  if (response) {
    const retryableCodes = options.retryableStatusCodes || DEFAULT_OPTIONS.retryableStatusCodes;
    if (retryableCodes.includes(response.status)) {
      return true;
    }

    // Ne pas retry les erreurs 4xx (sauf 408, 429)
    if (response.status >= 400 && response.status < 500 && !retryableCodes.includes(response.status)) {
      return false;
    }
  }

  // Utiliser la fonction personnalisée si fournie
  if (options.shouldRetry) {
    return options.shouldRetry(error, 0);
  }

  return false;
}

/**
 * Attend un délai donné
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exécute une fonction avec retry automatique
 * 
 * @param fn Fonction à exécuter (peut retourner une Promise)
 * @param options Options de retry
 * @returns Résultat de la fonction
 * @throws La dernière erreur si toutes les tentatives échouent
 * 
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetch('/api/data'),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
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
      
      // Si c'est une Response fetch, vérifier le statut
      if (result instanceof Response) {
        lastResponse = result;
        
        // Si le statut est retryable, lancer une erreur pour déclencher le retry
        if (isRetryableError(null, result, opts)) {
          throw new Error(`HTTP ${result.status}: ${result.statusText}`);
        }
        
        // Si c'est un succès, retourner la réponse
        if (result.ok) {
          return result as T;
        }
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      // Si c'est la dernière tentative, lancer l'erreur
      if (attempt === opts.maxAttempts) {
        break;
      }
      
      // Vérifier si l'erreur est retryable
      if (!isRetryableError(error, lastResponse, opts)) {
        throw error;
      }
      
      // Calculer le délai avant le prochain retry
      const delay = calculateDelay(attempt, opts);
      
      // Appeler le callback onRetry si fourni
      if (options.onRetry) {
        options.onRetry(attempt, error);
      }
      
      // Logger le retry en développement
      if (__DEV__) {
        console.warn(`⚠️ Tentative ${attempt}/${opts.maxAttempts} échouée, retry dans ${delay}ms...`, error.message);
      }
      
      // Attendre avant le prochain retry
      await sleep(delay);
    }
  }
  
  // Toutes les tentatives ont échoué
  if (__DEV__) {
    console.error(`❌ Toutes les tentatives (${opts.maxAttempts}) ont échoué`);
  }
  
  throw lastError;
}

/**
 * Wrapper pour fetch avec retry automatique
 * 
 * @param url URL à appeler
 * @param init Options fetch
 * @param retryOptions Options de retry
 * @returns Response fetch
 * 
 * @example
 * ```typescript
 * const response = await fetchWithRetry(
 *   '/api/data',
 *   { method: 'GET' },
 *   { maxAttempts: 3 }
 * );
 * ```
 */
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
        // Ne pas retry les erreurs 4xx (sauf 408, 429)
        if (error instanceof Response) {
          const status = error.status;
          if (status >= 400 && status < 500 && ![408, 429].includes(status)) {
            return false;
          }
        }
        
        // Utiliser la fonction personnalisée si fournie
        if (retryOptions?.shouldRetry) {
          return retryOptions.shouldRetry(error, attempt);
        }
        
        return true;
      },
    }
  );
}

/**
 * Retry avec backoff exponentiel pour les appels API spécifiques
 * Utile pour les appels qui nécessitent une gestion d'erreur spécifique
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<{ success: boolean; data?: T; message?: string }>,
  options: RetryOptions = {}
): Promise<{ success: boolean; data?: T; message?: string }> {
  return retry(
    async () => {
      const result = await apiCall();
      
      // Si l'API retourne success: false, considérer comme une erreur retryable
      // sauf si c'est une erreur client (4xx)
      if (!result.success) {
        // Ne pas retry les erreurs de validation ou d'authentification
        if (result.message?.includes('validation') || 
            result.message?.includes('authentification') ||
            result.message?.includes('Session expirée')) {
          throw new Error(result.message || 'Erreur API');
        }
        
        // Retry les autres erreurs
        throw new Error(result.message || 'Erreur API');
      }
      
      return result;
    },
    {
      ...options,
      shouldRetry: (error, attempt) => {
        // Ne pas retry les erreurs d'authentification
        if (error.message?.includes('Session expirée') || 
            error.message?.includes('authentification')) {
          return false;
        }
        
        // Utiliser la fonction personnalisée si fournie
        if (options.shouldRetry) {
          return options.shouldRetry(error, attempt);
        }
        
        return true;
      },
    }
  );
}

