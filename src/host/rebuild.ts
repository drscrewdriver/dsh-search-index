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
export async function rebuildIndex(
  activeEngine: SwitchIndexEngine,
  layout: SwitchIndexLayout,
  sessionQuery: SwitchRebuildSessionQuery,
  keepArchives: number,
  onProgress?: (done: number, total: number) => void,
): Promise<SwitchRebuildState> {
  const state: SwitchRebuildState = {
    state: 'building',
    done: 0,
    total: 0,
    startedAt: Date.now(),
    finishedAt: 0,
    failures: [],
  }
  try {
    await mkdir(layout.dir, { recursive: true })
    const buildingPath = join(layout.dir, layout.building)
    // A stale shadow from a crashed run is discarded.
    if (existsSync(buildingPath)) await unlink(buildingPath)
    const shadow = new SwitchIndexEngine({ path: buildingPath })
    await shadow.open()
    try {
      const records = await sessionQuery.listSessions()
      state.total = records.length
      for (const record of records) {
        const header = record.header
        try {
          const log = await sessionQuery.readSession(header.id)
          shadow.upsertSession({
            sessionId: header.id,
            version: log.session.version,
            cwd: log.session.cwd ?? '',
            updatedAt: log.session.createdAt ?? 0,
            events: log.events,
          })
        } catch (err) {
          state.failures.push({ sessionId: header.id, error: String(err instanceof Error ? err.message : err) })
        }
        state.done += 1
        onProgress?.(state.done, state.total)
      }
      shadow.close()
    } catch (error) {
      shadow.close()
      await unlink(buildingPath).catch(() => {})
      throw error
    }

    state.state = 'swapping'
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
  } catch (err) {
    state.state = 'error'
    state.error = String(err instanceof Error ? err.message : err)
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
