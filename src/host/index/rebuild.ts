/**
 * Non-destructive index rebuild ("整理索引") for the independent index.
 *
 * A shadow index file is built from scratch beside the active one; the active
 * engine keeps serving queries the whole time. When the shadow is complete the
 * swap is three synchronous renames (active → archive, shadow → active), then
 * the engine reopens. Old archives are kept (bounded) and stay readable.
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SwitchIndexEngine } from './engine.ts'
import { extractTitleFromEvents, type SwitchRawEvent } from './extract.ts'
import type { SwitchArchiveSource } from './sync.ts'

/** The corpus reader a rebuild needs (same faces as the syncer). */
export interface SwitchRebuildSessionQuery {
  listSessions(): Promise<readonly { header: { id: string; version: number; createdAt?: number; cwd?: string } }[]>
  readSession(sessionId: string): Promise<{
    session: { id: string; version: number; createdAt?: number; cwd?: string }
    events: readonly SwitchRawEvent[]
  }>
}

/** Live rebuild progress reported to the status endpoint. */
export interface SwitchRebuildState {
  state: 'idle' | 'building' | 'swapping' | 'error'
  /** Sessions written into the shadow index so far. */
  done: number
  /** Sessions seen in the corpus when the build started. */
  total: number
  /** Epoch ms when the build started. */
  startedAt: number
  /** Epoch ms when the last build finished. */
  finishedAt: number
  /** Per-session failures during the last build. */
  failures: { sessionId: string; error: string }[]
  error?: string
}

/** Filesystem layout of one index directory. */
export interface SwitchIndexLayout {
  /** Directory holding every index file. */
  dir: string
  /** Active index file name. */
  active: string
  /** Shadow file name used while building. */
  building: string
  /** Archive file name prefix. */
  archivePrefix: string
}

/** Default layout names. */
export const DEFAULT_INDEX_LAYOUT: SwitchIndexLayout = {
  dir: '.',
  active: 'index.sqlite',
  building: 'index.building.sqlite',
  archivePrefix: 'index.archive-',
}

/**
 * Inspect the index directory for half-built leftovers from an abnormally
 * terminated rebuild and recover:
 * - shadow present + active present: the build never finished — the shadow
 *   is garbage (the active index kept serving) and is discarded.
 * - shadow present + active missing: the crash hit the rename window — the
 *   newest archive is restored as the active index, the shadow discarded.
 * Runs at host activation, before the engine opens (opening would create a
 * fresh empty active file and mask the swap-window case).
 */
export async function recoverIndex(
  layout: SwitchIndexLayout,
  log?: (msg: string) => void,
): Promise<string[]> {
  const actions: string[] = []
  await mkdir(layout.dir, { recursive: true })
  const activePath = join(layout.dir, layout.active)
  const buildingPath = join(layout.dir, layout.building)
  const activeExists = existsSync(activePath)
  if (!existsSync(buildingPath)) return actions
  const discardShadow = async (): Promise<void> => {
    for (const suffix of ['', '-wal', '-shm']) {
      await rm(`${buildingPath}${suffix}`, { force: true })
    }
  }
  if (activeExists) {
    await discardShadow()
    actions.push(`discarded stale shadow index (a previous rebuild did not finish; the active index was never at risk)`)
  } else {
    const archives = await listArchives(layout)
    if (archives.length > 0) {
      const newest = archives[archives.length - 1]
      await rename(join(layout.dir, newest), activePath)
      actions.push(`active index was missing (crash during the swap window); restored "${newest}" as the active index`)
    } else {
      actions.push('no active index and no archive: the first build crashed mid-way; starting from a fresh index')
    }
    await discardShadow()
  }
  for (const action of actions) log?.(`index recovery: ${action}`)
  return actions
}

/** List existing archive files, oldest first. */
export async function listArchives(layout: SwitchIndexLayout): Promise<string[]> {
  if (!existsSync(layout.dir)) return []
  const entries = await readdir(layout.dir)
  return entries.filter(name => name.startsWith(layout.archivePrefix) && name.endsWith('.sqlite')).sort()
}

/**
 * Build a fresh index into the shadow file, then swap it in atomically.
 *
 * During the build the caller's active engine stays open and queryable; only
 * the final swap briefly reopens the handle.
 * @param activeEngine - the currently-serving engine (its file is replaced).
 * @param layout - filesystem layout of the index directory.
 * @param sessionQuery - corpus reader for the full rebuild.
 * @param keepArchives - how many archive files to retain (oldest pruned).
 * @param onProgress - optional progress callback after each session.
 * @returns the rebuild state snapshot after completion.
 */
