/** One resolved archive read: ids plus which source served them. */
export interface SwitchArchiveRead {
    ids: readonly string[];
    source: 'registry' | 'storage-file' | 'none';
}
/** The workspaceRegistry mirror face (getter only). */
export interface SwitchRegistryFace {
    readonly archivedSessionIds: readonly string[];
}
/** Diagnostics describing how the archive set is being resolved. */
export interface SwitchArchiveDiagnostics {
    source: 'registry' | 'storage-file' | 'none';
    ids: number;
    error?: string;
}
/**
 * Resolve the official archive set once.
 * @param registry - lazy workspaceRegistry face (may be absent or throw).
 * @returns the archive ids plus which source served them.
 */
export declare function readArchiveSet(registry?: SwitchRegistryFace): SwitchArchiveRead;
/**
 * Remove session ids from the storage hub's global.archivedSessionIds.
 *
 * The official backend exposes no unarchive endpoint, so the canonical file
 * is edited directly, following storage-json's own protocol: backup, atomic
 * same-directory temp write, rename. The running host keeps the set in
 * memory and only reloads it at boot — the caller must surface that a DSH
 * restart is required. Our own index un-flags immediately so the next
 * watermark pass re-ingests any session whose log still exists.
 * @param ids - session ids to remove from the archive array.
 * @param log - optional log sink.
 * @returns how many ids were actually removed and the remaining count.
 */
export declare function pruneArchiveFile(ids: readonly string[], log?: (msg: string) => void, searchPaths?: readonly string[]): {
    removed: number;
    remaining: number;
    file?: string;
};
/** Build the lazy source face the syncer expects, with diagnostics capture. */
export declare function createArchiveSource(getRegistry: () => SwitchRegistryFace | undefined): {
    read: () => SwitchArchiveRead;
    diagnostics: () => SwitchArchiveDiagnostics;
};
//# sourceMappingURL=archive-source.d.ts.map