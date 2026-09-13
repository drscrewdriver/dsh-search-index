/**
 * Official archive-set source resolution.
 *
 * Primary: the in-process `workspaceRegistry` service (the same fact the UI
 * filters by). Fallback: read the canonical storage hub file directly — the
 * workspace domain persists `archivedSessionIds` under the `global` segment
 * (storage-json: `~/.dsh/storages/workspace.json`; storage-sqlite variant
 * exists but the JSON fallback file is what stock web profiles ship).
 * Resolution order is decided per read; failures degrade to "no archive set"
 * and are reported through the diagnostics face.
 */
import { copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** One resolved archive read: ids plus which source served them. */
export interface SwitchArchiveRead {
  ids: readonly string[]
  source: 'registry' | 'storage-file' | 'none'
}

/** The workspaceRegistry mirror face (getter only). */
export interface SwitchRegistryFace {
  readonly archivedSessionIds: readonly string[]
}

/** Diagnostics describing how the archive set is being resolved. */
export interface SwitchArchiveDiagnostics {
  source: 'registry' | 'storage-file' | 'none'
  ids: number
  error?: string
}

/** DSH storage hub candidates for the workspace domain (json backend). */
function storageFileCandidates(): string[] {
  return [
    join(homedir(), '.dsh', 'storages', 'workspace.json'),
  ]
}

/** Parse the storage hub file's global.archivedSessionIds; throw on malformed content. */
function readStorageFile(path: string): readonly string[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
    global?: { archivedSessionIds?: unknown }
  }
  const ids = parsed.global?.archivedSessionIds
  if (!Array.isArray(ids)) throw new Error(`storage hub "${path}" holds no global.archivedSessionIds array`)
  return ids.filter((id): id is string => typeof id === 'string')
}

/**
 * Resolve the official archive set once.
 * @param registry - lazy workspaceRegistry face (may be absent or throw).
 * @returns the archive ids plus which source served them.
 */
export function readArchiveSet(registry?: SwitchRegistryFace): SwitchArchiveRead {
  if (registry !== undefined) {
    try {
      const ids = registry.archivedSessionIds
      if (Array.isArray(ids)) return { ids, source: 'registry' }
    } catch { /* registry not started yet — fall through to the file */ }
  }
  for (const path of storageFileCandidates()) {
    if (!existsSync(path)) continue
    try {
      return { ids: readStorageFile(path), source: 'storage-file' }
    } catch { /* malformed file — try the next candidate */ }
  }
  return { ids: [], source: 'none' }
}

/**
 * Remove session ids from the storage hub's global.archivedSessionIds.
 *
 * The official backend exposes no unarchive endpoint, so the canonical file
 * is edited directly, following storage-json's own protocol: backup, atomic
 * same-directory temp write, rename. The running host keeps the set in
 * memory and only reloads it at boot — the caller must surface that a DSH
 * restart is required. Our own index un-flags immediately so the next
 * watermark pass re-ingests any session whose log still exists.
 * @param ids - session ids to remove from the archive array.
 * @param log - optional log sink.
 * @returns how many ids were actually removed and the remaining count.
 */
export function pruneArchiveFile(
  ids: readonly string[],
  log?: (msg: string) => void,
  searchPaths?: readonly string[],
): {
  removed: number
  remaining: number
  file?: string
} {
  const wanted = new Set(ids)
  for (const path of searchPaths ?? storageFileCandidates()) {
    if (!existsSync(path)) continue
    let document: { global?: { archivedSessionIds?: unknown }; [key: string]: unknown }
    try {
      document = JSON.parse(readFileSync(path, 'utf8')) as typeof document
    } catch (err) {
      log?.(`archive prune: cannot parse "${path}": ${String(err instanceof Error ? err.message : err)}`)
      continue
    }
    const current = document.global?.archivedSessionIds
    if (!Array.isArray(current)) {
      log?.(`archive prune: "${path}" holds no global.archivedSessionIds array`)
      continue
    }
    const kept = current.filter((id): id is string => typeof id === 'string' && !wanted.has(id))
    const removed = current.length - kept.length
    if (removed === 0) return { removed: 0, remaining: current.length, file: path }
    // Backup beside the file, then atomic replace (tmp + rename), matching
    // the storage-json publish protocol and its 2-space serialization.
    const backup = `${path}.bak-${Date.now()}`
    copyFileSync(path, backup)
    const next = { ...document, global: { ...document.global, archivedSessionIds: kept } }
    const tmp = `${path}.prune-tmp`
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}
`, 'utf8')
    renameSync(tmp, path)
    log?.(`archive prune: removed ${removed} of ${current.length} ids; backup=${backup}`)
    return { removed, remaining: kept.length, file: path }
  }
  throw new Error('workspace storage file not found (searched ~/.dsh/storages/workspace.json)')
}

/** Build the lazy source face the syncer expects, with diagnostics capture. */
export function createArchiveSource(getRegistry: () => SwitchRegistryFace | undefined): {
  read: () => SwitchArchiveRead
  diagnostics: () => SwitchArchiveDiagnostics
} {
  let last: SwitchArchiveDiagnostics = { source: 'none', ids: 0 }
  return {
    read: () => {
      const read = readArchiveSet(getRegistry())
      last = { source: read.source, ids: read.ids.length }
      return read
    },
    diagnostics: () => ({ ...last }),
  }
}
