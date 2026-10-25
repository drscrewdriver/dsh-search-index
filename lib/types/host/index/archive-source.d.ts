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
/** Build the lazy source face the syncer expects, with diagnostics capture. */
export declare function createArchiveSource(getRegistry: () => SwitchRegistryFace | undefined): {
    read: () => SwitchArchiveRead;
    diagnostics: () => SwitchArchiveDiagnostics;
};
//# sourceMappingURL=archive-source.d.ts.map