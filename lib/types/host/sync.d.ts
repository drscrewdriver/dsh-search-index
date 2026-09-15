/**
 * Watermark-driven incremental sync between the live-preferred sessionQuery
 * corpus and the independent switch-search index.
 *
 * One pass lists the logical corpus, diffs stored `version` watermarks, and
 * re-reads only new or changed sessions. Per-session failures are isolated and
 * reported; one broken log never stalls the whole sync.
 */
import type { SwitchIndexEngine } from './engine.ts';
import type { SwitchRawEvent } from './extract.ts';
/** The sessionQuery faces the sync reads (structural mirrors). */
export interface SwitchSyncSessionQuery {
    listSessions(): Promise<readonly {
        header: {
            id: string;
            version: number;
            createdAt?: number;
            cwd?: string;
        };
    }[]>;
    readSession(sessionId: string): Promise<{
        session: {
            id: string;
            version: number;
            createdAt?: number;
            cwd?: string;
        };
        events: readonly SwitchRawEvent[];
    }>;
    readTitleSnapshots?(sessionIds: readonly string[]): Promise<readonly {
        status: 'fulfilled' | 'rejected';
        value?: {
            session: {
                id: string;
            };
            title?: {
                title: string;
            };
        };
    }[]>;
}
/** Live sync progress reported to the status endpoint. */
export interface SwitchSyncState {
    /** What the syncer is doing right now. */
    state: 'idle' | 'syncing' | 'error';
    /** Epoch ms of the last completed pass. */
    lastSyncAt: number;
    /** Sessions currently in the index. */
    indexed: number;
    /** Sessions seen in the corpus at the last pass. */
    total: number;
    /** Sessions re-read in the last pass. */
    updated: number;
    /** Per-session failures from the last pass. */
    failures: {
        sessionId: string;
        error: string;
    }[];
    /** Last pass error (whole-pass abort), if any. */
    error?: string;
}
/**
 * The official archive-set face (workspaceRegistry mirror): read-only.
 * Resolved lazily per pass — the registry may mount after this plugin.
 */
export interface SwitchArchiveSource {
    readonly archivedSessionIds: readonly string[];
}
/**
 * One watermark syncer bound to one open engine. `poll()` is re-entrant-safe:
 * overlapping calls collapse into the running pass.
 */
export declare class SwitchWatermarkSync {
    private readonly engine;
    private readonly sessionQuery;
    private readonly readArchiveSource?;
    private readonly log?;
    private running;
    private readonly state;
    constructor(engine: SwitchIndexEngine, sessionQuery: SwitchSyncSessionQuery, readArchiveSource?: (() => SwitchArchiveSource | undefined) | undefined, log?: ((msg: string) => void) | undefined);
    /** Current progress snapshot (cloned). */
    snapshot(): SwitchSyncState;
    /**
     * Run one incremental pass (or await the running one).
     * @returns the state after the pass completes.
     */
    poll(): Promise<SwitchSyncState>;
    private runPass;
    /**
     * Fold titles for archived header-only rows that never got one (archived
     * before first indexing). Bounded: only rows with an empty title, and the
     * title fold reads the log without ingesting content.
     */
    private backfillArchivedTitles;
    /** Fold latest titles for changed sessions into the index header rows. */
    private backfillTitles;
}
//# sourceMappingURL=sync.d.ts.map