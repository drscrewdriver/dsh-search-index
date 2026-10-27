/**
 * Client-side helpers and structural mirrors shared by the search panel and
 * the settings card. Everything talks to the host through the fenced
 * `/switch-search/api` route; no official package is value-imported.
 */

/** Fetch timeout for one host call (long for import: the body can be large). */
const FETCH_TIMEOUT = 10_000

/** POST a JSON body to a fenced switch-search API method (items shape).
 *  `code` 是 0.7.8 起的失败档位（旧宿主无此字段）；客户端优先按它取本地化文案。 */
export function callHost<T>(method: string, body: unknown): Promise<{ ok: boolean; items: T[]; error?: string; code?: string }> {
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
      const record = data as { ok?: boolean; items?: T[]; error?: string; code?: string }
      if (record && record.ok === true && Array.isArray(record.items)) {
        return { ok: true, items: record.items }
      }
      return {
        ok: false,
        items: [],
        error: record?.error ?? '请求失败',
        ...(typeof record?.code === 'string' ? { code: record.code } : {}),
      }
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
  /**
   * 归档标记（R1 合表语义）。旧宿主半缺省该字段时按 undefined 处理——
   * 归档筛选 chip 对 undefined 行按「活跃」对待，与旧数据形状兼容。
   */
  archived?: boolean
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
  /** 失败档位（0.7.8+，0.7.11 加 drs-not-activated）：browser-access-denied / drs-http-unreachable / drs-http-error / drs-not-activated / drs-missing / drs-empty / drs-schema-mismatch。 */
  detail?: string
  /** 当前实际可用通道（0.7.8+）。 */
  mode?: 'http' | 'in-process' | 'none'
  /** DRSC 路由 404：插件未激活，投影库不会自动更新（0.7.11+，旧宿主缺省 false）。 */
  notActivated?: boolean
  /** 配置面选择的通道（0.7.8+）。 */
  transport?: 'auto' | 'http' | 'in-process'
  /** 进程内只读库明细（0.7.8+）。 */
  local?: { schemaVersion?: string; expected?: string; sessions?: number; dir?: string }
  dir?: string
  archives?: string[]
  archivedSessions?: number
  /**
   * Resolution state of the peer plugin that owns archiving. Absent on an
   * older host half — treated as `unknown`, which renders the neutral hint.
   */
  steward?: 'installed' | 'missing' | 'unknown'
  /**
   * 直接删除入口开关（功能①，管家 session-steward.directDelete）：true 时
   * 面板结果行渲染行内删除按钮。旧宿主半无此字段 = undefined = 不渲染。
   */
  directDelete?: boolean
  sync?: HostSyncState
  rebuild?: HostRebuildState
  /** 深度同步（DRS 慢速重建 → 本地索引重建）的可见状态。 */
  deepSync?: { state: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed'; startedAt?: number; finishedAt?: number; error?: string }
  error?: string
}

/**
 * POST to the STEWARD fenced route (`/session-steward/api`) — the batch
 * management console (archive / unarchive / purge) rides the steward subdomain,
 * per the merged package's route contract (session-* methods stay there).
 */
export function callSteward<T>(method: string, body: unknown, timeout = FETCH_TIMEOUT): Promise<Partial<T> & { ok: boolean; error?: string }> {
  const controller = typeof AbortController === 'undefined' ? undefined : new AbortController()
  const timer = typeof setTimeout === 'function'
    ? setTimeout(() => { controller?.abort() }, timeout)
    : undefined
  return fetch(`/manage-session/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
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

/**
 * 深度同步：让 DRS 慢速重扫修好自己的投影库，再把本地索引整理一遍。
 * 后台执行，进度看 index-status 的 deepSync 面。
 */
export async function deepSyncIndex(): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  return await callHostAny<{ started?: boolean }>('index-deep-sync', {}) as { ok: boolean; started?: boolean; error?: string }
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

/**
 * The client sessions service face. Host lines before 0.1.7 exposed session
 * navigation here as `open`; the 0.1.7 contract dropped it ("navigation
 * belongs to view owners") — kept only as the legacy fallback of
 * `openSessionThrough`.
 */
export interface SwitchSessionsService {
  open(id: string): void
}

/**
 * The client ui-workspace face: session navigation has been owned by this
 * service since host 0.1.7 (`openSession`; `SessionTarget = SessionId |
 * SubagentAddress`, so a bare session id is accepted).
 */
export interface SwitchUiWorkspaceService {
  openSession(target: string): void
}

/**
 * Open a session from a search hit through whichever face the running host
 * offers: `uiWorkspace.openSession` first (0.1.7+), the pre-0.1.7
 * `sessions.open` as fallback. Neither present → silent no-op: a host line
 * this package does not target must not crash the panel.
 *
 * The service names are resolved through `get` at call time, not captured at
 * apply time: this plugin applies before the session-controller / ui-workspace
 * client modules in the load order, so an eager lookup captures `undefined`
 * and every result click silently no-ops. Both are root-context singletons,
 * so by the time a user clicks a hit they are always mounted.
 */
export function openSessionThrough(get: (name: string) => unknown, sessionId: string): void {
  const uiWorkspace = get('uiWorkspace') as SwitchUiWorkspaceService | undefined
  if (uiWorkspace !== undefined && typeof uiWorkspace.openSession === 'function') {
    uiWorkspace.openSession(sessionId)
    return
  }
  const sessions = get('sessions') as SwitchSessionsService | undefined
  if (sessions !== undefined && typeof sessions.open === 'function') sessions.open(sessionId)
}
