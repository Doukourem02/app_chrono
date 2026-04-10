import { logger } from "./logger";

export const API_DEFAULT_TIMEOUT_MS = 28_000;
/** Nombre de tentatives supplémentaires après le premier essai (2 = 3 essais au total). */
export const API_DEFAULT_MAX_RETRIES = 2;

const RETRYABLE_HTTP = new Set([408, 429, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Permet de corréler les logs backend (Better Stack) avec une requête API. */
function mergeRequestIdHeader(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  if (!headers.has("X-Request-Id")) {
    const id =
      typeof globalThis.crypto !== "undefined" &&
      typeof globalThis.crypto.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    headers.set("X-Request-Id", id);
  }
  return { ...init, headers };
}

function linkAbort(parent: AbortSignal | null | undefined, child: AbortController) {
  if (!parent) return;
  if (parent.aborted) {
    child.abort();
    return;
  }
  parent.addEventListener("abort", () => child.abort(), { once: true });
}

export class ApiTimeoutError extends Error {
  override name = "ApiTimeoutError";
  constructor() {
    super("API_REQUEST_TIMEOUT");
  }
}

export function isApiTimeoutError(e: unknown): boolean {
  return e instanceof ApiTimeoutError;
}

/** Message utilisateur pour échec transport (hors message métier JSON). */
export function getApiFetchUserMessage(e: unknown): string {
  if (isApiTimeoutError(e)) {
    return "Le serveur met trop longtemps à répondre. Réessayez dans un instant.";
  }
  if (
    e instanceof TypeError &&
    typeof e.message === "string" &&
    e.message.includes("Network request failed")
  ) {
    return "Impossible de joindre le serveur. Vérifiez votre connexion Internet.";
  }
  if (e instanceof Error && e.name === "AbortError") {
    return "La requête a été interrompue.";
  }
  if (
    e instanceof Error &&
    typeof e.message === "string" &&
    isSystemNetworkErrorMessage(e.message)
  ) {
    return "Impossible de joindre le serveur (réseau injoignable). Essayez le Wi‑Fi ou réessayez plus tard.";
  }
  return "Impossible de joindre le serveur. Vérifiez votre connexion.";
}

/** Erreurs bas niveau (Node / iOS) : pas un message métier API. */
function isSystemNetworkErrorMessage(msg: string): boolean {
  const m = msg.toUpperCase();
  return (
    m.includes("ENETUNREACH") ||
    m.includes("EHOSTUNREACH") ||
    m.includes("ECONNREFUSED") ||
    m.includes("ECONNRESET") ||
    m.includes("ETIMEDOUT") ||
    m.includes("ENOTFOUND") ||
    m.includes("NETWORK IS UNREACHABLE")
  );
}

/** Message à afficher : transport (timeout / réseau) ou message métier `Error`. */
export function transportOrErrorMessage(error: unknown, fallback: string): string {
  if (isApiTimeoutError(error)) return getApiFetchUserMessage(error);
  if (
    error instanceof TypeError &&
    typeof error.message === "string" &&
    error.message.includes("Network request failed")
  ) {
    return getApiFetchUserMessage(error);
  }
  if (error instanceof Error && typeof error.message === "string") {
    if (isSystemNetworkErrorMessage(error.message)) {
      return "Impossible de joindre le serveur (réseau injoignable). Essayez le Wi‑Fi ou réessayez plus tard.";
    }
    return error.message;
  }
  return fallback;
}

/** Réponses API où `message` est un enveloppe générique et le détail utile est dans `error`. */
const GENERIC_API_MESSAGE_SNIPPETS = [
  "erreur lors de la mise à jour du profil",
  "erreur lors de la récupération du profil",
];

function isGenericApiMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return GENERIC_API_MESSAGE_SNIPPETS.some((s) => lower.includes(s));
}

/** Message métier depuis le corps JSON d’une erreur HTTP (`message` et/ou `error`). */
export function parseApiErrorBody(
  body: unknown,
  httpStatus: number,
  fallback: string
): string {
  if (body && typeof body === "object") {
    const r = body as Record<string, unknown>;
    const m = typeof r.message === "string" ? r.message.trim() : "";
    const e = typeof r.error === "string" ? r.error.trim() : "";
    if (e && (!m || isGenericApiMessage(m))) return e;
    if (m) return m;
    if (e) return e;
  }
  return fallback || `Erreur serveur (${httpStatus})`;
}

/**
 * fetch avec timeout et retries sur erreurs réseau / timeout / HTTP transitoires.
 * Ne pas utiliser avec un body non rejouable (ex. POST idempotent seulement avec prudence).
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { timeoutMs?: number; maxRetries?: number }
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? API_DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? API_DEFAULT_MAX_RETRIES;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ctrl = new AbortController();
    let timedOut = false;
    const tid = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, timeoutMs);

    try {
      linkAbort(init?.signal, ctrl);
      const response = await fetch(input, {
        ...mergeRequestIdHeader(init),
        signal: ctrl.signal,
      });
      clearTimeout(tid);

      if (RETRYABLE_HTTP.has(response.status) && attempt < maxRetries) {
        logger.debug(
          `apiFetch: HTTP ${response.status}, nouvel essai ${attempt + 2}/${maxRetries + 1}`,
          "apiFetch"
        );
        await sleep(Math.min(8000, 1000 * 2 ** attempt));
        continue;
      }
      return response;
    } catch (err: unknown) {
      clearTimeout(tid);
      const isAbort = err instanceof Error && err.name === "AbortError";
      const isNet =
        err instanceof TypeError &&
        typeof err.message === "string" &&
        err.message.includes("Network request failed");

      if (isAbort && !timedOut) {
        throw err;
      }

      if ((isAbort && timedOut) || isNet) {
        lastErr = isAbort && timedOut ? new ApiTimeoutError() : err;
        if (attempt < maxRetries) {
          logger.debug(
            `apiFetch: retry après ${isNet ? "réseau" : "timeout"} (${attempt + 2}/${maxRetries + 1})`,
            "apiFetch"
          );
          await sleep(Math.min(8000, 1000 * 2 ** attempt));
          continue;
        }
        throw lastErr;
      }

      throw err;
    }
  }

  throw lastErr ?? new Error("apiFetch: épuisé");
}