/** Optional observability callbacks for rebuildIndex. */
export interface SwitchRebuildHooks {
  /** Progress log line sink (cordis logger bridge). */
  log?: (msg: string) => void
  /** State-mutation sink: called after every change so index-status sees
   * live progress (the "0/?" bug was state cloned only at completion). */
  onState?: (state: SwitchRebuildState) => void
  /**
   * 文件级兜底读取器（与同步器同语义）：readSession 对归档/服务面退化会话
   * 失败时改读转录文件；返回 undefined 表示文件也不可用（记失败）。
   */
  readSessionFromFile?: (sessionId: string) => Promise<{
    session: { id: string; version: number; createdAt?: number; cwd?: string }
    events: readonly SwitchRawEvent[]
  } | undefined>
}

/** Sessions per batched transaction (one fsync checkpoint per chunk). */
const REBUILD_CHUNK = 50

/**
 * 主文件旁的 WAL sidecar（`-wal`/`-shm`）随主文件一并迁走；无目的地时
 * （孤儿残留）直接 force rm。rename 失败降级删除——sidecar 清理永远不能
 * 阻断 swap 本身。
 */
async function moveOrDeleteSidecars(basePath: string, destBasePath: string | null): Promise<void> {
  for (const suffix of ['-wal', '-shm']) {
    const src = basePath + suffix
    if (!existsSync(src)) continue
    if (destBasePath !== null) {
      try {
        await rename(src, destBasePath + suffix)
        continue
      } catch { /* 降级删除 */ }
    }
    await rm(src, { force: true }).catch(() => {})
  }
}

/**
 * The swap window: synchronous renames only; queries fail only inside it.
 *
 * issue #1 评论的损坏根因：只搬主文件时,旧库残留的 -wal/-shm 会被同名顶替
 * 的新库当自己的 WAL 重放,页号错配 → malformed。因此 sidecar 必须随主文件
 * 一并迁 archive（干净 close 本会 checkpoint 自删,这里是异常关闭的兜底）。
 * swap 后跑 integrity_check：非 ok 则把损坏库改名 .corrupt、从刚落的 archive
 * 回滚重开,并抛错让调用方置 error（把「索引损坏」降级为「回到上次快照」）。
 * 导出供测试直接驱动 swap 窗口（多连接场景在 Windows 上 rename 必 EBUSY,
 * 无法经 rebuildIndex 全链路确定性复现）。
 */
export async function swapShadowIntoActive(
  activeEngine: SwitchIndexEngine,
  layout: SwitchIndexLayout,
  log?: (msg: string) => void,
): Promise<void> {
  const activePath = join(layout.dir, layout.active)
  const buildingPath = join(layout.dir, layout.building)
  let archivePath: string | null = null
  if (existsSync(activePath)) {
    activeEngine.close()
    archivePath = join(layout.dir, `${layout.archivePrefix}${Date.now()}.sqlite`)
    await rename(activePath, archivePath)
    await moveOrDeleteSidecars(activePath, archivePath)
  } else {
    // 主文件不在但 sidecar 残留（崩溃窗口）：新库开在孤儿 WAL 上同样错配。
    await moveOrDeleteSidecars(activePath, null)
  }
  await rename(buildingPath, activePath)
  await activeEngine.open()
  const integrity = activeEngine.integrityCheck()
  if (integrity === 'ok') return
  log?.(`post-swap integrity FAILED (${integrity}); rolling back to the newest archive`)
  activeEngine.close()
  const corruptBase = join(layout.dir, `index.corrupt-${Date.now()}.sqlite`)
  try {
    await rename(activePath, corruptBase)
    await moveOrDeleteSidecars(activePath, corruptBase)
    if (archivePath !== null) {
      await rename(archivePath, activePath)
      for (const suffix of ['-wal', '-shm']) {
        if (existsSync(archivePath + suffix)) await rename(archivePath + suffix, activePath + suffix).catch(() => {})
      }
      await activeEngine.open()
    }
  } catch (rollbackErr) {
    log?.(`swap rollback itself failed: ${String(rollbackErr instanceof Error ? rollbackErr.message : rollbackErr)}`)
  }
  throw new Error(`switch-search: post-swap integrity check failed: ${integrity}`)
}

