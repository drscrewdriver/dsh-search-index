import { type SwitchRawEvent } from './extract.ts';
/** One indexed session header row. */
export interface SwitchIndexedSession {
    sessionId: string;
    version: number;
    title: string;
    cwd: string;
    updatedAt: number;
    indexedAt: number;
}
/** One session-grouped search hit. */
export interface SwitchSearchHit {
    sessionId: string;
    title: string;
    seq: number;
    type: string;
    time: number;
    snippet: string;
}
/** Coarse type-filter buckets mapped onto raw session event types. */
export type SwitchIndexContentType = 'all' | 'user' | 'reply' | 'tool';
/**
 * Sanitize free text into safe FTS5 trigram terms: each whitespace term is
 * double-quoted (internal quotes doubled), terms AND together.
 * Terms shorter than the trigram size are dropped from the FTS expression.
 */
export declare function sanitizeFtsQuery(query: string): string;
/** Extract quoted literal terms for the LIKE fallback (short queries). */
export declare function likeTerms(query: string): string[];
/** Build a snippet around the first term occurrence, official-route aligned. */
export declare function buildSnippet(text: string, query: string, max?: number): string;
/** Constructor options for one engine instance. */
export interface SwitchIndexEngineOptions {
    /** Absolute path of the index file this engine owns. */
    path: string;
}
/**
 * One open index handle. All mutating calls are synchronous; callers pace
 * them off the HTTP hot path (background sync / rebuild tasks).
 */
export declare class SwitchIndexEngine {
    private readonly options;
    private db;
    constructor(options: SwitchIndexEngineOptions);
    /** Whether the handle is open. */
    get isOpen(): boolean;
    /** Open (creating or migrating) the index file. Idempotent. */
    open(): Promise<void>;
    /** Close the handle. Idempotent. */
    close(): void;
    /** Insert or replace one session's documents and header row. */
    upsertSession(input: {
        sessionId: string;
        version: number;
        title?: string;
        cwd?: string;
        updatedAt?: number;
        events: readonly SwitchRawEvent[];
    }): void;
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
     * (snapshot import face; no re-extraction, what was exported is restored).
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
    /** All indexed session rows, newest indexed first. */
    listIndexedSessions(): SwitchIndexedSession[];
    /** Number of indexed sessions. */
    countSessions(): number;
    /**
     * Run one session-grouped full-text search.
     * @param request - query text, coarse type filter, page size.
     * @returns hits ranked by strongest per-session match.
     */
    search(request: {
        query: string;
        types?: readonly SwitchIndexContentType[];
        limit?: number;
    }): SwitchSearchHit[];
    private requireDb;
}
/** Materialize the coarse filter into raw event types (absent → user+reply). */
export declare function resolveTypes(types: readonly SwitchIndexContentType[] | undefined): readonly string[];
//# sourceMappingURL=engine.d.ts.map