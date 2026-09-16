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
import { SwitchIndexEngine, type SwitchIndexContentType, type SwitchSearchSort } from './host/engine.ts'
import { SwitchWatermarkSync, type SwitchSyncState } from './host/sync.ts'
import { createArchiveSource, type SwitchArchiveDiagnostics } from './host/archive-source.ts'
import { detectSteward } from './host/peers.ts'
// The archive-set WRITER (prune) moved to dsh-session-steward: this package
// reads the official archive set to exclude archived sessions from the index,
// and no longer edits it. Single writer, one owner.
export { createArchiveSource, type SwitchArchiveDiagnostics } from './host/archive-source.ts'
import {
  DEFAULT_INDEX_LAYOUT,
  importIntoIndex,
  listArchives,
  recoverIndex,
  rebuildIndex,
  resolveIndexDir,
  type SwitchIndexLayout,
  type SwitchRebuildState,
} from './host/rebuild.ts'
import { exportSnapshot, parseSnapshot } from './host/snapshot.ts'
import type { SwitchRawEvent } from './host/extract.ts'
import {
  DEFAULT_CONFIG,
  SWITCH_SEARCH_SETTINGS_NAMESPACE,
  type SwitchSearchConfig,
} from './config.ts'

export { DEFAULT_CONFIG, SWITCH_SEARCH_SETTINGS_NAMESPACE } from './config.ts'
export type { SwitchSearchConfig } from './config.ts'
export { SwitchIndexEngine } from './host/engine.ts'
export { SwitchWatermarkSync } from './host/sync.ts'
export { rebuildIndex, importIntoIndex, recoverIndex, DEFAULT_INDEX_LAYOUT } from './host/rebuild.ts'
export { exportSnapshot, parseSnapshot } from './host/snapshot.ts'

/** The webServer service face this plugin uses (structural mirror). */
interface SwitchWebServer {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** The web runtime service face: bind-derived trusted authorities. */
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
    webRuntime: SwitchWebRuntime
    sessionQuery?: SwitchSessionQuery
    workspaceRegistry?: SwitchWorkspaceRegistry
  }
}

/** Stable plugin name for the cordis row. */
export const name = 'dsh-search-index'

/** Services required before mounting: the web server routes and the trust list. */
export const inject = ['webServer', 'webRuntime']

/** Composition-entry schema: what a dsh profile may configure at assembly time. */
export const Config: z<SwitchSearchConfig> = z.object({
  enabled: z.boolean().default(true),
  defaultMode: z.union(['title', 'content']).default('title'),
  autoSync: z.boolean().default(true),
  syncIntervalMs: z.number().default(30_000),
  archiveKeep: z.number().default(2),
  indexDir: z.string().default(''),
})

/**
 * Minimal face of the dsh `settings` service (typed locally — the plugin must
 * NOT value-import the official `@deepseek-ai/dsh-settings` package).
 */
interface SettingsScopeLike {
  get(): unknown
  watch(callback: () => void): () => void
}
interface SettingsServiceLike {
  register(ns: string, schema: unknown, options?: { base?: unknown }): SettingsScopeLike
}
interface SettingsAwareCtx {
  inject(deps: readonly string[], fn: (sctx: {
    settings: SettingsServiceLike
    effect(cleanup: () => (() => void) | void, label?: string): void
  }) => void): void
}

/**
 * Inline equivalent of the official `installSettingsSection` helper: register
 * the namespace through the `settings` service, layer the composition entry as
 * `base`, and keep the runtime source live. Same pattern as dsh-thinking-levels.
 * @param ctx - host context carrying the settings service.
 * @param ns - settings namespace to register.
 * @param schema - schemastery schema resolving the namespace value.
 * @param entry - composition-entry config used as the `base` layer.
 * @param hooks - source sink and change notification.
 */
function installSettingsSection<T>(
  ctx: Context,
  ns: string,
  schema: unknown,
  entry: T,
  hooks: { setSource: (source: () => T) => void; onChange: () => void },
): void {
  ;(ctx as unknown as SettingsAwareCtx).inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(ns, schema, { base: entry })
    hooks.setSource(() => scope.get() as T)
    hooks.onChange()
    sctx.effect(() => () => {
      hooks.setSource(() => entry)
      hooks.onChange()
    })
    scope.watch(() => hooks.onChange())
  })
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

