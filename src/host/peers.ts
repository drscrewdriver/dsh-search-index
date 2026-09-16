/**
 * Presence probe for the peer plugin that owns the archived-session domain.
 *
 * Why this exists
 * ---------------
 * This package *reads* the official archive set — archived sessions are
 * excluded from the index — but it no longer *owns* archiving: browsing and
 * disposing of archived sessions moved to `dsh-session-steward`. The settings
 * card went on reporting a bare archived count, with no pointer to the plugin
 * that can act on it. A number the user cannot act on, next to a capability
 * that lives somewhere else, reads as a broken feature.
 *
 * The pointer has to say different things depending on whether the owner is
 * actually installed, and only the host half can answer that: the client
 * bundle cannot resolve another package, and the slot registry exposes no
 * "is anything registered under this id" query.
 *
 * Three states, never two. A probe that cannot run must not be reported as
 * "missing" — that would tell the user to install something they already have.
 */
import { createRequire } from 'node:module'

/** Resolution outcome for a peer plugin package. */
export type PeerPresence = 'installed' | 'missing' | 'unknown'

/** The package that owns the archived-session domain. */
export const STEWARD_PACKAGE = 'dsh-session-steward'

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
export function probePeer(name: string, base: string = import.meta.url): PeerPresence {
  try {
    createRequire(base).resolve(name)
    return 'installed'
  } catch (err) {
    const code = (err as { code?: unknown } | null | undefined)?.code
    return code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND' ? 'missing' : 'unknown'
  }
}

/**
 * Probe whether {@link STEWARD_PACKAGE} is installed alongside this plugin.
 *
 * @returns the resolution state, never a throw.
 */
export function detectSteward(): PeerPresence {
  return probePeer(STEWARD_PACKAGE)
}
