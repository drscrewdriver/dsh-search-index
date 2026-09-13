import { SwitchIndexEngine } from './engine.ts';
import type { SwitchRawEvent } from './extract.ts';
import type { SwitchArchiveSource } from './sync.ts';
/** The corpus reader a rebuild needs (same faces as the syncer). */
export interface SwitchRebuildSessionQuery {
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
}
/** Live rebuild progress reported to the status endpoint. */
export interface SwitchRebuildState {
    state: 'idle' | 'building' | 'swapping' | 'error';
    /** Sessions written into the shadow index so far. */
    done: number;
    /** Sessions seen in the corpus when the build started. */
    total: number;
    /** Epoch ms when the build started. */
    startedAt: number;
    /** Epoch ms when the last build finished. */
    finishedAt: number;
    /** Per-session failures during the last build. */
    failures: {
        sessionId: string;
        error: string;
    }[];
    error?: string;
}
/** Filesystem layout of one index directory. */
export interface SwitchIndexLayout {
    /** Directory holding every index file. */
    dir: string;
    /** Active index file name. */
    active: string;
    /** Shadow file name used while building. */
    building: string;
    /** Archive file name prefix. */
    archivePrefix: string;
}
/** Default layout names. */
export declare const DEFAULT_INDEX_LAYOUT: SwitchIndexLayout;
/** List existing archive files, oldest first. */
export declare function listArchives(layout: SwitchIndexLayout): Promise<string[]>;
/**
 * Build a fresh index into the shadow file, then swap it in atomically.
 *
 * During the build the caller's active engine stays open and queryable; only
 * the final swap briefly reopens the handle.
 * @param activeEngine - the currently-serving engine (its file is replaced).
 * @param layout - filesystem layout of the index directory.
 * @param sessionQuery - corpus reader for the full rebuild.
 * @param keepArchives - how many archive files to retain (oldest pruned).
 * @param onProgress - optional progress callback after each session.
 * @returns the rebuild state snapshot after completion.
 */
/** Optional observability callbacks for rebuildIndex. */
export interface SwitchRebuildHooks {
    /** Progress log line sink (cordis logger bridge). */
    log?: (msg: string) => void;
    /** State-mutation sink: called after every change so index-status sees
     * live progress (the "0/?" bug was state cloned only at completion). */
    onState?: (state: SwitchRebuildState) => void;
}
export declare function rebuildIndex(activeEngine: SwitchIndexEngine, layout: SwitchIndexLayout, sessionQuery: SwitchRebuildSessionQuery, keepArchives: number, onProgress?: (done: number, total: number) => void, archiveSource?: () => SwitchArchiveSource | undefined, hooks?: SwitchRebuildHooks): Promise<SwitchRebuildState>;
/** One doc-level record the snapshot importer feeds in. */
export interface SwitchImportRecord {
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
}
/** Import doc-level records into the shadow file and swap it in (same swap path). */
export declare function importIntoIndex(activeEngine: SwitchIndexEngine, layout: SwitchIndexLayout, records: readonly SwitchImportRecord[], keepArchives: number): Promise<SwitchRebuildState>;
/**
 * Resolve the index directory that hosts the independent index files:
 * an explicit override wins, otherwise a plugin-owned directory under the
 * user's home (never the official index path).
 */
export declare function resolveIndexDir(preferred?: string): string;
//# sourceMappingURL=rebuild.d.ts.map