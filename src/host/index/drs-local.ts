/**
 * DRS 进程内只读查询臂（T7.4）。
 *
 * 存在理由：DSH NEXT 桌面版在 web 层的 **路由分发之前** 就对非 renderer 请求
 * 直接 403（`Browser access is disabled`），renderer token 只在渲染进程里，
 * 插件 host 半拿不到。于是「插件 fetch 自己的宿主端口」这条 HTTP 路径在桌面版
 * 永远走不通——与 `dsh-reference-session-collector` 装没装、装得对不对无关。
 * 本模块改用 DRSC 包内的查询面（`createQueryContext` + `searchGrouped`）直连
 * `projection.db`，语义与 HTTP 臂逐字一致（同样的加权/分组/日期域/锚定节选）。
 *
 * 只读纪律（硬约束，改动前先读 `dsh-reference-session-collector/src/schema.ts`）：
 * - 只允许 `new DatabaseSync(path, { readOnly: true })`；
 * - **禁止调用 `openProjectionStore`**：它会 mkdir、`PRAGMA journal_mode=WAL`，
 *   并在 meta 版本串不符时 DROP 全部表 + VACUUM 重建 + 回写版本——那是写路径，
 *   与正在同步的 DRSC 抢锁，且会清空用户投影库；
 * - 版本不符只报 `drs-schema-mismatch`，**不清库、不修库**；
 * - 库目录不存在时不创建目录（本模块不产生任何写盘）。
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  DrsUnavailableError,
  classifyDrsFailure,
  type DrsSearchHit,
} from './drs-contract.ts'

/** 投影库目录环境变量（与 DRSC `resolveIndexDir` 同字面；不跨包 import）。 */
export const DRS_DIR_ENV = 'DSH_REFERENCE_SESSION_COLLECTOR_DIR'

/** 运行期依赖说明符（变量形式：不参与 TS 解析，也不被判成可打包依赖）。 */
const DRS_SPECIFIER = 'dsh-reference-session-collector'

/** 进程内可用性探针结果。 */
export interface DrsLocalProbe {
  ok: boolean
  /** 失败档位（`drs-missing` / `drs-empty` / `drs-schema-mismatch`）。 */
  reason?: string
  /** 库内 `meta.schema_version`。 */
  schemaVersion?: string
  /** 包侧 `PROJECTION_SCHEMA_VERSION`。 */
  expected?: string
  sessions?: number
  dir?: string
  detail?: string
}

/** 进程内检索请求（与 HTTP 臂同名参数；`atHost` 无意义）。 */
export interface DrsLocalSearchRequest {
  query: string
  kinds?: readonly string[]
  archived?: 'active' | 'archived' | 'all'
  from?: number
  to?: number
  sortBy?: 'relevance' | 'time'
  limit?: number
  expand?: boolean
}

export interface DrsLocalArm {
  probe(): Promise<DrsLocalProbe>
  searchGrouped(request: DrsLocalSearchRequest): Promise<DrsSearchHit[]>
  dispose(): void
}

/** 库目录解析：显式入参 > 环境变量 > `~/.dsh-reference-session-collector`。 */
export function resolveDrsDir(explicit?: string): string {
  const trimmed = explicit?.trim() ?? ''
  if (trimmed !== '') return trimmed
  const fromEnv = process.env[DRS_DIR_ENV]
  if (fromEnv !== undefined && fromEnv.trim() !== '') return fromEnv.trim()
  return join(homedir(), '.dsh-reference-session-collector')
}

/** DRSC 查询面的结构镜像（不跨包取类型：依赖在声明范围内可自由升级）。 */
interface DrsHitRow {
  session_id: string
  title: string
  seq: number
  type: string
  time: number
  updated_at: number
  snippet: string
}
interface DrsModuleFace {
  PROJECTION_SCHEMA_VERSION?: string
  createQueryContext(store: unknown): unknown
  searchGrouped(ctx: unknown, request: Record<string, unknown>): { hits?: DrsHitRow[] }
}

