/** Resolution outcome for a peer plugin package. */
export type PeerPresence = 'installed' | 'missing' | 'unknown';
/** The package that owns the archived-session domain. */
export declare const STEWARD_PACKAGE = "dsh-session-steward";
/**
 * Probe whether a package resolves from this plugin's own module graph.
 *
 * The bundle lives at `<profile>/node_modules/dsh-search-index/lib/index.mjs`,
 * so resolution runs against `<profile>/node_modules` — exactly where a
 * profile dependency lands, and therefore the same place the host would load
 * the peer from.
 *
 * @param name - the package name to resolve.
 * @param base - resolution base; defaults to this module's own URL, i.e. the
 *   plugin's install directory. Injectable so the classification can be tested
 *   against a fixture that fails in a way this checkout cannot produce.
 * @returns `installed` when it resolves; `missing` only for a genuine
 *   module-not-found; `unknown` for every other failure, because an
 *   unanswerable probe is not evidence of absence.
 */
export declare function probePeer(name: string, base?: string): PeerPresence;
/**
 * Probe whether {@link STEWARD_PACKAGE} is installed alongside this plugin.
 *
 * @returns the resolution state, never a throw.
 */
export declare function detectSteward(): PeerPresence;
//# sourceMappingURL=peers.d.ts.map