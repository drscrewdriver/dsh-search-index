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
    }): void;
    /**
     * Write an archived session's header row without any document content:
     * the official archive never removes logs, and the index mirrors that with
     * a flag while skipping the content copy on rebuilds.
     */
    upsertArchivedHeader(input: {
        sessionId: string;
        version: number;
        title?: string;
        cwd?: string;
        updatedAt?: number;
    }): void;
    /**
     * Apply the official archive set: mark archived ids, unmark the rest.
     * Clearing the flag forces the next watermark pass to re-ingest the
     * session's full content (version = -1).
     */
    setArchived(archivedIds: ReadonlySet<string>): void;
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
        docs: readonly {
            seq: number;
            type: string;
            surface: string;
            time: number;
            text: string;
        }[];
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
    /** Active (non-archived) indexed sessions, newest first. */
    listIndexedSessions(): SwitchIndexedSession[];
    /** Archived (soft-deleted) sessions, newest first — the archive viewer face. */
    listArchived(): SwitchIndexedSession[];
    /** Number of active (non-archived) indexed sessions. */
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
    }): SwitchSearchHit[];
    private requireDb;
}
/** Materialize the coarse filter into raw event types (absent → user+reply). */
export declare function resolveTypes(types: readonly SwitchIndexContentType[] | undefined): readonly string[];
//# sourceMappingURL=engine.d.ts.map