let modulePromise: Promise<DrsModuleFace> | undefined

/**
 * 懒加载 DRSC。失败（未装 / Node < 22.5 缺 node:sqlite）归 `drs-missing`，
 * 且不缓存失败值——用户补装后无需重启宿主即可重试。
 */
async function loadDrs(): Promise<DrsModuleFace> {
  if (modulePromise === undefined) {
    modulePromise = (async () => {
      try {
        const mod = await import(DRS_SPECIFIER) as unknown as DrsModuleFace
        if (typeof mod.createQueryContext !== 'function' || typeof mod.searchGrouped !== 'function') {
          throw new Error('导出面缺少 createQueryContext/searchGrouped')
        }
        return mod
      } catch (err) {
        modulePromise = undefined
        throw new DrsUnavailableError('drs-missing', err instanceof Error ? err.message : String(err))
      }
    })()
  }
  return modulePromise
}

/** node:sqlite 的结构子集（避免类型层依赖 Node 22.5+ 的模块声明）。 */
interface DbFace {
  prepare(sql: string): {
    get(...params: unknown[]): unknown
    all(...params: unknown[]): unknown[]
  }
  close(): void
}

/** 连接级 busy timeout：DRSC 同步期间持有写锁时，只读查询最多等 3s 而不是立刻失败。 */
function applyBusyTimeout(db: DbFace): void {
  try {
    db.prepare('PRAGMA busy_timeout=3000').get()
  } catch {
    /* 老版本 SQLite 不支持该 PRAGMA 时直接放弃——只影响并发期重试体验 */
  }
}

/**
 * 只读打开投影库。只读失败（WAL 库 `-shm` 不可写的 SQLITE_READONLY 类错误）时
 * 降级为普通连接——**本模块仍然只执行 SELECT**，不建目录、不跑 DDL、不写 meta。
 */
async function openReadOnly(dbPath: string, log: (message: string) => void): Promise<DbFace> {
  const sqlite = await import('node:sqlite') as unknown as {
    DatabaseSync: new (path: string, options?: Record<string, unknown>) => DbFace
  }
  try {
    const db = new sqlite.DatabaseSync(dbPath, { readOnly: true })
    applyBusyTimeout(db)
    return db
  } catch (err) {
    log(`[switch-search] DRS 只读连接失败(${err instanceof Error ? err.message : String(err)})，降级普通连接（仍只读查询）`)
    const db = new sqlite.DatabaseSync(dbPath)
    applyBusyTimeout(db)
    return db
  }
}

/** 读 `meta.schema_version`（表不存在/半建库 → undefined）。 */
function readSchemaVersion(db: DbFace): string | undefined {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key='schema_version'").get() as { value?: unknown } | undefined
    return typeof row?.value === 'string' ? row.value : undefined
  } catch {
    return undefined
  }
}

/** 会话行数（0 = 还没来得及投影）。 */
function countSessions(db: DbFace): number {
  try {
    const row = db.prepare('SELECT COUNT(*) AS c FROM sessions').get() as { c?: unknown } | undefined
    return Number(row?.c ?? 0)
  } catch {
    return 0
  }
}

interface OpenStore {
  dir: string
  db: DbFace
  ctx: unknown
  module: DrsModuleFace
  schemaVersion: string
}

/**
 * 建一个进程内只读臂。
 * @param options.dir - 库目录解析（缺省 env/默认；绝不跟随本地索引 `indexDir`）。
 * @param options.log - `[switch-search]` 日志桥。
 */
