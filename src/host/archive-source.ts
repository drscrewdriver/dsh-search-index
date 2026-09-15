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
 *
 * READ-ONLY by contract. The archive set is WRITTEN by dsh-session-steward
 * (会话管家 → 病案室); this package only consumes it to keep archived sessions
 * out of the index. Format contract: `dsh-归档文件格式契约-20260914.md`.
 */
import { existsSync, readFileSync } from 'node:fs'
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