export async function rebuildIndex(
  activeEngine: SwitchIndexEngine,
  layout: SwitchIndexLayout,
  sessionQuery: SwitchRebuildSessionQuery,
  keepArchives: number,
  onProgress?: (done: number, total: number) => void,
  archiveSource?: () => SwitchArchiveSource | undefined,
  hooks?: SwitchRebuildHooks,
): Promise<SwitchRebuildState> {
  const startedMs = Date.now()
  let docsWritten = 0
  const emit = (): void => { hooks?.onState?.({ ...state }) }
  const rate = (): string => {
    const secs = Math.max(0.001, (Date.now() - startedMs) / 1000)
    return `${(state.done / secs).toFixed(1)} sess/s`
  }
  const eta = (): string => {
    if (state.total <= 0 || state.done === 0) return '?'
    const secs = (Date.now() - startedMs) / 1000
    return `${Math.max(0, Math.round((state.total - state.done) / (state.done / secs)))}s`
  }
  const state: SwitchRebuildState = {
    state: 'building',
    done: 0,
    total: 0,
    startedAt: Date.now(),
    finishedAt: 0,
    failures: [],
  }
  try {
    hooks?.log?.(`rebuild started: dir=${layout.dir} keep=${keepArchives}`)
    emit()
    await mkdir(layout.dir, { recursive: true })
    const buildingPath = join(layout.dir, layout.building)
    // A stale shadow from a crashed run is discarded.
    if (existsSync(buildingPath)) await unlink(buildingPath)
    const shadow = new SwitchIndexEngine({ path: buildingPath })
    await shadow.open()
    try {
      const records = await sessionQuery.listSessions()
      state.total = records.length
      hooks?.log?.(`rebuild corpus listed: ${state.total} sessions (archived included, full content)`)
      emit()
      // R1 合表语义：归档会话**同样全量读内容**入影子索引（readSession 对归档是
      // replay-validate 不激活）；构建完成后按官方归档集合统一翻 flag。
      const archivedSet = new Set(archiveSource?.()?.archivedSessionIds ?? [])
      const readLog = async (header: { id: string; version: number; createdAt?: number; cwd?: string }) => {
        let log: { session: { id: string; version: number; createdAt?: number; cwd?: string }; events: readonly SwitchRawEvent[] }
        try {
          log = await sessionQuery.readSession(header.id)
        } catch (serviceError) {
          if (hooks?.readSessionFromFile === undefined) throw serviceError
          const fromFile = await hooks.readSessionFromFile(header.id)
          if (fromFile === undefined) throw serviceError
          log = fromFile
        }
        return {
          sessionId: header.id,
          version: log.session.version,
          // 标题基础层随重建落行(beta.5 教训:重建不抽标题 + 版本对齐后同步
          // 永不重读 = 全库标题永久空缺)。
          title: extractTitleFromEvents(log.events),
          cwd: log.session.cwd ?? '',
          updatedAt: log.session.createdAt ?? 0,
          archived: archivedSet.has(header.id),
          events: log.events,
        }
      }
      for (let i = 0; i < records.length; i += REBUILD_CHUNK) {
        const chunk = records.slice(i, i + REBUILD_CHUNK)
        const chunkStart = Date.now()
        const reads: Array<{ sessionId: string; version: number; cwd: string; updatedAt: number; archived: boolean; events: readonly SwitchRawEvent[] }> = []
        for (const record of chunk) {
          try {
            reads.push(await readLog(record.header))
          } catch (err) {
            state.failures.push({ sessionId: record.header.id, error: String(err instanceof Error ? err.message : err) })
          }
        }
        // One transaction per chunk = one checkpoint; a chunk-level failure
        // replays session-by-session to keep the bad session isolated.
        try {
          shadow.runBatched(() => {
            for (const item of reads) {
              shadow.upsertSession(item)
              docsWritten += item.events.length
            }
          })
        } catch (err) {
          hooks?.log?.(`rebuild chunk txn failed, replaying individually: ${String(err instanceof Error ? err.message : err)}`)
          for (const item of reads) {
            try { shadow.upsertSession(item); docsWritten += item.events.length }
            catch (e2) { state.failures.push({ sessionId: item.sessionId, error: String(e2 instanceof Error ? e2.message : e2) }) }
          }
        }
        state.done = Math.min(state.total, i + chunk.length)
        onProgress?.(state.done, state.total)
        emit()
        hooks?.log?.(`rebuild ${state.done}/${state.total} (${Math.round((state.done / Math.max(1, state.total)) * 100)}%) ${rate()} elapsed ${Math.round((Date.now() - startedMs) / 1000)}s eta ${eta()} chunk ${Date.now() - chunkStart}ms`)
      }
      // 归档标记统一翻转（upsertSession 不动已有行的 flag,此处是影子库的最终真值）。
      shadow.setArchived(archivedSet)
      shadow.close()
    } catch (error) {
      shadow.close()
      await unlink(buildingPath).catch(() => {})
      throw error
    }

    state.state = 'swapping'
    emit()
    hooks?.log?.(`rebuild shadow complete: ${state.done} sessions, ~${docsWritten} docs, ${state.failures.length} failures; swapping`)
    await swapShadowIntoActive(activeEngine, layout, hooks?.log)
    await pruneArchives(layout, keepArchives)
    state.finishedAt = Date.now()
    state.state = 'idle'
    emit()
    hooks?.log?.(`rebuild done: total ${((state.finishedAt - startedMs) / 1000).toFixed(1)}s, archives pruned to ${keepArchives}`)
  } catch (err) {
    state.state = 'error'
    state.error = String(err instanceof Error ? err.message : err)
    hooks?.log?.(`rebuild FAILED at done=${state.done}: ${state.error}`)
    emit()
    // Leave the active engine usable if the swap itself failed before rename.
    if (!activeEngine.isOpen) await activeEngine.open().catch(() => {})
  }
  return state
}

