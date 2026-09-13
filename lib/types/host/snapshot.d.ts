/**
 * JSON Lines snapshot migration for the independent switch-search index.
 *
 * The snapshot is the "translation" seam: one JSON object per line, carrying a
 * session's indexed documents in a self-contained shape. Export writes the
 * active index out; import parses the lines and rebuilds them into a fresh
 * shadow index that swaps in atomically (same swap path as 整理).
 */
import type { SwitchIndexEngine } from './engine.ts';
import type { SwitchImportRecord } from './rebuild.ts';
/** Snapshot format header line. */
export interface SwitchSnapshotHeader {
    v: 1;
    kind: 'dsh-switch-search-snapshot';
    exportedAt: number;
}
/** One snapshot line: a session and its indexed documents. */
export interface SwitchSnapshotRecord {
    v: 1;
    sessionId: string;
    version: number;
    title: string;
    docs: {
        seq: number;
        type: string;
        surface: string;
        time: number;
        text: string;
    }[];
}
/** Render the snapshot header line. */
export declare function snapshotHeader(): string;
/**
 * Export the whole active index as a JSON Lines string.
 * @param engine - the open active engine.
 * @returns the complete snapshot text (header line first).
 */
export declare function exportSnapshot(engine: SwitchIndexEngine): string;
/** One parsed snapshot: importable records plus skipped-line count. */
export interface SwitchParsedSnapshot {
    records: SwitchImportRecord[];
    skipped: number;
}
/**
 * Parse a snapshot's JSON Lines text into importable records.
 * The header line and any malformed line are skipped, not fatal.
 * @param text - raw snapshot text.
 * @returns importable records and how many lines were skipped.
 */
export declare function parseSnapshot(text: string): SwitchParsedSnapshot;
//# sourceMappingURL=snapshot.d.ts.map