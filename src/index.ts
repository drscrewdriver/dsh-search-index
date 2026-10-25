/**
 * dsh-search-index host half: one fenced HTTP route `/switch-search/api`
 * backed by the plugin's OWN full-text index (node:sqlite FTS5, a file this
 * plugin owns — never the official session-query index, which may be absent
 * entirely under its default `openAt: never`).
 *
 * - `list-sessions` — the title-search corpus: every session id + folded
 *   title (+ cwd/updatedAt), read live through `sessionQuery`, falling back to
 *   the independent index when the live service is unavailable.
 * - `content-search` — session-grouped message-content search over the
 *   independent index (docs mirrored from `sessionQuery.readSession` with the
 *   official extraction semantics).
 * - `index-status` / `index-rebuild` / `index-export` / `index-import` —
 *   the index lifecycle surface: watermark sync progress, the non-destructive
 *   整理 (rebuild into a shadow file + atomic swap + bounded archives), and
 *   the JSON Lines snapshot migration seam.
 *
 * The route is browser-trust fenced exactly like dsh-history's `/history/api`.
 */
import type { Context } from 'cordis'
import z from '@deepseek-ai/schemastery'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SwitchIndexEngine, resolveTypes, type SwitchIndexContentType, type SwitchSearchSort } from './host/index/engine.ts'
import { SwitchWatermarkSync, type SwitchSyncState } from './host/index/sync.ts'
import { createArchiveSource, type SwitchArchiveDiagnostics } from './host/index/archive-source.ts'
import { detectSteward } from './host/index/peers.ts'
// The archive-set WRITER (prune) moved to dsh-session-steward: this package
// reads the official archive set to exclude archived sessions from the index,
// and no longer edits it. Single writer, one owner.
export { createArchiveSource, type SwitchArchiveDiagnostics } from './host/index/archive-source.ts'
import {
  DEFAULT_INDEX_LAYOUT,
  importIntoIndex,
  listArchives,
  recoverIndex,
  rebuildIndex,
  resolveIndexDir,
  type SwitchIndexLayout,
  type SwitchRebuildState,
} from './host/index/rebuild.ts'
import { exportSnapshot, parseSnapshot } from './host/index/snapshot.ts'
import { extractTitleFromEvents } from './host/index/extract.ts'
import { DrsCorpusSource, resolveDrsBaseUrl } from './host/index/drs-source.ts'
import {
  bridgeOverlay,
  installLegacySettingsBridge,
  settingsDescribe,
  settingsMutate,
  type BridgeState,
} from './host/settings-bridge.ts'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SwitchRawEvent } from './host/index/extract.ts'
import {
  DEFAULT_CONFIG,
  type SwitchSearchConfig,
} from './config.ts'

export { DEFAULT_CONFIG, SWITCH_SEARCH_SETTINGS_NAMESPACE } from './config.ts'
export type { SwitchSearchConfig } from './config.ts'
export { SwitchIndexEngine } from './host/index/engine.ts'
export { SwitchWatermarkSync } from './host/index/sync.ts'
export { rebuildIndex, importIntoIndex, recoverIndex, DEFAULT_INDEX_LAYOUT } from './host/index/rebuild.ts'
export { exportSnapshot, parseSnapshot } from './host/index/snapshot.ts'