/** One doc-level record the snapshot importer feeds in. */
export interface SwitchImportRecord {
  sessionId: string
  version: number
  title?: string
  /** 归档标记（旧快照缺省活跃）。 */
  archived?: boolean
  docs: readonly { seq: number; type: string; surface: string; time: number; text: string }[]
}

/** Import doc-level records into the shadow file and swap it in (same swap path).
 * @param log - 可选日志汇（空 docs 记录告警,issue #1 写入侧可观测）。 */
export async function importIntoIndex(
  activeEngine: SwitchIndexEngine,
  layout: SwitchIndexLayout,
  records: readonly SwitchImportRecord[],
  keepArchives: number,
  log?: (msg: string) => void,
): Promise<SwitchRebuildState> {
  const state: SwitchRebuildState = {
    state: 'building',
    done: 0,
    total: records.length,
    startedAt: Date.now(),
    finishedAt: 0,
    failures: [],
  }
  try {
    await mkdir(layout.dir, { recursive: true })
    const buildingPath = join(layout.dir, layout.building)
    if (existsSync(buildingPath)) await unlink(buildingPath)
    const shadow = new SwitchIndexEngine({ path: buildingPath })
    await shadow.open()
    try {
      for (const record of records) {
        try {
          if (record.docs.length === 0) {
            // 快照往返空正文是合法输入,不硬拒；修复后这样的行下一轮 poll 即补录。
            log?.(`snapshot import: session ${record.sessionId} has zero docs (hollow header, sync will backfill)`)
          }
          shadow.importSessionDocs({
            sessionId: record.sessionId,
            version: record.version,
            title: record.title ?? '',
            archived: record.archived === true,
            docs: record.docs,
          })
        } catch (err) {
          state.failures.push({ sessionId: record.sessionId, error: String(err instanceof Error ? err.message : err) })
        }
        state.done += 1
      }
      shadow.close()
    } catch (error) {
      shadow.close()
      await unlink(buildingPath).catch(() => {})
      throw error
    }
    state.state = 'swapping'
    await swapShadowIntoActive(activeEngine, layout, log)
    await pruneArchives(layout, keepArchives)
    state.finishedAt = Date.now()
    state.state = 'idle'
  } catch (err) {
    state.state = 'error'
    state.error = String(err instanceof Error ? err.message : err)
    if (!activeEngine.isOpen) await activeEngine.open().catch(() => {})
  }
  return state
}

/** Remove the oldest archives beyond the retention bound (sidecars too). */
async function pruneArchives(layout: SwitchIndexLayout, keep: number): Promise<void> {
  const archives = await listArchives(layout)
  const excess = archives.length - Math.max(0, keep)
  for (let i = 0; i < excess; i += 1) {
    await unlink(join(layout.dir, archives[i])).catch(() => {})
    await moveOrDeleteSidecars(join(layout.dir, archives[i]), null)
  }
}

/**
 * Resolve the index directory that hosts the independent index files:
 * an explicit override wins, otherwise a plugin-owned directory under the
 * user's home (never the official index path).
 */
export function resolveIndexDir(preferred?: string): string {
  if (preferred !== undefined && preferred.trim() !== '') return preferred
  return join(homedir(), '.dsh-switch-search')
}
