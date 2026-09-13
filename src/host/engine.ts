/**
 * The independent switch-search retrieval engine.
 *
 * Owns one node:sqlite handle (the plugin's own file, never the official
 * session-query index), ingests complete session logs, and answers
 * session-grouped full-text queries with the strongest per-session hit.
 *
 * Search pipeline: text is word-segmented with Intl.Segmenter and stored in
 * the docs.index_text column; an external-content FTS5 (unicode61) virtual
 * table builds its inverted index from that column without duplicating text
 * storage. Queries run through the same segmentation, so CJK matches on word
 * boundaries with a trailing-token prefix for partial input.
 */
import type { DatabaseSync } from 'node:sqlite'
import { openIndexDatabase } from './schema.ts'
import { buildIndexDocuments, segmentForIndex, segmentQueryTerm, type SwitchRawEvent } from './extract.ts'

/** One indexed session header row. */
export interface SwitchIndexedSession {
  sessionId: string
  version: number
  title: string
  cwd: string
  updatedAt: number
  indexedAt: number
}

/** One session-grouped search hit. */
export interface SwitchSearchHit {
  sessionId: string
  title: string
  seq: number
  type: string
  time: number
  snippet: string
}

/** Coarse type-filter buckets mapped onto raw session event types. */
export type SwitchIndexContentType = 'all' | 'user' | 'reply' | 'tool'

/** Coarse filter → raw event types. */
const CONTENT_TYPE_GROUPS: Readonly<Record<Exclude<SwitchIndexContentType, 'all'>, readonly string[]>> = {
  user: ['user/message'],
  reply: ['assistant/message'],
  tool: ['tool/call', 'tool/result'],
}

/** Search weight per event type (message content outranks tool chatter). */
const TYPE_WEIGHT: Readonly<Record<string, number>> = {
  'user/message': 3,
  'assistant/message': 3,
  'tool/call': 1,
  'tool/result': 1,
}

/** Maximum snippet length in characters, aligned with the official route. */
const SNIPPET_CHARS = 240

/** Maximum FTS matches inspected per query before session grouping. */
const MATCH_SCAN_LIMIT = 5000

/**
 * Sanitize free text into a safe FTS5 query over the segmented index: each
 * whitespace term is segmented into word tokens, quoted as an adjacent
 * phrase, and the last token carries a prefix `*` so partial input matches
 * ("正在搜" hits 正在搜索). Terms AND together.
 */
export function sanitizeFtsQuery(query: string): string {
  const terms = query.split(/\s+/u).filter(Boolean)
  if (terms.length === 0) return ''
  const phrases: string[] = []
  for (const term of terms) {
    const words = segmentQueryTerm(term)
      .map(word => word.replace(/"/g, '""'))
      .filter(word => word !== '')
    if (words.length === 0) continue
    phrases.push(`"${words.join(' ')}"*`)
  }
  return phrases.join(' ')
}

/** Build a snippet around the first term occurrence, official-route aligned. */
export function buildSnippet(text: string, query: string, max = SNIPPET_CHARS): string {
  const flat = text.replace(/\s+/gu, ' ').trim()
  if (flat.length <= max) return flat
  const lower = flat.toLowerCase()
  const terms = query.toLowerCase().split(/\s+/u).filter(Boolean)
  let anchor = -1
  for (const term of terms) {
    const at = lower.indexOf(term)
    if (at >= 0 && (anchor < 0 || at < anchor)) anchor = at
  }
  if (anchor < 0) return `${flat.slice(0, max)}…`
  const start = Math.max(0, anchor - Math.floor((max - 3) / 2))
  const end = Math.min(flat.length, start + max - 3)
  const head = start > 0 ? '…' : ''
  const tail = end < flat.length ? '…' : ''
  return `${head}${flat.slice(start, end)}${tail}`
}

/**
 * Run one function inside an IMMEDIATE transaction.
 * node:sqlite has no cursor-level begin helper; statements are executed raw.
 */
function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* rollback of a broken txn is best-effort */ }
    throw error
  }
}

/** Constructor options for one engine instance. */
export interface SwitchIndexEngineOptions {
  /** Absolute path of the index file this engine owns. */
  path: string
}

/** One open index handle. All mutating calls are synchronous; callers pace
 * them off the HTTP hot path (background sync / rebuild tasks). */
export class SwitchIndexEngine {
  private db: DatabaseSync | undefined

  constructor(private readonly options: SwitchIndexEngineOptions) {}

  /** Whether the handle is open. */
  get isOpen(): boolean {
    return this.db !== undefined
  }

