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
import { openIndexDatabase, type SwitchSqliteDriver } from './schema.ts'
import { buildIndexDocuments, segmentForIndex, segmentQueryTerm, type SwitchRawEvent } from './extract.ts'

/** One indexed session header row. */
export interface SwitchIndexedSession {
  sessionId: string
  version: number
  title: string
  cwd: string
  updatedAt: number
  indexedAt: number
  archived: boolean
}

/** One session-grouped search hit. */
export interface SwitchSearchHit {
  sessionId: string
  title: string
  seq: number
  type: string
  /** Timestamp of the strongest matching document. Per-hit, not per-session. */
  time: number
  /**
   * Session-level last-activity timestamp. Distinct from `time`: a session
   * may hold an old best match yet have moved one minute ago. This is the
   * field recency ordering and any client-side re-sort must key on.
   */
  updatedAt: number
  snippet: string
}

/**
 * Result ordering for one search.
 * - `relevance` (default) — weighted BM25, the historical behaviour.
 * - `time` — session recency first, relevance as the tie-break.
 */
export type SwitchSearchSort = 'relevance' | 'time'

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

/** Constructor options for one engine instance. */
export interface SwitchIndexEngineOptions {
  /** Absolute path of the index file this engine owns. */
  path: string
}

/** One open index handle. All mutating calls are synchronous; callers pace
 * them off the HTTP hot path (background sync / rebuild tasks). */
export class SwitchIndexEngine {
  private db: DatabaseSync | undefined
  private driver: SwitchSqliteDriver = 'node:sqlite'
  private inBatch = false

  constructor(private readonly options: SwitchIndexEngineOptions) {}

  /** Which SQLite driver is serving this handle. */
  get driverLabel(): SwitchSqliteDriver {
    return this.driver
  }

  /**
   * Run one write inside the current batched transaction, or its own
   * IMMEDIATE transaction when not batching (nested calls join the batch).
   */
  withWriteTx<T>(fn: () => T): T {
    const db = this.requireDb()
    if (this.inBatch) return fn()
    db.exec('BEGIN IMMEDIATE')
    this.inBatch = true
    try {
      const result = fn()
      db.exec('COMMIT')
      return result
    } catch (error) {
      try { db.exec('ROLLBACK') } catch { /* rollback of a broken txn is best-effort */ }
      throw error
    } finally {
      this.inBatch = false
    }
  }

  /**
   * Run one function as a single batched transaction (one fsync checkpoint):
   * upserts inside it join via withWriteTx instead of opening their own.
   */
  runBatched<T>(fn: () => T): T {
    return this.withWriteTx(fn)
  }

  /** Whether the handle is open. */
  get isOpen(): boolean {
    return this.db !== undefined
  }

