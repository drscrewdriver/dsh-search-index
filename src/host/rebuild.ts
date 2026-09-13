/**
 * Non-destructive index rebuild ("整理索引") for the independent index.
 *
 * A shadow index file is built from scratch beside the active one; the active
 * engine keeps serving queries the whole time. When the shadow is complete the
 * swap is three synchronous renames (active → archive, shadow → active), then
 * the engine reopens. Old archives are kept (bounded) and stay readable.
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SwitchIndexEngine } from './engine.ts'
import type { SwitchRawEvent } from './extract.ts'
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
}

/** Sessions per batched transaction (one fsync checkpoint per chunk). */
const REBUILD_CHUNK = 50

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
      hooks?.log?.(`rebuild corpus listed: ${state.total} sessions; archived copy skips content`)
      emit()
      // Archived sessions copy as header-only rows: the soft-deleted flag is
      // rebuilt from the official archive set, no docs, no FTS entries.
      const archivedSet = new Set(archiveSource?.()?.archivedSessionIds ?? [])
      const readLog = async (header: { id: string; version: number; createdAt?: number; cwd?: string }) => {
        const log = await sessionQuery.readSession(header.id)
        return { sessionId: header.id, version: log.session.version, cwd: log.session.cwd ?? '', updatedAt: log.session.createdAt ?? 0, events: log.events }
      }
      for (let i = 0; i < records.length; i += REBUILD_CHUNK) {
        const chunk = records.slice(i, i + REBUILD_CHUNK)
        const chunkStart = Date.now()
        const reads: Array<{ sessionId: string; version: number; cwd: string; updatedAt: number; events: readonly SwitchRawEvent[] }> = []
        for (const record of chunk) {
          const header = record.header
          if (archivedSet.has(header.id)) continue
          try {
            reads.push(await readLog(header))
          } catch (err) {
            state.failures.push({ sessionId: header.id, error: String(err instanceof Error ? err.message : err) })
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
            for (const record of chunk) {
              const header = record.header
              if (archivedSet.has(header.id)) shadow.upsertArchivedHeader({
                sessionId: header.id, version: header.version,
                cwd: header.cwd ?? '', updatedAt: header.createdAt ?? 0,
              })
            }
          })
        } catch (err) {
          hooks?.log?.(`rebuild chunk txn failed, replaying individually: ${String(err instanceof Error ? err.message : err)}`)
          for (const item of reads) {
            try { shadow.upsertSession(item); docsWritten += item.events.length }
            catch (e2) { state.failures.push({ sessionId: item.sessionId, error: String(e2 instanceof Error ? e2.message : e2) }) }
          }
          for (const record of chunk) {
            const header = record.header
            if (archivedSet.has(header.id)) {
              try {
                shadow.upsertArchivedHeader({ sessionId: header.id, version: header.version, cwd: header.cwd ?? '', updatedAt: header.createdAt ?? 0 })
              } catch { /* header rows are best-effort */ }
            }
          }
        }
        state.done = Math.min(state.total, i + chunk.length)
        onProgress?.(state.done, state.total)
        emit()
        hooks?.log?.(`rebuild ${state.done}/${state.total} (${Math.round((state.done / Math.max(1, state.total)) * 100)}%) ${rate()} elapsed ${Math.round((Date.now() - startedMs) / 1000)}s eta ${eta()} chunk ${Date.now() - chunkStart}ms`)
      }
      shadow.close()
    } catch (error) {
      shadow.close()
      await unlink(buildingPath).catch(() => {})
      throw error
    }

    state.state = 'swapping'
    emit()
    hooks?.log?.(`rebuild shadow complete: ${state.done} sessions, ~${docsWritten} docs, ${state.failures.length} failures; swapping`)
    // The swap window is three synchronous renames; queries fail only inside it.
    const activePath = join(layout.dir, layout.active)
    if (existsSync(activePath)) {
      activeEngine.close()
      await rename(activePath, join(layout.dir, `${layout.archivePrefix}${Date.now()}.sqlite`))
    }
    await rename(buildingPath, activePath)
    await activeEngine.open()
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
  docs: readonly { seq: number; type: string; surface: string; time: number; text: string }[]
}

/** Import doc-level records into the shadow file and swap it in (same swap path). */
export async function importIntoIndex(
  activeEngine: SwitchIndexEngine,
  layout: SwitchIndexLayout,
  records: readonly SwitchImportRecord[],
  keepArchives: number,
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
          shadow.importSessionDocs({
            sessionId: record.sessionId,
            version: record.version,
            title: record.title ?? '',
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
    const activePath = join(layout.dir, layout.active)
    if (existsSync(activePath)) {
      activeEngine.close()
      await rename(activePath, join(layout.dir, `${layout.archivePrefix}${Date.now()}.sqlite`))
    }
    await rename(buildingPath, activePath)
    await activeEngine.open()
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

/** Remove the oldest archives beyond the retention bound. */
async function pruneArchives(layout: SwitchIndexLayout, keep: number): Promise<void> {
  const archives = await listArchives(layout)
  const excess = archives.length - Math.max(0, keep)
  for (let i = 0; i < excess; i += 1) {
    await unlink(join(layout.dir, archives[i])).catch(() => {})
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
