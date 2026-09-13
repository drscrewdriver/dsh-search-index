/**
 * Watermark-driven incremental sync between the live-preferred sessionQuery
 * corpus and the independent switch-search index.
 *
 * One pass lists the logical corpus, diffs stored `version` watermarks, and
 * re-reads only new or changed sessions. Per-session failures are isolated and
 * reported; one broken log never stalls the whole sync.
 */
import type { SwitchIndexEngine } from './engine.ts'
import type { SwitchRawEvent } from './extract.ts'

/** The sessionQuery faces the sync reads (structural mirrors). */
export interface SwitchSyncSessionQuery {
  listSessions(): Promise<readonly { header: { id: string; version: number; createdAt?: number; cwd?: string } }[]>
  readSession(sessionId: string): Promise<{
    session: { id: string; version: number; createdAt?: number; cwd?: string }
    events: readonly SwitchRawEvent[]
  }>
  readTitleSnapshots?(sessionIds: readonly string[]): Promise<readonly {
    status: 'fulfilled' | 'rejected'
    value?: { session: { id: string }; title?: { title: string } }
  }[]>
}

/** Live sync progress reported to the status endpoint. */
export interface SwitchSyncState {
  /** What the syncer is doing right now. */
  state: 'idle' | 'syncing' | 'error'
  /** Epoch ms of the last completed pass. */
  lastSyncAt: number
  /** Sessions currently in the index. */
  indexed: number
  /** Sessions seen in the corpus at the last pass. */
  total: number
  /** Sessions re-read in the last pass. */
  updated: number
  /** Per-session failures from the last pass. */
  failures: { sessionId: string; error: string }[]
  /** Last pass error (whole-pass abort), if any. */
  error?: string
}

/**
 * The official archive-set face (workspaceRegistry mirror): read-only.
 * Resolved lazily per pass — the registry may mount after this plugin.
 */
export interface SwitchArchiveSource {
  readonly archivedSessionIds: readonly string[]
}

/**
 * One watermark syncer bound to one open engine. `poll()` is re-entrant-safe:
 * overlapping calls collapse into the running pass.
 */
export class SwitchWatermarkSync {
  private running: Promise<SwitchSyncState> | undefined
  private readonly state: SwitchSyncState = {
    state: 'idle',
    lastSyncAt: 0,
    indexed: 0,
    total: 0,
    updated: 0,
    failures: [],
  }

  constructor(
    private readonly engine: SwitchIndexEngine,
    private readonly sessionQuery: SwitchSyncSessionQuery,
    private readonly readArchiveSource?: () => SwitchArchiveSource | undefined,
    private readonly log?: (msg: string) => void,
  ) {

  }

  /** Current progress snapshot (cloned). */
  snapshot(): SwitchSyncState {
    return { ...this.state, failures: [...this.state.failures] }
  }

  /**
   * Run one incremental pass (or await the running one).
   * @returns the state after the pass completes.
   */
  poll(): Promise<SwitchSyncState> {
    if (this.running !== undefined) return this.running
    this.running = this.runPass().finally(() => {
      this.running = undefined
    })
    return this.running
  }

