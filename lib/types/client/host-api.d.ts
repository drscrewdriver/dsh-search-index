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
/**
 * One content-search hit (session-level: title + strongest snippet).
 * `time` belongs to the strongest matching document; `updatedAt` is the
 * session-level clock and is what recency ordering keys on. Both ship so the
 * panel can re-sort locally without another round-trip.
 */
export interface HostContentHit {
    sessionId: string;
    title: string;
    snippet: string;
    seq: number;
    type: string;
    time: number;
    updatedAt: number;
}
/** Result ordering accepted by the host `content-search` method. */
export type HostSortMode = 'relevance' | 'time';
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
    archivedSessions?: number;
    /**
     * Resolution state of the peer plugin that owns archiving. Absent on an
     * older host half — treated as `unknown`, which renders the neutral hint.
     */
    steward?: 'installed' | 'missing' | 'unknown';
    sync?: HostSyncState;
    rebuild?: HostRebuildState;
    error?: string;
}
/** Trigger a browser download of the index snapshot from the host route. */
export declare function downloadSnapshot(): Promise<void>;
/**
 * The client sessions service face. Host lines before 0.1.7 exposed session
 * navigation here as `open`; the 0.1.7 contract dropped it ("navigation
 * belongs to view owners") — kept only as the legacy fallback of
 * `openSessionThrough`.
 */
export interface SwitchSessionsService {
    open(id: string): void;
}
/**
 * The client ui-workspace face: session navigation has been owned by this
 * service since host 0.1.7 (`openSession`; `SessionTarget = SessionId |
 * SubagentAddress`, so a bare session id is accepted).
 */
export interface SwitchUiWorkspaceService {
    openSession(target: string): void;
}
/**
 * Open a session from a search hit through whichever face the running host
 * offers: `uiWorkspace.openSession` first (0.1.7+), the pre-0.1.7
 * `sessions.open` as fallback. Neither present → silent no-op: a host line
 * this package does not target must not crash the panel.
 *
 * The service names are resolved through `get` at call time, not captured at
 * apply time: this plugin applies before the session-controller / ui-workspace
 * client modules in the load order, so an eager lookup captures `undefined`
 * and every result click silently no-ops. Both are root-context singletons,
 * so by the time a user clicks a hit they are always mounted.
 */
export declare function openSessionThrough(get: (name: string) => unknown, sessionId: string): void;
//# sourceMappingURL=host-api.d.ts.map