/** The webServer service face this plugin uses (structural mirror). */
interface SwitchWebServer {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** The web runtime service face: bind-derived trusted authorities.
 *  0.2.1-a.2 起宿主把服务 `webRuntime` 更名为 `webStartup`；两代宿主通吃，
 *  读取面走双名回退链（见 apply 内 trustedRuntime）。 */
interface SwitchWebRuntime {
  trustedHosts: readonly string[]
}

/** One session header shape the query service returns (structural subset). */
interface SwitchSessionHeader {
  id: string
  version: number
  createdAt: number
  cwd?: string
  parentSession?: string
  seedLength?: number
  delegationDepth?: number
  agentPreset?: string
}

/** One logical-session record (structural subset). */
interface SwitchSessionRecord {
  header: SwitchSessionHeader
  live: boolean
  persisted: boolean
}

/** One title observation result (structural subset). */
interface SwitchTitleObservationResult {
  status: 'fulfilled' | 'rejected'
  value?: { session: SwitchSessionHeader; title?: { title: string } }
  reason?: unknown
}

/** One strongest matching event hit (structural subset). */
interface SwitchEventHit {
  sessionId: string
  seq: number
  type: string
  time: number
  surface: string
  snippet: string
}

/** One grouped cross-session search hit (structural subset). */
interface SwitchSearchHit {
  header: SwitchSessionHeader
  live: boolean
  persisted: boolean
  bestMatch: SwitchEventHit
}

/** One content-search page (structural subset). */
interface SwitchSearchPage {
  items: readonly SwitchSearchHit[]
  nextCursor?: string
}

/** The session-query service face: corpus reads, title folding, FTS5 search. */
interface SwitchSessionQuery {
  listSessions(signal?: AbortSignal): Promise<readonly SwitchSessionRecord[]>
  readSession?(sessionId: string): Promise<{
    session: SwitchSessionHeader
    events: readonly SwitchRawEvent[]
  }>
  readTitleSnapshots(
    sessionIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly SwitchTitleObservationResult[]>
  searchSessions(
    request: { query: string; eventFilters?: readonly unknown[]; limit?: number },
    exec?: { signal?: AbortSignal },
  ): Promise<SwitchSearchPage>
}

/**
 * The workspace registry face this plugin reads (structural mirror): the
 * official archive set. Read lazily — the registry may mount after plugins.
 */
interface SwitchWorkspaceRegistry {
  readonly archivedSessionIds: readonly string[]
}

declare module 'cordis' {
  interface Context {
    webServer: SwitchWebServer
    /** 0.2.1-a.2+ 主名（本插件 inject 的服务）。 */
    webStartup: SwitchWebRuntime
    /** 旧代宿主（≤0.2.0）遗留名，仅作双名回退链的兜底。 */
    webRuntime?: SwitchWebRuntime
    sessionQuery?: SwitchSessionQuery
    workspaceRegistry?: SwitchWorkspaceRegistry
  }
}

/** Stable plugin name for the cordis row. */
export const name = 'dsh-search-index'

/** Services required before mounting: the web server routes and the trust list.
 *  0.2.1-a.2 起 webRuntime 更名 webStartup；注入主名 webStartup，读取面走双名回退链。 */
export const inject = ['webServer', 'webStartup']

/** Composition-entry schema: what a dsh profile may configure at assembly time.
 *  0.1.7：volatile 字段即设置表单；`indexDir` 是部署路径，不走页面。 */
export const Config = z.object({
  enabled: z.boolean().default(true).volatile(),
  defaultMode: z.union(['title', 'content']).default('title').volatile(),
  autoSync: z.boolean().default(true).volatile(),
  syncIntervalMs: z.number().default(30_000).volatile(),
  archiveKeep: z.number().default(2).volatile(),
  indexDir: z.string().default(''),
  corpusSource: z.union(['native', 'drs']).default('drs').volatile(),
  drsBaseUrl: z.string().default('').volatile(),
})

/** Live reference the 0.1.7 loader hands `apply` for `.volatile()` config fields. */
interface VolatileRef<T> {
  get(): T
}

/** Resolve one possibly-volatile field: a live ref on 0.1.7+, a plain value otherwise. */
function readVolatileValue<T>(value: T | VolatileRef<T> | undefined): T | undefined {
  if (value !== null && typeof value === 'object' && typeof (value as VolatileRef<T>).get === 'function') {
    return (value as VolatileRef<T>).get()
  }
  return value as T | undefined
}

/** Body size bound of one JSON request (defense against unbounded reads). */
const MAX_BODY_BYTES = 16 << 20

/** Default maximum sessions returned by one content search. */
const DEFAULT_LIMIT = 20

/** Environment override for the independent index directory. */
const INDEX_DIR_ENV = 'DSH_SWITCH_SEARCH_DIR'

/**
 * The log-only event a rename (or an automatic title) lands as. It is appended
 * to the session log, so it also bumps the session watermark — which is why the
 * poll would already catch it, one interval later.
 */
const TITLE_EVENT_TYPE = 'session/title'

/** Rename bursts coalesce into one title fold (an auto-title pass fires several). */
const TITLE_FLUSH_MS = 250

/** Normalize a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/** Whether a normalized URL hostname names the local loopback authority. */
function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/** Whether the request Host matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    const canonical = entryUrl.port === '' ? entryUrl.hostname : entryUrl.host
    return canonical === hostUrl.host
  })
}

/**
 * Browser-trust fence, behaviorally identical to the /api gateway's fence:
 * loopback Host header or a configured trusted authority; cross-site browser
 * markers refuse. DNS-rebinding / cross-site defense, not authentication.
 */
function isTrustedApiRequest(req: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = req.headers.host
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  const fetchSite = req.headers['sec-fetch-site']
  if (typeof fetchSite === 'string' && fetchSite === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** Read the raw request body (bounded; malformed handled by callers). */
async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Read and parse the JSON request body (bounded; malformed → null). */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const text = await readRawBody(req)
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('malformed JSON body')
  }
}

/** Write a JSON response with the given status. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' })
  res.end(text)
}

/** Write a raw text response with the given status and content type. */
function writeRaw(res: ServerResponse, status: number, contentType: string, body: string): void {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-cache' })
  res.end(body)
}

/** Fold titles for a set of sessions into a sessionId → title map. */
async function titleMap(
  sessionQuery: SwitchSessionQuery,
  sessionIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  if (sessionIds.length === 0) return new Map()
  const observations = await sessionQuery.readTitleSnapshots([...new Set(sessionIds)])
  const map = new Map<string, string>()
  for (const observation of observations) {
    if (observation.status !== 'fulfilled' || observation.value === undefined) continue
    const title = observation.value.title?.title
    if (typeof title === 'string' && title.trim().length > 0) map.set(observation.value.session.id, title)
  }
  return map
}

/** list-sessions: the title-search corpus (index-served, live fallback). */
async function listSessions(runtime: SwitchRuntime): Promise<{ ok: boolean; items?: unknown[]; error?: string }> {
  const index = runtime.index
  const sessionQuery = runtime.sessionQuery
  // Fast path: the independent index caches every session header (title/cwd/
  // updatedAt). Serving from it keeps the panel instant — the live-preferred
  // corpus projection (readTitleSnapshots per session) is what used to blow
  // the client's 10s timeout on large corpora. A refresh sync runs in the
  // background so newly created sessions appear on the next open.
  if (index.engine.isOpen && index.engine.countSessions() > 0) {
    if (sessionQuery !== undefined && index.sync.snapshot().state !== 'syncing') {
      void index.sync.poll().catch(() => {})
    }
    return {
      ok: true,
      items: index.engine.listIndexedSessions().map(session => ({
        sessionId: session.sessionId,
        title: session.title,
        cwd: session.cwd,
        updatedAt: session.updatedAt,
      })),
    }
  }
  if (sessionQuery === undefined) {
    return { ok: false, error: 'sessionQuery 服务不可用，且独立索引尚未建立' }
  }
  try {
    const records = await sessionQuery.listSessions()
    const titles = await titleMap(sessionQuery, records.map(record => record.header.id))
    return {
      ok: true,
      items: records.map(record => ({
        sessionId: record.header.id,
        title: titles.get(record.header.id) ?? '',
        cwd: record.header.cwd ?? '',
        updatedAt: record.header.createdAt,
      })),
    }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

/** 本地日界：'YYYY-MM-DD' → 当日 00:00（nextDay=true 时为次日 00:00，含结束日）。 */
function dayBoundaryMs(value: unknown, nextDay = false): number | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = new Date(`${value.trim()}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return undefined
  const ms = parsed.getTime()
  return nextDay ? ms + 24 * 60 * 60 * 1000 : ms
}

/**
 * content-search: session-grouped hits from DRS (hard dependency).
 * 检索语义（会话分组/类型加权/表面与归档日期过滤/锚定节选）全部在
 * dsh-reference-session-collector 投影库侧完成；DRS 不可达 → 显式报错，
 * **不回退本地索引**（本地引擎只剩会话头元数据面）。
 */
async function contentSearch(
  runtime: SwitchRuntime,
  payload: unknown,
  requestHost = '',
): Promise<{ ok: boolean; items?: unknown[]; error?: string }> {
  const record = payload as { query?: unknown; limit?: unknown; types?: unknown; sortBy?: unknown; archived?: unknown; expand?: unknown; from?: unknown; to?: unknown } | null
  const query = typeof record?.query === 'string' ? record.query.trim() : ''
  if (query === '') return { ok: false, error: '缺少 query' }
  // 检索域 chip（全部/活跃/归档）；未知值回退 'all'，新旧客户端互相兼容。
  const archived: 'active' | 'archived' | 'all'
    = record?.archived === 'active' ? 'active'
    : record?.archived === 'archived' ? 'archived'
    : 'all'
  // 日期范围（R6）:本地日界,结束日含当天;无效值静默忽略（新旧客户端兼容）。
  const fromMs = dayBoundaryMs(record?.from)
  const toMs = record?.to === undefined ? undefined : dayBoundaryMs(record?.to, true)
  const requestedLimit = typeof record?.limit === 'number' && Number.isSafeInteger(record.limit)
    ? record.limit
    : DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, requestedLimit), 100)
  // Unknown or absent ordering degrades to relevance — never to an error.
  const sortBy: SwitchSearchSort = record?.sortBy === 'time' ? 'time' : 'relevance'
  let types: readonly SwitchIndexContentType[]
  if (Array.isArray(record?.types) && record.types.length > 0) {
    types = record.types.filter((entry): entry is SwitchIndexContentType =>
      entry === 'all' || entry === 'user' || entry === 'reply' || entry === 'tool')
  } else {
    types = ['user', 'reply']
  }
  const kinds = resolveTypes(types)
  try {
    const items = await runtime.drsSource.searchGrouped({
      query,
      kinds,
      archived,
      sortBy,
      limit,
      // 命中展开（面板「分开显示」开关）：同会话多命中各自成行；非 true 缺省聚合。
      ...(record?.expand === true ? { expand: true } : {}),
      ...(requestHost === '' ? {} : { atHost: requestHost }),
      ...(fromMs === undefined ? {} : { from: fromMs }),
      ...(toMs === undefined ? {} : { to: toMs }),
    })
    return { ok: true, items }
  } catch (err) {
    return {
      ok: false,
      error: `dsh-reference-session-collector 搜索面不可用（硬依赖）：${String(err instanceof Error ? err.message : err)}`,
    }
  }
}

/** search-status: 可用性由 DRS 探针裁决（硬依赖）；本地引擎只剩头元数据面。 */
async function searchStatus(runtime: SwitchRuntime, requestHost = ''): Promise<unknown> {
  const index = runtime.index
  const sync = index.sync.snapshot()
  const drsUp = await runtime.drsSource.probe(requestHost)
  return {
    ok: true,
    available: drsUp,
    reason: drsUp ? undefined : 'drs-unavailable',
    indexing: sync.state === 'syncing',
    archivedSessions: index.engine.countArchived(),
    archive: index.archiveReader.diagnostics(),
    sync,
    rebuild: index.rebuild,
    deepSync: index.deepSync,
  }
}
/** index-status: full lifecycle surface for the settings row. */
async function indexStatus(runtime: SwitchRuntime): Promise<unknown> {
  const index = runtime.index
  const sync = index.sync.snapshot()
  let indexed = sync.indexed
  if (index.engine.isOpen) indexed = index.engine.countSessions()
  return {
    ok: true,
    available: index.engine.isOpen && indexed > 0,
    archivedSessions: index.engine.isOpen ? index.engine.countArchived() : 0,
    // Who owns the archived-session domain, so the card can point at the plugin
    // that can actually act on the count instead of leaving a bare number.
    steward: detectSteward(),
    driver: index.engine.driverLabel,
    archive: index.archiveReader.diagnostics() as SwitchArchiveDiagnostics,
    dir: index.layout.dir,
    archives: await listArchives(index.layout).catch(() => []),
    sync: { ...sync, indexed } satisfies SwitchSyncState,
    rebuild: index.rebuild,
    deepSync: index.deepSync,
  }
}

/**
 * index-rebuild: start the non-destructive 整理 (shadow build → atomic swap →
 * archives). Responds immediately; progress rides index-status.
 */
async function indexRebuild(runtime: SwitchRuntime): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const index = runtime.index
  if (index.rebuild.state === 'building' || index.rebuild.state === 'swapping') {
    return { ok: false, error: '整理已在进行中' }
  }
  const sessionQuery = runtime.sessionQuery
  if (sessionQuery === undefined || sessionQuery.readSession === undefined) {
    return { ok: false, error: 'sessionQuery 服务不可用，无法读取会话日志' }
  }
  const config = runtime.config()
  const keepArchives = Math.max(0, config.archiveKeep ?? DEFAULT_CONFIG.archiveKeep)
  void rebuildIndex(
    index.engine,
    index.layout,
    {
      listSessions: () => sessionQuery.listSessions(),
      readSession: async (sessionId: string) => {
        const snapshot = await sessionQuery.readSession!(sessionId)
        return { session: snapshot.session, events: snapshot.events }
      },
    },
    keepArchives,
    undefined,
    runtime.registry,
    {
      log: runtime.log,
      onState: (live) => { index.rebuild = live },
    },
  ).then((state) => {
    index.rebuild = state
  }).catch((err) => {
    index.rebuild = {
      state: 'error',
      done: 0,
      total: 0,
      startedAt: Date.now(),
      finishedAt: 0,
      failures: [],
      error: String(err instanceof Error ? err.message : err),
    }
  })
  index.rebuild = { state: 'building', done: 0, total: 0, startedAt: Date.now(), finishedAt: 0, failures: [] }
  return { ok: true, started: true }
}

/**
 * index-deep-sync：**深度同步**按钮的后端。
 * 1) 触发 DRS 后台慢速同步（POST `?op=sync`），轮询 op=status 直到 DRS 落定：
 *    新 DRS 看 `syncing`（真实在跑旗标）；旧 DRS 无该字段时退回 `last_sync.busy`；
 * 2) 再跑本地索引的非破坏性重建（整理），让标题/头部面跟上最新语料。
 * 全程后台执行，进度经 index-status 的 deepSync 面暴露；并发调用直接拒绝。
 * @param runtime - 运行时依赖。
 * @param requestHost - 调用方 Host（同源直连 DRS，端口动态分配）。
 */
async function indexDeepSync(
  runtime: SwitchRuntime,
  requestHost = '',
): Promise<{ ok: boolean; started?: boolean; error?: string }> {
  const index = runtime.index
  if (index.deepSync.state === 'drs-syncing' || index.deepSync.state === 'rebuilding') {
    return { ok: false, error: '深度同步已在进行中' }
  }
  const sleepMs = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms) })
  index.deepSync = { state: 'drs-syncing', startedAt: Date.now() }
  void (async () => {
    try {
      const trigger = await runtime.drsSource.triggerSync(requestHost)
      if (!trigger.ok) throw new Error(`触发 DRS 同步失败：${trigger.error ?? 'unknown'}`)
      const deadline = Date.now() + 180_000
      // 触发即回的契约下 DRS 可能 2s 内就扫完（71 会话实测 ~20ms）：至少轮询一轮，
      // 新 DRS 以 syncing===true 判在跑，旧 DRS 无该字段时退回 last_sync.busy===false。
      let settled = false
      while (Date.now() < deadline) {
        await sleepMs(2000)
        const detail = await runtime.drsSource.statusDetail(requestHost)
        const syncing = detail?.['syncing']
        if (typeof syncing === 'boolean') {
          settled = !syncing
        } else {
          const lastSync = detail?.['last_sync'] as { busy?: unknown } | undefined
          settled = lastSync !== undefined && lastSync.busy === false
        }
        if (settled) break
      }
      index.deepSync = { state: 'rebuilding', startedAt: index.deepSync.startedAt }
      const started = await indexRebuild(runtime)
      if (!started.ok) throw new Error(started.error ?? '本地索引重建未能启动')
      while (index.rebuild.state === 'building' || index.rebuild.state === 'swapping') await sleepMs(1500)
      index.deepSync = { state: 'done', startedAt: index.deepSync.startedAt, finishedAt: Date.now(), drsSettled: settled }
    } catch (err) {
      index.deepSync = {
        state: 'failed',
        startedAt: index.deepSync.startedAt,
        finishedAt: Date.now(),
        error: String(err instanceof Error ? err.message : err),
      }
    }
  })()
  return { ok: true, started: true }
}

/**
 * Tombs for the two methods this package used to own.
 *
 * `list-archived` / `archive-prune` moved to dsh-session-steward along with the
 * whole session-history face. A stale client bundle (browser refresh does not
 * reload the host half) must fail LOUDLY and be told where the feature went —
 * a silent 404 would read as "archiving is broken".
 */
const MOVED_TO_STEWARD: Record<string, string> = {
  'list-archived': 'session-history-list',
  'archive-prune': 'session-history-prune',
}

/** Build the explicit "moved" error body for a tombstoned method. */
function movedToSteward(method: string): { ok: false; error: string } {
  const replacement = MOVED_TO_STEWARD[method]
  return {
    ok: false,
    error: `"${method}" 已迁至会话管家 dsh-session-steward：请改用 POST /session-steward/api/${replacement}`,
  }
}

/** index-export: dump the active index as JSON Lines. */
async function indexExport(runtime: SwitchRuntime, res: ServerResponse): Promise<void> {
  const index = runtime.index
  if (index.engine.isOpen === false) {
    writeJson(res, 200, { ok: false, error: '独立索引未就绪' })
    return
  }
  writeRaw(res, 200, 'application/x-ndjson; charset=utf-8', exportSnapshot(index.engine))
}

/** index-import: parse a JSON Lines snapshot and swap it in as the active index. */
async function indexImport(runtime: SwitchRuntime, text: string) {
  const index = runtime.index
  if (index.rebuild.state === 'building' || index.rebuild.state === 'swapping') {
    return { ok: false, error: '整理/导入已在进行中' }
  }
  // Body is either raw JSON Lines or a JSON envelope { snapshot: "..." }.
  if (text.includes('"snapshot"')) {
    try {
      const envelope = JSON.parse(text) as { snapshot?: unknown }
      if (typeof envelope.snapshot === 'string') text = envelope.snapshot
    } catch { /* treat as plain JSONL */ }
  }
  const parsed = parseSnapshot(text)
  if (parsed.records.length === 0) return { ok: false, error: `快照无可导入会话（跳过 ${parsed.skipped} 行）` }
  const config = runtime.config()
  const keepArchives = Math.max(0, config.archiveKeep ?? DEFAULT_CONFIG.archiveKeep)
  void importIntoIndex(index.engine, index.layout, parsed.records, keepArchives)
    .then((state) => { index.rebuild = state })
    .catch((err) => {
      index.rebuild = {
        state: 'error',
        done: 0,
        total: parsed.records.length,
        startedAt: Date.now(),
        finishedAt: 0,
        failures: [],
        error: String(err instanceof Error ? err.message : err),
      }
    })
  index.rebuild = { state: 'building', done: 0, total: parsed.records.length, startedAt: Date.now(), finishedAt: 0, failures: [] }
  return { ok: true, started: true, sessions: parsed.records.length, skipped: parsed.skipped }
}

/** ------------------------------------------------------------------ index service */

/** The per-activation index service state, carried in the apply closure. */
export interface SwitchIndexServiceState {
  engine: SwitchIndexEngine
  sync: SwitchWatermarkSync
  layout: SwitchIndexLayout
  rebuild: SwitchRebuildState
  /** Official archive-set reader (registry first, storage-hub file fallback). */
  archiveReader: ReturnType<typeof createArchiveSource>
  /** 深度同步（DRS 慢速重建 → 本地索引重建）的可见状态；`drsSettled` 记 DRS 是否在 180s 内落定。 */
  deepSync: { state: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed'; startedAt?: number; finishedAt?: number; error?: string; drsSettled?: boolean }
}

/**
 * Everything an HTTP handler needs, captured from the apply closure: the
 * optional live sessionQuery, the index service state, and the latest config.
 * Handlers never touch the cordis context — arbitrary property writes on a
 * Context are rejected ("cannot set property ... without provide").
 */
interface SwitchRuntime {
  sessionQuery: SwitchSessionQuery | undefined
  index: SwitchIndexServiceState
  /** DRS 直连客户端（T7.3 硬依赖：内容分组检索唯一来源 + 可用性探针）。 */
  drsSource: DrsCorpusSource
  config: () => SwitchSearchConfig
  /** Lazy official archive-set source (registry first, file fallback). */
  registry: () => { archivedSessionIds: readonly string[] }
  /** Cordis logger bridge ([switch-search] prefixed). */
  log: (msg: string) => void
}

/**
 * Plugin body: mount the fenced /switch-search/api route and own the independent
 * index lifecycle.
 * @param ctx - host plugin context (webServer, webStartup/webRuntime, optional sessionQuery).
 * @param entry - composition entry (0.1.7: `.volatile()` fields arrive as live refs).
 */
export function apply(ctx: Context, entry: Partial<SwitchSearchConfig> = {}): void {
  // 0.1.7：volatile 字段每次读取解引出最新快照（开关/同步间隔即时生效），
  // 不再有任何 settings 注册调用。
  const current = (): SwitchSearchConfig => {
    const { search } = bridgeOverlay(settingsBridge)
    const bool = (key: string, v: boolean): boolean => (typeof search[key] === 'boolean' ? (search[key] as boolean) : v)
    const num = (key: string, v: number): number =>
      typeof search[key] === 'number' && Number.isFinite(search[key] as number) ? (search[key] as number) : v
    const str = (key: string, v: string): string => (typeof search[key] === 'string' ? (search[key] as string) : v)
    const mode = (v: 'title' | 'content'): 'title' | 'content' =>
      search['defaultMode'] === 'title' || search['defaultMode'] === 'content' ? (search['defaultMode'] as 'title' | 'content') : v
    const corpus = (v: 'native' | 'drs'): 'native' | 'drs' =>
      search['corpusSource'] === 'native' || search['corpusSource'] === 'drs' ? (search['corpusSource'] as 'native' | 'drs') : v
    return {
      enabled: bool('enabled', readVolatileValue(entry.enabled) ?? DEFAULT_CONFIG.enabled),
      defaultMode: mode(readVolatileValue(entry.defaultMode) ?? DEFAULT_CONFIG.defaultMode),
      autoSync: bool('autoSync', readVolatileValue(entry.autoSync) ?? DEFAULT_CONFIG.autoSync),
      syncIntervalMs: num('syncIntervalMs', readVolatileValue(entry.syncIntervalMs) ?? DEFAULT_CONFIG.syncIntervalMs),
      archiveKeep: num('archiveKeep', readVolatileValue(entry.archiveKeep) ?? DEFAULT_CONFIG.archiveKeep),
      indexDir: str('indexDir', readVolatileValue(entry.indexDir) ?? DEFAULT_CONFIG.indexDir),
      corpusSource: corpus(readVolatileValue(entry.corpusSource) ?? DEFAULT_CONFIG.corpusSource),
      drsBaseUrl: str('drsBaseUrl', readVolatileValue(entry.drsBaseUrl) ?? DEFAULT_CONFIG.drsBaseUrl),
    }
  }

  // Legacy 设置桥（≤0.1.5）：同步建 holder，桥面在 ctx.inject(['settings']) 回调里咬合。
  const settingsBridge: BridgeState = installLegacySettingsBridge(ctx)

  // Independent index lifecycle: open the engine, run an initial watermark
  // sync, and keep polling. All of it is background work; HTTP stays instant.
  const config = current()
  const layout: SwitchIndexLayout = {
    ...DEFAULT_INDEX_LAYOUT,
    dir: resolveIndexDir(config.indexDir || process.env[INDEX_DIR_ENV]),
  }
  const engine = new SwitchIndexEngine({ path: `${layout.dir}/${layout.active}` })
  const sessionQuery = ctx.get('sessionQuery') as SwitchSessionQuery | undefined
  const log = (msg: string): void => {
    try {
      const logger = (ctx as unknown as { logger?: { info?: (m: string) => void; warn?: (m: string) => void } }).logger
      logger?.info?.(`[switch-search] ${msg}`)
    } catch { /* logging must never break the host */ }
  }
  const archiveReader = createArchiveSource(() => ctx.get('workspaceRegistry'))

  // 投影缓存标题第三源：官方逐会话缓存文件 record.rows.title.val（读不到/畸形一律空串）。
  const readProjectionTitle = (sessionId: string): string => {
    try {
      const path = join(process.env['DSH_HOME'] ?? join(homedir(), '.dsh'), 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
      if (!existsSync(path)) return ''
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
        record?: { rows?: { title?: { val?: unknown } } }
      }
      const value = parsed.record?.rows?.title?.val
      return typeof value === 'string' ? value : ''
    } catch {
      return ''
    }
  }

  const trustedRuntime: SwitchWebRuntime = ctx.webStartup ?? ctx.webRuntime!

  // DRS 语料源（T7.1/T7.3 硬依赖）：corpusSource='drs' 时索引语料改从
  // dsh-reference-session-collector 投影库取；Host 头回显首个 trustedHosts 条目
  // （DRS 信任门是精确匹配，条目省略端口时 URL 带端口会失配）。
  const trustedHosts = trustedRuntime.trustedHosts
  const drsSource = new DrsCorpusSource({
    baseUrl: resolveDrsBaseUrl(config.drsBaseUrl, trustedHosts),
    hostHeader: trustedHosts !== undefined && trustedHosts.length > 0 ? trustedHosts[0] : undefined,
    log,
  })
  const state: SwitchIndexServiceState = {
    engine,
    archiveReader,
    sync: new SwitchWatermarkSync(engine, {
      listSessions: () => sessionQuery?.listSessions() ?? Promise.resolve([]),
      readSession: async (sessionId: string) => {
        if (sessionQuery?.readSession === undefined) throw new Error('sessionQuery.readSession 不可用')
        return sessionQuery.readSession(sessionId)
      },
      readTitleSnapshots: sessionQuery === undefined
        ? undefined
        : (ids) => sessionQuery.readTitleSnapshots(ids),
    }, () => ({ archivedSessionIds: archiveReader.read().ids }), log, undefined, readProjectionTitle, config.corpusSource === 'native' ? undefined : drsSource),
    layout,
    rebuild: { state: 'idle', done: 0, total: 0, startedAt: 0, finishedAt: 0, failures: [] },
    deepSync: { state: 'idle' },
  }
  const runtime: SwitchRuntime = {
    sessionQuery,
    index: state,
    drsSource,
    config: () => current(),
    registry: () => ({ archivedSessionIds: archiveReader.read().ids }),
    log,
  }

  // 双名回退链：0.2.1-a.2 起宿主服务 webRuntime 更名 webStartup；注入主名
  // webStartup 在新代必有，旧代（≤0.2.0）回退 webRuntime，两代通吃。
  let syncTimer: ReturnType<typeof setInterval> | undefined
  const scheduleSync = (intervalMs: number): void => {
    if (syncTimer !== undefined) clearInterval(syncTimer)
    if (intervalMs <= 0) return
    syncTimer = setInterval(() => {
      const latest = current()
      if (latest.autoSync === false) return
      void state.sync.poll().catch(() => {})
    }, Math.max(5_000, intervalMs))
  }

  // Realtime titles. A rename appends the log-only `session/title` event, which
  // reaches the index one poll later (default 30s). Folding the title straight
  // off the append feed removes that latency without a full pass. The listener
  // is deliberately trivial — this feed carries EVERY appended event, streaming
  // chunks included — and never throws, because it runs inside the host's
  // fire-and-forget append publication.
  let pendingTitleIds = new Set<string>()
  let titleTimer: ReturnType<typeof setTimeout> | undefined
  const flushPendingTitles = (): void => {
    titleTimer = undefined
    const ids = [...pendingTitleIds]
    pendingTitleIds = new Set()
    if (ids.length === 0) return
    void state.sync.refreshTitles(ids).catch(() => {})
  }
  ctx.effect(() => {
    const bus = ctx as unknown as {
      on?: (name: string, listener: (session: { id?: unknown }, event: { type?: unknown }) => void) => () => void
    }
    if (typeof bus.on !== 'function') return () => {}
    try {
      return bus.on('session/event', (session, event) => {
        if (event?.type !== TITLE_EVENT_TYPE) return
        if (current().autoSync === false) return
        const id = session?.id
        if (typeof id !== 'string' || id === '') return
        pendingTitleIds.add(id)
        if (titleTimer !== undefined) return
        titleTimer = setTimeout(flushPendingTitles, TITLE_FLUSH_MS)
      })
    } catch {
      // No event bus on this host: the poll stays the fallback path.
      return () => {}
    }
  }, 'dsh-search-index: realtime titles')

  const initialConfig = current()
  void (async () => {
    try {
      const recovered = await recoverIndex(layout, log)
      if (recovered.length > 0) log(`index recovery applied ${recovered.length} fix(es)`)
    } catch (err) {
      log(`index recovery failed: ${String(err instanceof Error ? err.message : err)}`)
    }
    await engine.open().catch(() => {})
    log(`index open: driver=${engine.driverLabel} dir=${layout.dir}`)
    if (engine.driverLabel === 'node:sqlite') {
      log('tip: optional speedup not active — approve the better-sqlite3 build (add "better-sqlite3@*: true" under allowBuilds in the profile pnpm-workspace.yaml, then reinstall) to speed up index rebuilds; everything works without it')
    }
    if (initialConfig.autoSync !== false) await state.sync.poll().catch(() => {})
    scheduleSync(initialConfig.syncIntervalMs ?? DEFAULT_CONFIG.syncIntervalMs!)
  })()

  ctx.effect(() => () => {
    if (syncTimer !== undefined) clearInterval(syncTimer)
    if (titleTimer !== undefined) clearTimeout(titleTimer)
    engine.close()
  }, 'dsh-search-index: index lifecycle')

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/switch-search/api',
    handler: async (req, res) => {
      if (!isTrustedApiRequest(req, trustedRuntime.trustedHosts)) {
        writeJson(res, 403, { ok: false, error: 'forbidden' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith('/switch-search/api/')
        ? pathname.slice('/switch-search/api/'.length)
        : undefined
      if (method === undefined || method.includes('/')) {
        writeJson(res, 404, { ok: false, error: 'unknown switch-search API method' })
        return
      }
      try {
        // 设置桥方法不受子域闸管——关掉 enabled 后仍必须能读配置。
        if (method === 'settings-describe') {
          if (settingsBridge.bridge !== undefined) {
            writeJson(res, 200, settingsDescribe(settingsBridge))
            return
          }
          // modern 宿主（0.1.7+，无 legacy settings 服务）：按命名空间只读投影。
          writeJson(res, 200, {
            ok: true,
            namespaces: { 'switch-search': { ...current() } },
            writable: false,
            revision: settingsBridge.revision,
          })
          return
        }
        if (method === 'settings-mutate') {
          const payload = await readJsonBody(req)
          writeJson(res, 200, await settingsMutate(settingsBridge, payload))
          return
        }
        // 子域闸：enabled=false 时其余方法显式拒绝（不留空壳）。
        if (current().enabled === false) {
          writeJson(res, 200, { ok: false, error: `子域已关闭（enabled=false）：${method} 未注册` })
          return
        }
        if (method === 'index-export') {
          await indexExport(runtime, res)
          return
        }
        if (method === 'index-import') {
          // The body is raw JSON Lines (or a { snapshot } envelope), not JSON.
          const text = await readRawBody(req)
          writeJson(res, 200, await indexImport(runtime, text))
          return
        }
        const payload = await readJsonBody(req)
        if (method === 'list-sessions') {
          writeJson(res, 200, await listSessions(runtime))
          return
        }
        if (method === 'content-search') {
          // 同源转发臂：DSR 由宿主进程自身提供（/api/dsh-reference-session-collector），
          // 端口是动态分配的——必须把调用方 Host 透传下去，否则会落到 8080 缺省口。
          writeJson(res, 200, await contentSearch(runtime, payload, String(req.headers.host ?? '')))
          return
        }
        if (method === 'search-status' || method === 'index-status') {
          const host = String(req.headers.host ?? '')
          writeJson(res, 200, method === 'search-status' ? await searchStatus(runtime, host) : await indexStatus(runtime))
          return
        }
        if (method === 'index-rebuild') {
          writeJson(res, 200, await indexRebuild(runtime))
          return
        }
        if (method === 'index-deep-sync') {
          // 深度同步：先让 DRS 慢扫修好自己的投影库，再把本地索引整理一遍（同源 Host 透传）。
          writeJson(res, 200, await indexDeepSync(runtime, String(req.headers.host ?? '')))
          return
        }
        if (method === 'list-archived' || method === 'archive-prune') {
          // Explicit tombstone, never a silent 404: the feature moved packages.
          writeJson(res, 410, movedToSteward(method))
          return
        }
        writeJson(res, 404, { ok: false, error: `unknown switch-search API method "${method}"` })
      } catch (err) {
        writeJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
      }
    },
  }), 'dsh-search-index: /switch-search/api route')
}