  private async runPass(): Promise<SwitchSyncState> {
    this.state.state = 'syncing'
    const passStart = Date.now()
    try {
      const records = await this.sessionQuery.listSessions()
      this.state.total = records.length
      // The official archive set first: flag flips are soft deletes (docs
      // dropped, header kept) and un-archives force a version reset so the
      // next diff re-ingests the full content. Registry absent -> no-op.
      const archiveSource = this.readArchiveSource?.()
      const archivedSet = new Set(archiveSource?.archivedSessionIds ?? [])
      this.engine.setArchived(archivedSet)
      const archivedSetSize = archivedSet.size
      const failures: { sessionId: string; error: string }[] = []
      let updated = 0
      const changedIds: string[] = []
      for (const record of records) {
        const header = record.header
        const existing = this.engine.getSession(header.id)
        if (archivedSet.has(header.id)) {
          // Header-only ingest (no docs): the title cache carries over.
          if (existing !== undefined && existing.archived && existing.version === header.version) continue
          this.engine.upsertArchivedHeader({
            sessionId: header.id,
            version: header.version,
            cwd: header.cwd ?? '',
            updatedAt: header.createdAt ?? 0,
            title: existing?.title ?? '',
          })
          updated += 1
          continue
        }
        if (existing !== undefined && existing.version === header.version) continue
        changedIds.push(header.id)
        try {
          const log = await this.sessionQuery.readSession(header.id)
          this.engine.upsertSession({
            sessionId: header.id,
            version: log.session.version,
            cwd: log.session.cwd ?? '',
            updatedAt: log.session.createdAt ?? 0,
            events: log.events,
          })
          updated += 1
        } catch (err) {
          failures.push({ sessionId: header.id, error: String(err instanceof Error ? err.message : err) })
        }
      }
      // Drop sessions that vanished from the corpus.
      const corpusIds = new Set(records.map(record => record.header.id))
      for (const indexed of this.engine.listIndexedSessions()) {
        if (!corpusIds.has(indexed.sessionId)) this.engine.removeSession(indexed.sessionId)
      }
      await this.backfillTitles(changedIds)
      await this.backfillArchivedTitles()
      this.state.updated = updated
      this.state.failures = failures
      this.state.indexed = this.engine.countSessions()
      this.state.lastSyncAt = Date.now()
      this.state.state = 'idle'
      this.state.error = undefined
      this.log?.(`sync pass: scanned=${this.state.total} updated=${updated} skipped-archived=${String(archivedSetSize)} failures=${failures.length} indexed=${this.state.indexed} duration=${Date.now() - passStart}ms driver=${this.engine.driverLabel}`)
    } catch (err) {
      this.state.state = 'error'
      this.state.error = String(err instanceof Error ? err.message : err)
      this.log?.(`sync pass FAILED: ${this.state.error}`)
    }
    return this.snapshot()
  }

  /**
   * Fold titles for archived header-only rows that never got one (archived
   * before first indexing). Bounded: only rows with an empty title, and the
   * title fold reads the log without ingesting content.
   */
  private async backfillArchivedTitles(): Promise<void> {
    const readTitles = this.sessionQuery.readTitleSnapshots
    if (readTitles === undefined) return
    const missing = this.engine.listArchived().filter(session => session.title.trim() === '')
    if (missing.length === 0) return
    try {
      const observations = await readTitles(missing.map(session => session.sessionId))
      for (const observation of observations) {
        if (observation.status !== 'fulfilled' || observation.value === undefined) continue
        const title = observation.value.title?.title
        if (typeof title === 'string' && title.trim().length > 0) {
          this.engine.updateSessionHeader({ sessionId: observation.value.session.id, title })
        }
      }
      this.log?.(`archived title backfill: ${missing.length} rows processed`)
    } catch (err) {
      this.log?.(`archived title backfill failed: ${String(err instanceof Error ? err.message : err)}`)
    }
  }

  /** Fold latest titles for changed sessions into the index header rows. */
  private async backfillTitles(sessionIds: readonly string[]): Promise<void> {
    const readTitles = this.sessionQuery.readTitleSnapshots
    if (readTitles === undefined || sessionIds.length === 0) return
    try {
      const observations = await readTitles([...new Set(sessionIds)])
      for (const observation of observations) {
        if (observation.status !== 'fulfilled' || observation.value === undefined) continue
        const title = observation.value.title?.title
        const row = this.engine.getSession(observation.value.session.id)
        if (row?.archived === true) continue
        if (typeof title === 'string' && title.trim().length > 0) {
          this.engine.updateSessionHeader({ sessionId: observation.value.session.id, title })
        }
      }
    } catch {
      // Title backfill is cosmetic; index rows keep their previous titles.
    }
  }
}