export function createDrsLocalArm(options: { dir?: () => string; log?: (message: string) => void } = {}): DrsLocalArm {
  const log = options.log ?? ((): void => {})
  const resolveDir = (): string => options.dir?.() ?? resolveDrsDir()
  let opened: OpenStore | undefined

  const closeOpened = (): void => {
    if (opened === undefined) return
    try { opened.db.close() } catch { /* 关闭失败不影响下次重开 */ }
    opened = undefined
  }

  /** 打开并过闸；失败一律 `DrsUnavailableError`（本地错误归 `drs-empty` 并带原始细节）。 */
  const acquire = async (): Promise<OpenStore> => {
    const module = await loadDrs()
    const dir = resolveDir()
    if (opened !== undefined && opened.dir === dir && opened.module === module) return opened
    closeOpened()
    const dbPath = join(dir, 'projection.db')
    if (!existsSync(dbPath)) throw new DrsUnavailableError('drs-empty', `未找到投影库：${dbPath}`)
    let db: DbFace
    try {
      db = await openReadOnly(dbPath, log)
    } catch (err) {
      throw new DrsUnavailableError('drs-empty', `投影库无法打开：${err instanceof Error ? err.message : String(err)}`)
    }
    const schemaVersion = readSchemaVersion(db)
    const expected = module.PROJECTION_SCHEMA_VERSION
    if (typeof expected === 'string' && schemaVersion !== undefined && schemaVersion !== expected) {
      db.close()
      throw new DrsUnavailableError('drs-schema-mismatch', `db=${schemaVersion} pkg=${expected}`)
    }
    if (schemaVersion === undefined) {
      db.close()
      throw new DrsUnavailableError('drs-empty', '投影库缺少 meta.schema_version（尚未完成首轮同步）')
    }
    if (countSessions(db) === 0) {
      db.close()
      throw new DrsUnavailableError('drs-empty', '投影库内尚无会话行')
    }
    const ctx = module.createQueryContext({ db, summaries: new Map() })
    opened = { dir, db, ctx, module, schemaVersion }
    return opened
  }

  return {
    async probe(): Promise<DrsLocalProbe> {
      try {
        const store = await acquire()
        return {
          ok: true,
          schemaVersion: store.schemaVersion,
          expected: store.module.PROJECTION_SCHEMA_VERSION,
          sessions: countSessions(store.db),
          dir: store.dir,
        }
      } catch (err) {
        const failure = err instanceof DrsUnavailableError ? err : classifyDrsFailure(err)
        return { ok: false, reason: failure.code, detail: failure.detail, dir: resolveDir() }
      }
    },

    async searchGrouped(request: DrsLocalSearchRequest): Promise<DrsSearchHit[]> {
      const store = await acquire()
      const wire: Record<string, unknown> = { query: request.query }
      if (request.kinds !== undefined && request.kinds.length > 0) wire['kinds'] = [...request.kinds]
      if (request.archived !== undefined) wire['archived'] = request.archived
      if (request.from !== undefined) wire['from'] = request.from
      if (request.to !== undefined) wire['to'] = request.to
      if (request.sortBy !== undefined) wire['sortBy'] = request.sortBy
      if (request.limit !== undefined) wire['limit'] = request.limit
      if (request.expand === true) wire['expand'] = true
      let body: { hits?: DrsHitRow[] }
      try {
        body = store.module.searchGrouped(store.ctx, wire)
      } catch (err) {
        // 查询期失败（列形状断裂/库被写坏）= 本地库问题，不是网络问题。
        throw new DrsUnavailableError('drs-empty', `本地查询失败：${err instanceof Error ? err.message : String(err)}`)
      }
      const rows = Array.isArray(body.hits) ? body.hits : []
      return rows.map(row => ({
        sessionId: String(row.session_id ?? ''),
        title: String(row.title ?? ''),
        seq: Number(row.seq ?? 0),
        type: String(row.type ?? ''),
        time: Number(row.time ?? 0),
        updatedAt: Number(row.updated_at ?? 0),
        snippet: String(row.snippet ?? ''),
      }))
    },

    dispose(): void {
      closeOpened()
    },
  }
}
