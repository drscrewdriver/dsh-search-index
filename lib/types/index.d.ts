/**
 * dsh-session-search-toggle host half: one fenced HTTP route `/switch-search/api`
 * backed by the plugin's OWN full-text index (node:sqlite FTS5, a file this
 * plugin owns — never the official session-query index, which may be absent
 * entirely under its default `openAt: never`).
 *
 * - `list-sessions` — the title-search corpus: every session id + folded
 *   title (+ cwd/updatedAt), read live through `sessionQuery`, falling back to
 *   the independent index when the live service is unavailable.
 * - `content-search` — session-grouped message-content search over the
 *   independent index (docs mirrored from `sessionQuery.readSession` with the
 *   official extraction semantics).
 * - `index-status` / `index-rebuild` / `index-export` / `index-import` —
 *   the index lifecycle surface: watermark sync progress, the non-destructive
 *   整理 (rebuild into a shadow file + atomic swap + bounded archives), and
 *   the JSON Lines snapshot migration seam.
 *
 * The route is browser-trust fenced exactly like dsh-history's `/history/api`.
 */
import type { Context } from 'cordis';
import z from '@deepseek-ai/schemastery';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SwitchIndexEngine } from './host/engine.ts';
import { SwitchWatermarkSync } from './host/sync.ts';
import { type SwitchIndexLayout, type SwitchRebuildState } from './host/rebuild.ts';
import type { SwitchRawEvent } from './host/extract.ts';
import { type SwitchSearchConfig } from './config.ts';
export { DEFAULT_CONFIG, SWITCH_SEARCH_SETTINGS_NAMESPACE } from './config.ts';
export type { SwitchSearchConfig } from './config.ts';
export { SwitchIndexEngine } from './host/engine.ts';
export { SwitchWatermarkSync } from './host/sync.ts';
export { rebuildIndex, importIntoIndex, DEFAULT_INDEX_LAYOUT } from './host/rebuild.ts';
export { exportSnapshot, parseSnapshot } from './host/snapshot.ts';
/** The webServer service face this plugin uses (structural mirror). */
interface SwitchWebServer {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** The web runtime service face: bind-derived trusted authorities. */
interface SwitchWebRuntime {
    trustedHosts: readonly string[];
}
/** One session header shape the query service returns (structural subset). */
interface SwitchSessionHeader {
    id: string;
    version: number;
    createdAt: number;
    cwd?: string;
    parentSession?: string;
    seedLength?: number;
    delegationDepth?: number;
    agentPreset?: string;
}
/** One logical-session record (structural subset). */
interface SwitchSessionRecord {
    header: SwitchSessionHeader;
    live: boolean;
    persisted: boolean;
}
/** One title observation result (structural subset). */
interface SwitchTitleObservationResult {
    status: 'fulfilled' | 'rejected';
    value?: {
        session: SwitchSessionHeader;
        title?: {
            title: string;
        };
    };
    reason?: unknown;
}
/** One strongest matching event hit (structural subset). */
interface SwitchEventHit {
    sessionId: string;
    seq: number;
    type: string;
    time: number;
    surface: string;
    snippet: string;
}
/** One grouped cross-session search hit (structural subset). */
interface SwitchSearchHit {
    header: SwitchSessionHeader;
    live: boolean;
    persisted: boolean;
    bestMatch: SwitchEventHit;
}
/** One content-search page (structural subset). */
interface SwitchSearchPage {
    items: readonly SwitchSearchHit[];
    nextCursor?: string;
}
/** The session-query service face: corpus reads, title folding, FTS5 search. */
interface SwitchSessionQuery {
    listSessions(signal?: AbortSignal): Promise<readonly SwitchSessionRecord[]>;
    readSession?(sessionId: string): Promise<{
        session: SwitchSessionHeader;
        events: readonly SwitchRawEvent[];
    }>;
    readTitleSnapshots(sessionIds: readonly string[], signal?: AbortSignal): Promise<readonly SwitchTitleObservationResult[]>;
    searchSessions(request: {
        query: string;
        eventFilters?: readonly unknown[];
        limit?: number;
    }, exec?: {
        signal?: AbortSignal;
    }): Promise<SwitchSearchPage>;
}
declare module 'cordis' {
    interface Context {
        webServer: SwitchWebServer;
        webRuntime: SwitchWebRuntime;
        sessionQuery?: SwitchSessionQuery;
    }
}
/** Stable plugin name for the cordis row. */
export declare const name = "dsh-session-search-toggle";
/** Services required before mounting: the web server routes and the trust list. */
export declare const inject: string[];
/** Composition-entry schema: what a dsh profile may configure at assembly time. */
export declare const Config: z<SwitchSearchConfig>;
/** ------------------------------------------------------------------ index service */
/** The per-activation index service state, carried in the apply closure. */
export interface SwitchIndexServiceState {
    engine: SwitchIndexEngine;
    sync: SwitchWatermarkSync;
    layout: SwitchIndexLayout;
    rebuild: SwitchRebuildState;
}
/**
 * Plugin body: mount the fenced /switch-search/api route, own the independent
 * index lifecycle, and register the settings namespace.
 * @param ctx - host plugin context (webServer, webRuntime, optional sessionQuery).
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map