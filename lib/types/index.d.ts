/**
 * dsh-search-index host half: one fenced HTTP route `/switch-search/api`
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
import { SwitchIndexEngine } from './host/index/engine.ts';
import { SwitchWatermarkSync } from './host/index/sync.ts';
import { createArchiveSource } from './host/index/archive-source.ts';
export { createArchiveSource, type SwitchArchiveDiagnostics } from './host/index/archive-source.ts';
import { type SwitchIndexLayout, type SwitchRebuildState } from './host/index/rebuild.ts';
import type { SwitchRawEvent } from './host/index/extract.ts';
import { type SwitchSearchConfig } from './config.ts';
export { DEFAULT_CONFIG, SWITCH_SEARCH_SETTINGS_NAMESPACE } from './config.ts';
export type { SwitchSearchConfig } from './config.ts';
export { SwitchIndexEngine } from './host/index/engine.ts';
export { SwitchWatermarkSync } from './host/index/sync.ts';
export { rebuildIndex, importIntoIndex, recoverIndex, DEFAULT_INDEX_LAYOUT } from './host/index/rebuild.ts';
export { exportSnapshot, parseSnapshot } from './host/index/snapshot.ts';
/** The webServer service face this plugin uses (structural mirror). */
interface SwitchWebServer {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** The web runtime service face: bind-derived trusted authorities.
 *  0.2.1-a.2 起宿主把服务 `webRuntime` 更名为 `webStartup`；两代宿主通吃，
 *  读取面走双名回退链（见 apply 内 trustedRuntime）。 */
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
/**
 * The workspace registry face this plugin reads (structural mirror): the
 * official archive set. Read lazily — the registry may mount after plugins.
 */
interface SwitchWorkspaceRegistry {
    readonly archivedSessionIds: readonly string[];
}
declare module 'cordis' {
    interface Context {
        webServer: SwitchWebServer;
        /** 0.2.1-a.2+ 主名（本插件 inject 的服务）。 */
        webStartup: SwitchWebRuntime;
        /** 旧代宿主（≤0.2.0）遗留名，仅作双名回退链的兜底。 */
        webRuntime?: SwitchWebRuntime;
        sessionQuery?: SwitchSessionQuery;
        workspaceRegistry?: SwitchWorkspaceRegistry;
    }
}
/** Stable plugin name for the cordis row. */
export declare const name = "dsh-search-index";
/** Services required before mounting: the web server routes and the trust list.
 *  0.2.1-a.2 起 webRuntime 更名 webStartup；注入主名 webStartup，读取面走双名回退链。 */
export declare const inject: string[];
/** Composition-entry schema: what a dsh profile may configure at assembly time.
 *  0.1.7：volatile 字段即设置表单；`indexDir` 是部署路径，不走页面。 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    defaultMode: z<"title" | "content", "title" | "content", "volatile-defined">;
    autoSync: z<boolean, boolean, "volatile-defined">;
    syncIntervalMs: z<number, number, "volatile-defined">;
    archiveKeep: z<number, number, "volatile-defined">;
    indexDir: z<string, string, "defined">;
    corpusSource: z<"native" | "drs", "native" | "drs", "volatile-defined">;
    drsBaseUrl: z<string, string, "volatile-defined">;
    contentTransport: z<"auto" | "http" | "in-process", "auto" | "http" | "in-process", "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    defaultMode: z<"title" | "content", "title" | "content", "volatile-defined">;
    autoSync: z<boolean, boolean, "volatile-defined">;
    syncIntervalMs: z<number, number, "volatile-defined">;
    archiveKeep: z<number, number, "volatile-defined">;
    indexDir: z<string, string, "defined">;
    corpusSource: z<"native" | "drs", "native" | "drs", "volatile-defined">;
    drsBaseUrl: z<string, string, "volatile-defined">;
    contentTransport: z<"auto" | "http" | "in-process", "auto" | "http" | "in-process", "volatile-defined">;
}>>, "plain">;
/** ------------------------------------------------------------------ index service */
/** The per-activation index service state, carried in the apply closure. */
export interface SwitchIndexServiceState {
    engine: SwitchIndexEngine;
    sync: SwitchWatermarkSync;
    layout: SwitchIndexLayout;
    rebuild: SwitchRebuildState;
    /** Official archive-set reader (registry first, storage-hub file fallback). */
    archiveReader: ReturnType<typeof createArchiveSource>;
    /** 深度同步（DRS 慢速重建 → 本地索引重建）的可见状态；`drsSettled` 记 DRS 是否在 180s 内落定。 */
    deepSync: {
        state: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed';
        startedAt?: number;
        finishedAt?: number;
        error?: string;
        drsSettled?: boolean;
    };
}
/**
 * Plugin body: mount the fenced /switch-search/api route and own the independent
 * index lifecycle.
 * @param ctx - host plugin context (webServer, webStartup/webRuntime, optional sessionQuery).
 * @param entry - composition entry (0.1.7: `.volatile()` fields arrive as live refs).
 */
export declare function apply(ctx: Context, entry?: Partial<SwitchSearchConfig>): void;
//# sourceMappingURL=index.d.ts.map