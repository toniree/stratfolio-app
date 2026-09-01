import { requestTimeoutMs, serviceBase, type ServiceId } from '@/api/http/env'
import {
  ApiError,
  isProblemBody,
  problemMessage,
  type ProblemDetailBody,
} from '@/api/http/problem'
import { DECISION_EPISODE_HEADER, IDEMPOTENCY_HEADER } from '@/api/http/idempotency'

export type QueryValue = string | number | boolean | undefined | null

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Record<string, QueryValue>
  body?: unknown
  /** plt-style idempotency: sent as the `Idempotency-Key` **header** (D6). */
  idempotencyKey?: string
  /** plt correlation header; must be a UUID or plt answers 400 before routing. */
  decisionEpisodeId?: string
  signal?: AbortSignal
  timeoutMs?: number
  headers?: Record<string, string>
}

function buildUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const url = `${base}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    // Omitted, not sent as an empty string: plt's bean validation rejects an
    // out-of-range or unparseable param with a 400 rather than ignoring it.
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

async function readProblem(response: Response, url: string): Promise<ApiError> {
  let problem: ProblemDetailBody = {}
  try {
    const text = await response.text()
    if (text) {
      const parsed: unknown = JSON.parse(text)
      if (isProblemBody(parsed)) problem = parsed
      // A non-JSON body (a proxy's HTML 502, say) leaves `problem` empty; the
      // status alone is then the only honest thing we know.
    }
  } catch {
    /* Unparseable error body — the status code is still meaningful. */
  }
  return new ApiError({
    message: problemMessage(problem, `${response.status} ${response.statusText}`.trim()),
    status: response.status,
    problem,
    url,
  })
}

/**
 * The single fetch seam for every live adapter.
 *
 * Deliberately thin: no retries (a blind retry of a POST is exactly how a
 * duplicate order happens), no response caching, no automatic mock fallback.
 * Callers that want a retry must decide whether the operation is the same one
 * — see `idempotency.ts`.
 */
export async function request<T>(
  service: ServiceId,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(serviceBase(service), path, options.query)
  const method = options.method ?? 'GET'

  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey
  if (options.decisionEpisodeId) headers[DECISION_EPISODE_HEADER] = options.decisionEpisodeId

  const timeout = options.timeoutMs ?? requestTimeoutMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  const external = options.signal
  const onExternalAbort = () => controller.abort()
  external?.addEventListener('abort', onExternalAbort)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      // No cookies anywhere: V1 has zero auth (D5) and CORS with credentials
      // is explicitly out of scope (HKP-CORS-1).
      credentials: 'omit',
    })
  } catch (cause) {
    throw new ApiError({
      message: cause instanceof Error ? cause.message : 'Network request failed',
      status: 0,
      url,
      isNetworkError: true,
      cause,
    })
  } finally {
    clearTimeout(timer)
    external?.removeEventListener('abort', onExternalAbort)
  }

  if (!response.ok) throw await readProblem(response, url)

  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

/** A response plus the status code, for the endpoints where 200-vs-201 is the
 *  signal (plt idempotent replay) rather than an implementation detail. */
export interface ResponseWithStatus<T> {
  status: number
  data: T
  headers: Headers
}

export async function requestWithStatus<T>(
  service: ServiceId,
  path: string,
  options: RequestOptions = {},
): Promise<ResponseWithStatus<T>> {
  const url = buildUrl(serviceBase(service), path, options.query)
  const method = options.method ?? 'GET'
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey
  if (options.decisionEpisodeId) headers[DECISION_EPISODE_HEADER] = options.decisionEpisodeId

  const timeout = options.timeoutMs ?? requestTimeoutMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: 'omit',
    })
  } catch (cause) {
    throw new ApiError({
      message: cause instanceof Error ? cause.message : 'Network request failed',
      status: 0,
      url,
      isNetworkError: true,
      cause,
    })
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) throw await readProblem(response, url)
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    data: (text ? JSON.parse(text) : undefined) as T,
  }
}
