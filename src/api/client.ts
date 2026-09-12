/**
 * The house key and base URL come from .env via Expo's EXPO_PUBLIC_ convention.
 * They must be read as static `process.env.X` properties — the Expo CLI inlines
 * those at build time, and computed lookups like process.env[name] are not replaced.
 */
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

/** A slow LAN shouldn't leave a button spinning forever. */
const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = 'error',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isConfigured(): boolean {
  return BASE_URL.length > 0 && API_KEY.length > 0;
}

/** Shown in the error banner so a misconfigured phone says why, not just "failed". */
export function describeTarget(): string {
  return BASE_URL || 'no EXPO_PUBLIC_API_URL set';
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
};

export async function request<T>(path: string, options: Options = {}): Promise<T> {
  if (!isConfigured()) {
    throw new ApiError(0, 'API URL or key missing — check .env and restart Metro.', 'unconfigured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        // The backend accepts this or an Authorization: Bearer header.
        'x-api-key': API_KEY,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    throw new ApiError(
      0,
      aborted
        ? `The server at ${describeTarget()} didn't answer in time.`
        : `Can't reach the server at ${describeTarget()}. Same Wi-Fi, and is it running?`,
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // The backend answers { error, message, details } on every failure.
    const body = payload as { message?: string; error?: string; detail?: string } | null;
    const code = body?.error ?? 'error';
    throw new ApiError(response.status, messageFor(response.status, body), code);
  }

  return payload as T;
}

/**
 * The backend's own text where it's useful, and something more locating where it
 * isn't: a 500 answers "Something went wrong", which reads like an app bug when
 * the fault is on the server. `detail` is only present outside production.
 */
function messageFor(
  status: number,
  body: { message?: string; error?: string; detail?: string } | null,
): string {
  if (status === 401) return 'Wrong house key — check EXPO_PUBLIC_API_KEY in .env.';
  if (status >= 500) {
    return `The server failed (${status}). ${body?.detail ?? 'Check the backend logs.'}`.slice(
      0,
      300,
    );
  }
  return body?.message ?? `Request failed with ${status}.`;
}

/** Anything thrown by a screen's data call, turned into one line for the banner. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return (error as Error)?.message ?? 'Something went wrong.';
}
