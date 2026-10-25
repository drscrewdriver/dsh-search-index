import { type SwitchSqliteDriver } from './schema.ts';
import { type SwitchRawEvent } from './extract.ts';
/** One indexed session header row. */
export interface SwitchIndexedSession {
    sessionId: string;
    version: number;
    title: string;
    cwd: string;
    updatedAt: number;
    indexedAt: number;
    archived: boolean;
}
/** One session-grouped search hit. */
export interface SwitchSearchHit {
    sessionId: string;
    title: string;
    seq: number;
    type: string;
    /** Timestamp of the strongest matching document. Per-hit, not per-session. */
    time: number;
    /**
     * Session-level last-activity timestamp. Distinct from `time`: a session
     * may hold an old best match yet have moved one minute ago. This is the
     * field recency ordering and any client-side re-sort must key on.
     */
    updatedAt: number;
    snippet: string;
}
/**
 * Result ordering for one search.
 * - `relevance` (default) — weighted BM25, the historical behaviour.
 * - `time` — session recency first, relevance as the tie-break.
 */
export type SwitchSearchSort = 'relevance' | 'time';
/** Coarse type-filter buckets mapped onto raw session event types. */
export type SwitchIndexContentType = 'all' | 'user' | 'reply' | 'tool';
/**
 * Sanitize free text into a safe FTS5 query over the segmented index: each
 * whitespace term is segmented into word tokens, quoted as an adjacent
 * phrase, and the last token carries a prefix `*` so partial input matches
 * ("正在搜" hits 正在搜索). Terms AND together.
 */
export declare function sanitizeFtsQuery(query: string): string;
/** Build a snippet around the first term occurrence, official-route aligned. */
export declare function buildSnippet(text: string, query: string, max?: number): string;
/** Constructor options for one engine instance. */
export interface SwitchIndexEngineOptions {
    /** Absolute path of the index file this engine owns. */
    path: string;
}
/** One open index handle. All mutating calls are synchronous; callers pace
 * them off the HTTP hot path (background sync / rebuild tasks). */