  /** Open (creating or migrating) the index file. Idempotent. */
  async open(): Promise<void> {
    if (this.db !== undefined) return
    this.db = await openIndexDatabase(this.options.path)
  }

  /** Close the handle. Idempotent. */
  close(): void {
    this.db?.close()
    this.db = undefined
  }

  /** Remove one session's FTS entries for external-content bookkeeping. */
  private deleteSessionFts(db: DatabaseSync, sessionId: string): void {
    const existing = db.prepare('SELECT doc_id, index_text FROM docs WHERE session_id = ?')
      .all(sessionId) as { doc_id: number | bigint; index_text: string }[]
    const deleteFts = db.prepare(`
      INSERT INTO docs_fts(docs_fts, rowid, index_text) VALUES ('delete', ?, ?)
    `)
    for (const row of existing) deleteFts.run(Number(row.doc_id), row.index_text)
  }

  /** Insert or replace one session's documents and header row. */
  upsertSession(input: {
    sessionId: string
    version: number
    title?: string
    cwd?: string
    updatedAt?: number
    events: readonly SwitchRawEvent[]
  }): void {
    const db = this.requireDb()
    const documents = buildIndexDocuments(input.sessionId, input.events)
    withTransaction(db, () => {
      this.deleteSessionFts(db, input.sessionId)
      db.prepare('DELETE FROM docs WHERE session_id = ?').run(input.sessionId)
      const insertDoc = db.prepare(`
        INSERT INTO docs (session_id, seq, type, surface, time, text, index_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const insertFts = db.prepare('INSERT INTO docs_fts (rowid, index_text) VALUES (?, ?)')
      for (const doc of documents) {
        const indexText = segmentForIndex(doc.text)
        const result = insertDoc.run(
          doc.sessionId, doc.seq, doc.type, doc.surface, doc.time, doc.text, indexText,
        )
        insertFts.run(Number(result.lastInsertRowid), indexText)
      }
      db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at
      `).run(
        input.sessionId,
        input.version,
        input.title ?? '',
        input.cwd ?? '',
        input.updatedAt ?? 0,
        Date.now(),
      )
    })
  }

  /** One session's stored documents, ascending seq (snapshot export face). */
  exportSessionDocs(sessionId: string): {
    seq: number
    type: string
    surface: string
    time: number
    text: string
  }[] {
    const db = this.requireDb()
    return db.prepare(`
      SELECT seq, type, surface, time, text FROM docs WHERE session_id = ? ORDER BY seq
    `).all(sessionId) as { seq: number; type: string; surface: string; time: number; text: string }[]
  }

