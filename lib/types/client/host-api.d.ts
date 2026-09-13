/**
 * Client-side helpers and structural mirrors shared by the search panel and
 * the settings card. Everything talks to the host through the fenced
 * `/switch-search/api` route; no official package is value-imported.
 */
/** POST a JSON body to a fenced switch-search API method (items shape). */
export declare function callHost<T>(method: string, body: unknown): Promise<{
    ok: boolean;
    items: T[];
    error?: string;
}>;
/** POST a body to a fenced switch-search API method, returning the whole record. */
export declare function callHostAny<T>(method: string, body: unknown, timeout?: number): Promise<Partial<T> & {
    ok: boolean;
    error?: string;
}>;
/** One session listed for the title-search corpus. */
export interface HostSessionItem {
    sessionId: string;
    title: string;
    cwd: string;
    updatedAt: number;
}
/** One content-search hit (session-level: title + strongest snippet). */
export interface HostContentHit {
    sessionId: string;
    title: string;
    snippet: string;
    seq: number;
    type: string;
    time: number;
}
/** Host watermark-sync state (subset used here). */
export interface HostSyncState {
    state: string;
    indexed: number;
    total: number;
    updated: number;
    lastSyncAt: number;
    failures: {
        sessionId: string;
        error: string;
    }[];
}
/** Host rebuild ("整理") state (subset used here). */
export interface HostRebuildState {
    state: string;
    done: number;
    total: number;
    error?: string;
}
/** Host independent-index status (subset used here). */
export interface HostIndexStatus {
    ok: boolean;
    available: boolean;
    reason?: string;
    dir?: string;
    archives?: string[];
    sync?: HostSyncState;
    rebuild?: HostRebuildState;
    error?: string;
}
/** Trigger a browser download of the index snapshot from the host route. */
export declare function downloadSnapshot(): Promise<void>;
//# sourceMappingURL=host-api.d.ts.map