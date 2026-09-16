/**
 * Client-side helpers and structural mirrors shared by the search panel and
 * the settings card. Everything talks to the host through the fenced
 * `/switch-search/api` route; no official package is value-imported.
 */

/** Fetch timeout for one host call (long for import: the body can be large). */
const FETCH_TIMEOUT = 10_000

/** POST a JSON body to a fenced switch-search API method (items shape). */
export function callHost<T>(method: string, body: unknown): Promise<{ ok: boolean; items: T[]; error?: string }> {
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
  const timer = controller !== undefined && typeof setTimeout === 'function'
    ? setTimeout(() => { controller.abort() }, FETCH_TIMEOUT)
    : undefined
  return fetch(`/switch-search/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller?.signal,
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data: unknown) => {
      const record = data as { ok?: boolean; items?: T[]; error?: string }
      if (record && record.ok === true && Array.isArray(record.items)) {
        return { ok: true, items: record.items }
      }
      return { ok: false, items: [], error: record?.error ?? '请求失败' }
    })
    .catch((err: unknown) => ({
      ok: false,
      items: [],
      error: err instanceof DOMException && err.name === 'AbortError' ? '请求超时' : String(err instanceof Error ? err.message : err),
    }))
    .finally(() => {
      if (timer !== undefined) clearTimeout(timer)
    })
}

/** POST a body to a fenced switch-search API method, returning the whole record. */
export function callHostAny<T>(method: string, body: unknown, timeout = FETCH_TIMEOUT): Promise<Partial<T> & { ok: boolean; error?: string }> {
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
  const timer = typeof setTimeout === 'function'
    ? setTimeout(() => { controller?.abort() }, timeout)
    : undefined
  return fetch(`/switch-search/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: controller?.signal,
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .catch((err: unknown) => ({
      ok: false,
      error: err instanceof DOMException && err.name === 'AbortError' ? '请求超时' : String(err instanceof Error ? err.message : err),
    }))
    .finally(() => {
      if (timer !== undefined) clearTimeout(timer)
    })
}

/** One session listed for the title-search corpus. */
export interface HostSessionItem {
  sessionId: string
  title: string
  cwd: string
  updatedAt: number
}

/**
 * One content-search hit (session-level: title + strongest snippet).
 * `time` belongs to the strongest matching document; `updatedAt` is the
 * session-level clock and is what recency ordering keys on. Both ship so the
 * panel can re-sort locally without another round-trip.
 */
export interface HostContentHit {
  sessionId: string
  title: string
  snippet: string
  seq: number
  type: string
  time: number
  updatedAt: number
}

/** Result ordering accepted by the host `content-search` method. */
export type HostSortMode = 'relevance' | 'time'

/** Host watermark-sync state (subset used here). */
export interface HostSyncState {
  state: string
  indexed: number
  total: number
  updated: number
  lastSyncAt: number
  failures: { sessionId: string; error: string }[]
}

/** Host rebuild ("整理") state (subset used here). */
export interface HostRebuildState {
  state: string
  done: number
  total: number
  error?: string
}

/** Host independent-index status (subset used here). */
export interface HostIndexStatus {
  ok: boolean
  available: boolean
  reason?: string
  dir?: string
  archives?: string[]
  archivedSessions?: number
  sync?: HostSyncState
  rebuild?: HostRebuildState
  error?: string
}

/** Trigger a browser download of the index snapshot from the host route. */
export async function downloadSnapshot(): Promise<void> {
  const res = await fetch('/switch-search/api/index-export', { method: 'POST' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `switch-search-snapshot-${new Date().toISOString().slice(0, 10)}.jsonl`
  anchor.click()
  URL.revokeObjectURL(url)
}