  /**
   * Insert or replace one session from already-extracted documents
   * (snapshot import face; no re-extraction, what was exported is restored;
   * segmentation is recomputed for the current index format).
   */
  importSessionDocs(input: {
    sessionId: string
    version: number
    title?: string
    docs: readonly { seq: number; type: string; surface: string; time: number; text: string }[]
  }): void {
    const db = this.requireDb()
    withTransaction(db, () => {
      this.deleteSessionFts(db, input.sessionId)
      db.prepare('DELETE FROM docs WHERE session_id = ?').run(input.sessionId)
      const insertDoc = db.prepare(`
        INSERT INTO docs (session_id, seq, type, surface, time, text, index_text)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const insertFts = db.prepare('INSERT INTO docs_fts (rowid, index_text) VALUES (?, ?)')
      for (const doc of input.docs) {
        const indexText = segmentForIndex(doc.text)
        const result = insertDoc.run(
          input.sessionId, doc.seq, doc.type, doc.surface, doc.time, doc.text, indexText,
        )
        insertFts.run(Number(result.lastInsertRowid), indexText)
      }
      db.prepare(`
        INSERT INTO sessions (session_id, version, title, updated_at, indexed_at)
        VALUES (?, ?, ?, 0, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = excluded.title,
          indexed_at = excluded.indexed_at
      `).run(input.sessionId, input.version, input.title ?? '', Date.now())
    })
  }

  /** Remove one session and its documents entirely. */
  removeSession(sessionId: string): void {
    const db = this.requireDb()
    withTransaction(db, () => {
      this.deleteSessionFts(db, sessionId)
      db.prepare('DELETE FROM docs WHERE session_id = ?').run(sessionId)
      db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId)
    })
  }

  /** Update only a session's header row (title backfill), keeping documents. */
  updateSessionHeader(input: { sessionId: string; title?: string; cwd?: string; updatedAt?: number }): void {
    const db = this.requireDb()
    const current = db.prepare('SELECT version FROM sessions WHERE session_id = ?').get(input.sessionId) as
      | { version: number }
      | undefined
    if (current === undefined) return
    db.prepare(`
      UPDATE sessions SET
        title = CASE WHEN ? != '' THEN ? ELSE title END,
        cwd = CASE WHEN ? != '' THEN ? ELSE cwd END,
        updated_at = CASE WHEN ? > 0 THEN ? ELSE updated_at END
      WHERE session_id = ?
    `).run(
      input.title ?? '', input.title ?? '',
      input.cwd ?? '', input.cwd ?? '',
      input.updatedAt ?? 0, input.updatedAt ?? 0,
      input.sessionId,
    )
  }

  /** One indexed session row, or undefined. */
  getSession(sessionId: string): SwitchIndexedSession | undefined {
    const db = this.requireDb()
    const row = db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId) as
      | Record<string, unknown>
      | undefined
    return row === undefined ? undefined : rowToSession(row)
  }

  /** All indexed session rows, newest indexed first. */
  listIndexedSessions(): SwitchIndexedSession[] {
    const db = this.requireDb()
    const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Record<string, unknown>[]
    return rows.map(rowToSession)
  }

  /** Number of indexed sessions. */
  countSessions(): number {
    const db = this.requireDb()
    const row = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number | bigint }
    return Number(row.n)
  }

  /**
   * Run one session-grouped full-text search.
   *
   * One statement: the FTS match is bounded by rank in a subquery (its rowid
   * aligns with docs.doc_id), then the type/surface filters join in — no
   * second round-trip, no large IN parameter lists.
   * @param request - query text, coarse type filter, page size.
   * @returns hits ranked by strongest per-session match.
   */
  search(request: {
    query: string
    types?: readonly SwitchIndexContentType[]
    limit?: number
  }): SwitchSearchHit[] {
    const db = this.requireDb()
    const match = sanitizeFtsQuery(request.query)
    if (match === '') return []
    const limit = Math.min(Math.max(1, request.limit ?? 20), 100)
    const types = resolveTypes(request.types)
    const placeholders = types.map(() => '?').join(', ')
    const docs = db.prepare(`
      SELECT d.doc_id AS docId, d.session_id AS sessionId, d.seq, d.type, d.time, d.text,
             s.title, f.rank AS ftsRank
      FROM (
        SELECT rowid, rank FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?
      ) f
      JOIN docs d ON d.doc_id = f.rowid
      JOIN sessions s ON s.session_id = d.session_id
      WHERE d.type IN (${placeholders}) AND d.surface = 'current'
    `).all(match, MATCH_SCAN_LIMIT, ...types) as {
      docId: number | bigint
      sessionId: string
      seq: number
      type: string
      time: number
      text: string
      title: string
      ftsRank: number
    }[]
    // Group by session; strongest hit = best weighted rank (bm25 rank is
    // negative-better, so weight scales its magnitude).
    const bestBySession = new Map<string, { doc: typeof docs[number]; score: number }>()
    for (const doc of docs) {
      const weight = TYPE_WEIGHT[doc.type] ?? 1
      const score = -Number(doc.ftsRank) * weight
      const best = bestBySession.get(doc.sessionId)
      if (best === undefined || score > best.score) bestBySession.set(doc.sessionId, { doc, score })
    }
    return [...bestBySession.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ doc }) => ({
        sessionId: doc.sessionId,
        title: doc.title,
        seq: doc.seq,
        type: doc.type,
        time: doc.time,
        snippet: buildSnippet(doc.text, request.query),
      }))
  }

  private requireDb(): DatabaseSync {
    if (this.db === undefined) throw new Error('switch-search: index engine is not open')
    return this.db
  }
}

/** Materialize the coarse filter into raw event types (absent → user+reply). */
export function resolveTypes(types: readonly SwitchIndexContentType[] | undefined): readonly string[] {
  if (types === undefined || types.length === 0) return ['user/message', 'assistant/message']
  const picked = new Set<Exclude<SwitchIndexContentType, 'all'>>()
  for (const entry of types) {
    if (entry === 'user' || entry === 'reply' || entry === 'tool') picked.add(entry)
    else return ['user/message', 'assistant/message', 'tool/call', 'tool/result']
  }
  if (picked.size === 0) return ['user/message', 'assistant/message']
  return [...picked].flatMap(entry => [...CONTENT_TYPE_GROUPS[entry]])
}

/** Map one raw sessions row onto the public face. */
function rowToSession(row: Record<string, unknown>): SwitchIndexedSession {
  return {
    sessionId: String(row['session_id']),
    version: Number(row['version']),
    title: String(row['title'] ?? ''),
    cwd: String(row['cwd'] ?? ''),
    updatedAt: Number(row['updated_at'] ?? 0),
    indexedAt: Number(row['indexed_at'] ?? 0),
  }
}
