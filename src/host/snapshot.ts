/**
 * JSON Lines snapshot migration for the independent switch-search index.
 *
 * The snapshot is the "translation" seam: one JSON object per line, carrying a
 * session's indexed documents in a self-contained shape. Export writes the
 * active index out; import parses the lines and rebuilds them into a fresh
 * shadow index that swaps in atomically (same swap path as 整理).
 */
import type { SwitchIndexEngine } from './engine.ts'
import type { SwitchImportRecord } from './rebuild.ts'

/** Snapshot format header line. */
export interface SwitchSnapshotHeader {
  v: 1
  kind: 'dsh-switch-search-snapshot'
  exportedAt: number
}

/** One snapshot line: a session and its indexed documents. */
export interface SwitchSnapshotRecord {
  v: 1
  sessionId: string
  version: number
  title: string
  docs: {
    seq: number
    type: string
    surface: string
    time: number
    text: string
  }[]
}

/** Render the snapshot header line. */
export function snapshotHeader(): string {
  return JSON.stringify({
    v: 1,
    kind: 'dsh-switch-search-snapshot',
    exportedAt: Date.now(),
  } satisfies SwitchSnapshotHeader)
}

/**
 * Export the whole active index as a JSON Lines string.
 * @param engine - the open active engine.
 * @returns the complete snapshot text (header line first).
 */
export function exportSnapshot(engine: SwitchIndexEngine): string {
  const lines: string[] = [snapshotHeader()]
  for (const session of engine.listIndexedSessions()) {
    lines.push(JSON.stringify({
      v: 1,
      sessionId: session.sessionId,
      version: session.version,
      title: session.title,
      docs: engine.exportSessionDocs(session.sessionId),
    } satisfies SwitchSnapshotRecord))
  }
  return `${lines.join('\n')}\n`
}

/** One parsed snapshot: importable records plus skipped-line count. */
export interface SwitchParsedSnapshot {
  records: SwitchImportRecord[]
  skipped: number
}

/**
 * Parse a snapshot's JSON Lines text into importable records.
 * The header line and any malformed line are skipped, not fatal.
 * @param text - raw snapshot text.
 * @returns importable records and how many lines were skipped.
 */
export function parseSnapshot(text: string): SwitchParsedSnapshot {
  const records: SwitchImportRecord[] = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue
    let value: unknown
    try {
      value = JSON.parse(line)
    } catch {
      skipped += 1
      continue
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      skipped += 1
      continue
    }
    const record = value as Record<string, unknown>
    // The snapshot header line is recognized and skipped silently.
    if (record['kind'] === 'dsh-switch-search-snapshot') continue
    const sessionId = record['sessionId']
    const rawDocs = record['docs']
    if (typeof sessionId !== 'string' || sessionId === '' || !Array.isArray(rawDocs)) {
      skipped += 1
      continue
    }
    const docs: { seq: number; type: string; surface: string; time: number; text: string }[] = []
    let docsValid = true
    for (const rawDoc of rawDocs) {
      if (typeof rawDoc !== 'object' || rawDoc === null
        || typeof (rawDoc as { seq?: unknown }).seq !== 'number'
        || typeof (rawDoc as { type?: unknown }).type !== 'string'
        || typeof (rawDoc as { text?: unknown }).text !== 'string') {
        docsValid = false
        break
      }
      const doc = rawDoc as { seq: number; type: string; surface?: unknown; time?: unknown; text: string }
      docs.push({
        seq: doc.seq,
        type: doc.type,
        surface: typeof doc.surface === 'string' ? doc.surface : 'current',
        time: typeof doc.time === 'number' ? doc.time : 0,
        text: doc.text,
      })
    }
    if (!docsValid) {
      skipped += 1
      continue
    }
    records.push({
      sessionId,
      version: typeof record['version'] === 'number' ? record['version'] : 0,
      title: typeof record['title'] === 'string' ? record['title'] : undefined,
      docs,
    })
  }
  return { records, skipped }
}