  /** Open (creating or migrating) the index file. Idempotent. */
  async open(): Promise<void> {
    if (this.db !== undefined) return
    const opened = await openIndexDatabase(this.options.path)
    this.db = opened.db
    this.driver = opened.driver
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
    /**
     * 归档标记。缺省时**保留行上现有值**（归档态翻转由 setArchived 单独负责，
     * 全量重灌不改变归档状态）；显式传入时以传入值为准（重建/导入路径）。
     */
    archived?: boolean
  }): number {
    const db = this.requireDb()
    const documents = buildIndexDocuments(input.sessionId, input.events)
    return this.withWriteTx(() => {
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
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
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
        input.archived === true ? 1 : 0,
      )
      return documents.length
    })
  }

  /**
   * 该会话是否已有正文（issue #1:hollow 行判据）。
   * LIMIT 1 探测命中 docs_session 索引,每轮 poll 对每个未变更会话的开销可忽略。
   */
  hasSessionDocs(sessionId: string): boolean {
    const db = this.requireDb()
    return db.prepare('SELECT 1 FROM docs WHERE session_id = ? LIMIT 1').get(sessionId) !== undefined
  }

  /**
   * 「有表头无正文」的会话 id（升序）—— hollow 体检面。补录后仍 hollow 的行
   * 包含无可索引文本的真空会话（合法终态,见 sync 的 confirmedEmpty 缓存）。
   */
  listHollowSessions(): string[] {
    const db = this.requireDb()
    return (db.prepare(`
      SELECT s.session_id FROM sessions s
      WHERE NOT EXISTS (SELECT 1 FROM docs d WHERE d.session_id = s.session_id)
      ORDER BY s.session_id
    `).all() as { session_id: string }[]).map(row => row.session_id)
  }

  /**
   * `PRAGMA integrity_check` 首行：'ok' 或损坏报告串。swap 后完整性闸门用。
   */
  integrityCheck(): string {
    const db = this.requireDb()
    const row = db.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined
    if (row === undefined) return 'no result'
    const first = Object.values(row)[0]
    return String(first ?? 'no result')
  }

  /**
   * Write an archived session's header row without any document content.
   *
   * @deprecated 旧"归档即软删"语义的遗物,合并包 R1 已改为归档保留 docs;仅剩
   * 旧快照兼容路径可落 header 行。新代码一律 upsertSession + setArchived。
   */
  upsertArchivedHeader(input: {
    sessionId: string
    version: number
    title?: string
    cwd?: string
    updatedAt?: number
  }): void {
    const db = this.requireDb()
    this.withWriteTx(() => {
      this.deleteSessionFts(db, input.sessionId)
      db.prepare('DELETE FROM docs WHERE session_id = ?').run(input.sessionId)
      db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at,
          archived = 1
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

  /**
   * Apply the official archive set: flip the archived flag both ways.
   *
   * 合表复用语义（R1）：归档**保留全部 docs 与 FTS**——正文在归档态不可变
   * （归档门只拒新回合），翻转只是检索域成员资格的变化；恢复也不再需要重灌
   * （旧实现的 version = -1 强制重读随"归档即删 docs"一并废除）。
   */
  setArchived(archivedIds: ReadonlySet<string>): void {
    const db = this.requireDb()
    this.withWriteTx(() => {
      const rows = db.prepare('SELECT session_id, archived FROM sessions').all() as
        { session_id: string; archived: number }[]
      for (const row of rows) {
        const shouldBe = archivedIds.has(row.session_id) ? 1 : 0
        if (row.archived !== shouldBe) {
          db.prepare('UPDATE sessions SET archived = ? WHERE session_id = ?').run(shouldBe, row.session_id)
        }
      }
    })
  }

  /**
   * Flip one session's archived flag (steward write-side linkage). No-op when
   * the row does not exist — flag state on an unindexed session is meaningless.
   */
  setArchivedOne(sessionId: string, archived: boolean): void {
    const db = this.requireDb()
    this.withWriteTx(() => {
      db.prepare('UPDATE sessions SET archived = ? WHERE session_id = ?')
        .run(archived ? 1 : 0, sessionId)
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
    /** 归档标记随快照往返；旧快照缺省为活跃。 */
    archived?: boolean
    docs: readonly { seq: number; type: string; surface: string; time: number; text: string }[]
  }): void {
    const db = this.requireDb()
    this.withWriteTx(() => {
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
        INSERT INTO sessions (session_id, version, title, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = excluded.title,
          indexed_at = excluded.indexed_at,
          archived = excluded.archived
      `).run(input.sessionId, input.version, input.title ?? '', Date.now(), input.archived === true ? 1 : 0)
    })
  }

  /**
   * Insert or replace one session from corpus-source documents (T7.1 DRS
   * 语料源):docs 已由语料源抽好(surface 字符串),切分仍由本引擎重算。
   * 与 importSessionDocs 的三点差异,均为检索排序/水印所需:cwd 与
   * updated_at 直写(日期过滤/时间排序键);标题空串保留旧行(upsertSession
   * 同款 CASE——DRS 对老会话可能给不出标题,不能抹掉既有精修);归档旗标
   * 冲突时不动(翻转仍归 setArchived)。
   * @returns 落库 docs 数(0 = 该会话无可索引文本,合法终态)。
   */
  upsertSessionDocs(input: {
    sessionId: string
    version: number
    title?: string
    cwd?: string
    updatedAt?: number
    archived?: boolean
    docs: readonly { seq: number; type: string; surface: string; time: number; text: string }[]
  }): number {
    const db = this.requireDb()
    return this.withWriteTx(() => {
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
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
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
        input.archived === true ? 1 : 0,
      )
      return input.docs.length
    })
  }

  /**
   * 会话头直写（DRS 直连时代的同步轮专用，T7.3）：只维护 sessions 元数据
   * （水位/标题/目录/末时间/归档），**不碰 docs/docs_fts**——内容检索
   * 已直连 dsh-reference-session-collector（op=search&group=session），本地正文索引
   * 退役，存量 docs 行自然老化不再新增。空标题保留旧行（同 upsertSessionDocs）。
   */
  upsertSessionHead(input: {
    sessionId: string
    version: number
    title?: string
    cwd?: string
    updatedAt?: number
    archived?: boolean
  }): void {
    const db = this.requireDb()
    this.withWriteTx(() => {
      db.prepare(`
        INSERT INTO sessions (session_id, version, title, cwd, updated_at, indexed_at, archived)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          version = excluded.version,
          title = CASE WHEN excluded.title != '' THEN excluded.title ELSE sessions.title END,
          cwd = excluded.cwd,
          updated_at = excluded.updated_at,
          indexed_at = excluded.indexed_at,
          archived = excluded.archived
      `).run(
        input.sessionId,
        input.version,
        input.title ?? '',
        input.cwd ?? '',
        input.updatedAt ?? 0,
        Date.now(),
        input.archived === true ? 1 : 0,
      )
    })
  }

  /** Remove one session and its documents entirely. */
  removeSession(sessionId: string): void {
    const db = this.requireDb()
    this.withWriteTx(() => {
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

  /** All indexed sessions (active AND archived), newest first — the title
   * corpus and the manage console both read this; the `archived` flag rides
   * each row so clients filter locally. */
  listIndexedSessions(): SwitchIndexedSession[] {
    const db = this.requireDb()
    const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as Record<string, unknown>[]
    return rows.map(rowToSession)
  }

  /** Archived (soft-deleted) sessions, newest first — the archive viewer face. */
  listArchived(): SwitchIndexedSession[] {
    const db = this.requireDb()
    const rows = db.prepare('SELECT * FROM sessions WHERE archived = 1 ORDER BY updated_at DESC').all() as Record<string, unknown>[]
    return rows.map(rowToSession)
  }

  /** Number of indexed sessions (active + archived — the whole corpus). */
  countSessions(): number {
    const db = this.requireDb()
    const row = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number | bigint }
    return Number(row.n)
  }

  /** Number of archived (soft-deleted) sessions. */
  countArchived(): number {
    const db = this.requireDb()
    const row = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE archived = 1').get() as { n: number | bigint }
    return Number(row.n)
  }

  /**
   * Run one session-grouped full-text search.
   *
   * One statement: the FTS match is bounded by rank in a subquery (its rowid
   * aligns with docs.doc_id), then the type/surface filters join in — no
   * second round-trip, no large IN parameter lists.
   * @param request - query text, coarse type filter, page size, ordering.
   * @returns hits ordered by `sortBy` (relevance by default).
   */
  search(request: {
    query: string
    types?: readonly SwitchIndexContentType[]
    limit?: number
    sortBy?: SwitchSearchSort
    /**
     * 检索域：`'active'` 仅活跃、`'archived'` 仅归档、`'all'`（缺省）两者。
     * 归档正文入索引后的筛选 chip 即此参数。
     */
    archived?: 'active' | 'archived' | 'all'
    /** 更新时间下界（epoch ms,含）。 */
    from?: number
    /** 更新时间上界（epoch ms,排他）。 */
    to?: number
  }): SwitchSearchHit[] {
    const db = this.requireDb()
    const match = sanitizeFtsQuery(request.query)
    if (match === '') return []
    const limit = Math.min(Math.max(1, request.limit ?? 20), 100)
    const types = resolveTypes(request.types)
    const placeholders = types.map(() => '?').join(', ')
    const archivedClause = request.archived === 'active'
      ? 'AND s.archived = 0'
      : request.archived === 'archived'
        ? 'AND s.archived = 1'
        : ''
    // 日期范围（R6）:s.updated_at 上的半开区间 [from, to)。
    const dateClauses: string[] = []
    const dateParams: number[] = []
    if (typeof request.from === 'number' && Number.isFinite(request.from)) {
      dateClauses.push('AND s.updated_at >= ?')
      dateParams.push(request.from)
    }
    if (typeof request.to === 'number' && Number.isFinite(request.to)) {
      dateClauses.push('AND s.updated_at < ?')
      dateParams.push(request.to)
    }
    const dateClause = dateClauses.join(' ')
    const docs = db.prepare(`
      SELECT d.doc_id AS docId, d.session_id AS sessionId, d.seq, d.type, d.time, d.text,
             s.title, s.updated_at AS updatedAt, f.rank AS ftsRank
      FROM (
        SELECT rowid, rank FROM docs_fts WHERE docs_fts MATCH ? ORDER BY rank LIMIT ?
      ) f
      JOIN docs d ON d.doc_id = f.rowid
      JOIN sessions s ON s.session_id = d.session_id
      WHERE d.type IN (${placeholders}) AND d.surface = 'current' ${archivedClause} ${dateClause}
    `).all(match, MATCH_SCAN_LIMIT, ...types, ...dateParams) as {
      docId: number | bigint
      sessionId: string
      seq: number
      type: string
      time: number
      text: string
      title: string
      updatedAt: number
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
    const grouped = [...bestBySession.values()]
    if (request.sortBy === 'time') {
      // Recency is a session-level concern, so it keys on `updatedAt` — not on
      // a hit's `time`, which only says when the best-matching document was
      // written. Relevance is the tie-break so equal timestamps stay sane.
      // Ordering happens before the slice: sorting the page afterwards would
      // only reorder an already relevance-truncated top-N.
      grouped.sort((a, b) => (b.doc.updatedAt - a.doc.updatedAt) || (b.score - a.score))
    } else {
      grouped.sort((a, b) => b.score - a.score)
    }
    return grouped
      .slice(0, limit)
      .map(({ doc }) => ({
        sessionId: doc.sessionId,
        title: doc.title,
        seq: doc.seq,
        type: doc.type,
        time: doc.time,
        updatedAt: Number(doc.updatedAt ?? 0),
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
    archived: Number(row['archived'] ?? 0) === 1,
  }
}