export declare class SwitchIndexEngine {
    private readonly options;
    private db;
    private driver;
    private inBatch;
    constructor(options: SwitchIndexEngineOptions);
    /** Which SQLite driver is serving this handle. */
    get driverLabel(): SwitchSqliteDriver;
    /**
     * Run one write inside the current batched transaction, or its own
     * IMMEDIATE transaction when not batching (nested calls join the batch).
     */
    withWriteTx<T>(fn: () => T): T;
    /**
     * Run one function as a single batched transaction (one fsync checkpoint):
     * upserts inside it join via withWriteTx instead of opening their own.
     */
    runBatched<T>(fn: () => T): T;
    /** Whether the handle is open. */
    get isOpen(): boolean;
    /** Open (creating or migrating) the index file. Idempotent. */
    open(): Promise<void>;
    /** Close the handle. Idempotent. */
    close(): void;
    /** Remove one session's FTS entries for external-content bookkeeping. */
    private deleteSessionFts;
    /** Insert or replace one session's documents and header row. */
    upsertSession(input: {
        sessionId: string;
        version: number;
        title?: string;
        cwd?: string;
        updatedAt?: number;
        events: readonly SwitchRawEvent[];
        /**
         * 归档标记。缺省时**保留行上现有值**（归档态翻转由 setArchived 单独负责，
         * 全量重灌不改变归档状态）；显式传入时以传入值为准（重建/导入路径）。
         */
        archived?: boolean;
    }): number;
    /**
     * 该会话是否已有正文（issue #1:hollow 行判据）。
     * LIMIT 1 探测命中 docs_session 索引,每轮 poll 对每个未变更会话的开销可忽略。
     */
    hasSessionDocs(sessionId: string): boolean;
    /**
     * 「有表头无正文」的会话 id（升序）—— hollow 体检面。补录后仍 hollow 的行
     * 包含无可索引文本的真空会话（合法终态,见 sync 的 confirmedEmpty 缓存）。
     */
    listHollowSessions(): string[];
    /**
     * `PRAGMA integrity_check` 首行：'ok' 或损坏报告串。swap 后完整性闸门用。
     */
    integrityCheck(): string;
    /**
     * Write an archived session's header row without any document content.
     *
     * @deprecated 旧"归档即软删"语义的遗物,合并包 R1 已改为归档保留 docs;仅剩
     * 旧快照兼容路径可落 header 行。新代码一律 upsertSession + setArchived。
     */
    upsertArchivedHeader(input: {
        sessionId: string;
        version: number;
        title?: string;
        cwd?: string;
        updatedAt?: number;
    }): void;
    /**
     * Apply the official archive set: flip the archived flag both ways.
     *
     * 合表复用语义（R1）：归档**保留全部 docs 与 FTS**——正文在归档态不可变
     * （归档门只拒新回合），翻转只是检索域成员资格的变化；恢复也不再需要重灌
     * （旧实现的 version = -1 强制重读随"归档即删 docs"一并废除）。
     */
    setArchived(archivedIds: ReadonlySet<string>): void;
    /**
     * Flip one session's archived flag (steward write-side linkage). No-op when
     * the row does not exist — flag state on an unindexed session is meaningless.
     */
    setArchivedOne(sessionId: string, archived: boolean): void;
    /** One session's stored documents, ascending seq (snapshot export face). */
    exportSessionDocs(sessionId: string): {
        seq: number;
        type: string;
        surface: string;
        time: number;
        text: string;
    }[];
    /**
     * Insert or replace one session from already-extracted documents
     * (snapshot import face; no re-extraction, what was exported is restored;
     * segmentation is recomputed for the current index format).
     */
    importSessionDocs(input: {
        sessionId: string;
        version: number;
        title?: string;
        /** 归档标记随快照往返；旧快照缺省为活跃。 */
        archived?: boolean;
        docs: readonly {
            seq: number;
            type: string;
            surface: string;
            time: number;
            text: string;
        }[];
    }): void;
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
        sessionId: string;
        version: number;
        title?: string;
        cwd?: string;
        updatedAt?: number;
        archived?: boolean;
        docs: readonly {
            seq: number;
            type: string;
            surface: string;
            time: number;
            text: string;
        }[];
    }): number;
    /**
     * 会话头直写（DRS 直连时代的同步轮专用，T7.3）：只维护 sessions 元数据
     * （水位/标题/目录/末时间/归档），**不碰 docs/docs_fts**——内容检索
     * 已直连 dsh-reference-session-collector（op=search&group=session），本地正文索引
     * 退役，存量 docs 行自然老化不再新增。空标题保留旧行（同 upsertSessionDocs）。
     */
    upsertSessionHead(input: {
        sessionId: string;
        version: number;
        title?: string;
        cwd?: string;
        updatedAt?: number;
        archived?: boolean;
    }): void;
    /** Remove one session and its documents entirely. */
    removeSession(sessionId: string): void;
    /** Update only a session's header row (title backfill), keeping documents. */
    updateSessionHeader(input: {
        sessionId: string;
        title?: string;
        cwd?: string;
        updatedAt?: number;
    }): void;
    /** One indexed session row, or undefined. */
    getSession(sessionId: string): SwitchIndexedSession | undefined;
    /** All indexed sessions (active AND archived), newest first — the title
     * corpus and the manage console both read this; the `archived` flag rides
     * each row so clients filter locally. */
    listIndexedSessions(): SwitchIndexedSession[];
    /** Archived (soft-deleted) sessions, newest first — the archive viewer face. */
    listArchived(): SwitchIndexedSession[];
    /** Number of indexed sessions (active + archived — the whole corpus). */
    countSessions(): number;
    /** Number of archived (soft-deleted) sessions. */
    countArchived(): number;
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
        query: string;
        types?: readonly SwitchIndexContentType[];
        limit?: number;
        sortBy?: SwitchSearchSort;
        /**
         * 检索域：`'active'` 仅活跃、`'archived'` 仅归档、`'all'`（缺省）两者。
         * 归档正文入索引后的筛选 chip 即此参数。
         */
        archived?: 'active' | 'archived' | 'all';
        /** 更新时间下界（epoch ms,含）。 */
        from?: number;
        /** 更新时间上界（epoch ms,排他）。 */
        to?: number;
    }): SwitchSearchHit[];
    private requireDb;
}
/** Materialize the coarse filter into raw event types (absent → user+reply). */
export declare function resolveTypes(types: readonly SwitchIndexContentType[] | undefined): readonly string[];
//# sourceMappingURL=engine.d.ts.map