/**
 * content-search: session-grouped hits from the independent index.
 * `sortBy: 'time'` orders by session recency (`updatedAt`), anything else by
 * relevance; the host orders before truncating so the page is honest.
 */
async function contentSearch(
  runtime: SwitchRuntime,
  payload: unknown,
): Promise<{ ok: boolean; items?: unknown[]; error?: string }> {
  const record = payload as { query?: unknown; limit?: unknown; types?: unknown; sortBy?: unknown } | null
  const query = typeof record?.query === 'string' ? record.query.trim() : ''
  if (query === '') return { ok: false, error: '缺少 query' }
  const requestedLimit = typeof record?.limit === 'number' && Number.isSafeInteger(record.limit)
    ? record.limit
    : DEFAULT_LIMIT
  const limit = Math.min(Math.max(1, requestedLimit), 100)
  // Unknown or absent ordering degrades to relevance — never to an error, so an
  // old client half talking to a new host half keeps working.
  const sortBy: SwitchSearchSort = record?.sortBy === 'time' ? 'time' : 'relevance'
  let types: readonly SwitchIndexContentType[]
  if (Array.isArray(record?.types) && record.types.length > 0) {
    types = record.types.filter((entry): entry is SwitchIndexContentType =>
      entry === 'all' || entry === 'user' || entry === 'reply' || entry === 'tool')
  } else {
    types = ['user', 'reply']
  }
  const index = runtime.index
  if (index.engine.isOpen === false) {
    return { ok: false, error: '独立索引未就绪：请在面板或设置中先建立索引（整理索引）' }
  }
  try {
    return {
      ok: true,
      items: index.engine.search({ query, types, limit, sortBy }),
    }
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) }
  }
}

/** search-status: probe the independent index readiness and progress. */
async function searchStatus(runtime: SwitchRuntime): Promise<unknown> {
  const index = runtime.index
  const sync = index.sync.snapshot()
  return {
    ok: true,
    available: index.engine.isOpen && index.engine.countSessions() > 0,
    reason: index.engine.isOpen ? undefined : 'not-open',
    indexing: sync.state === 'syncing',
    archivedSessions: index.engine.countArchived(),
    archive: index.archiveReader.diagnostics(),
    sync,
    rebuild: index.rebuild,
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
  config: () => SwitchSearchConfig
  /** Lazy official archive-set source (registry first, file fallback). */
  registry: () => { archivedSessionIds: readonly string[] }
  /** Cordis logger bridge ([switch-search] prefixed). */
  log: (msg: string) => void
}

/**
 * Plugin body: mount the fenced /switch-search/api route, own the independent
 * index lifecycle, and register the settings namespace.
 * @param ctx - host plugin context (webServer, webRuntime, optional sessionQuery).
 */
export function apply(ctx: Context): void {
  // Register the runtime-adjustable settings namespace (the composition entry
  // is the base; the settings section layers on top).
  let current: () => SwitchSearchConfig = () => DEFAULT_CONFIG
  installSettingsSection(ctx, SWITCH_SEARCH_SETTINGS_NAMESPACE, Config, DEFAULT_CONFIG, {
    setSource: (source) => { current = source },
    onChange: () => {},
  })

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
    }, () => ({ archivedSessionIds: archiveReader.read().ids }), log),
    layout,
    rebuild: { state: 'idle', done: 0, total: 0, startedAt: 0, finishedAt: 0, failures: [] },
  }
  const runtime: SwitchRuntime = {
    sessionQuery,
    index: state,
    config: () => current(),
    registry: () => ({ archivedSessionIds: archiveReader.read().ids }),
    log,
  }

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
      if (!isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)) {
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
          writeJson(res, 200, await contentSearch(runtime, payload))
          return
        }
        if (method === 'search-status' || method === 'index-status') {
          writeJson(res, 200, method === 'search-status' ? await searchStatus(runtime) : await indexStatus(runtime))
          return
        }
        if (method === 'index-rebuild') {
          writeJson(res, 200, await indexRebuild(runtime))
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
