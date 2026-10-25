/**
 * Watermark-driven incremental sync between the live-preferred sessionQuery
 * corpus and the independent switch-search index.
 *
 * One pass lists the logical corpus, diffs stored `version` watermarks, and
 * re-reads only new or changed sessions. Per-session failures are isolated and
 * reported; one broken log never stalls the whole sync.
 */
import type { SwitchIndexEngine } from './engine.ts';
import { type SwitchRawEvent } from './extract.ts';
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
    /** 补录后仍「有表头无正文」的行数（hollow 体检面,含合法真空会话）。 */
    hollow: number;
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
/** DRS 语料头(依赖倒置端口;真身 = drs-source.ts 的 DrsCorpusSource)。 */
export interface SwitchDrsCorpusHead {
    sessionId: string;
    /** 水位代理 = DRS sessions.artifact_mtime_ms(日志重写必 bump)。 */
    version: number;
    title: string;
    cwd: string;
    updatedAt: number;
    archived: boolean;
}
/** DRS 检索臂文档(surface 已折算引擎字符串域;切分由引擎重算)。 */
export interface SwitchDrsCorpusDoc {
    seq: number;
    type: string;
    surface: string;
    time: number;
    text: string;
}
/**
 * DRS 语料源端口(T7.1):corpusSource='drs' 时语料改从
 * dsh-reference-session-collector 投影库取,docs 直插引擎;不可达时整轮回退原生
 * sessionQuery + 文件兜底链路。单测注入普通对象。
 */
export interface SwitchDrsCorpusSource {
    listSessions(): Promise<readonly SwitchDrsCorpusHead[]>;
    readSession(sessionId: string): Promise<{
        head: SwitchDrsCorpusHead;
        docs: readonly SwitchDrsCorpusDoc[];
    } | undefined>;
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
    private readonly readSessionFromFile?;
    /**
     * 第三标题源（可选）:官方投影缓存里的 title 行。事件流没有 session/title
     * 的老会话,快照服务又整片不可用时,这是最后兜底。
     */
    private readonly readProjectionTitle?;
    /**
     * DRS 语料源（可选,T7.1）:提供时每轮先走 DRS 轮(docs 直插);DRS 整轮
     * 失败（网络/路由/包络）自动回退原生 sessionQuery + 文件兜底。
     */
    private readonly drsSource?;
    private running;
    /**
     * 本进程已确认「重读过且产出仍为 0 docs」的会话（键 id@version）。
     * 无可索引文本是合法终态——没有这份缓存,hollow 补录判据会把真空会话
     * 每轮完整重读一次（热循环）。宿主重启后缓存归零,最多各重读一次。
     */
    private readonly confirmedEmpty;
    private static emptyKey;
    private readonly state;
    /**
     * @param readSessionFromFile - 可选的**文件级兜底读取器**（管家 health 侧的
     * 多帧 zstd 读取器）：sessionQuery.readSession 对某些会话（典型:归档会话,
     * 或服务面退化）失败时改读转录文件。返回 undefined 表示文件也不可用。
     */
    constructor(engine: SwitchIndexEngine, sessionQuery: SwitchSyncSessionQuery, readArchiveSource?: (() => SwitchArchiveSource | undefined) | undefined, log?: ((msg: string) => void) | undefined, readSessionFromFile?: ((sessionId: string) => Promise<{
        session: {
            id: string;
            version: number;
            createdAt?: number;
            cwd?: string;
        };
        events: readonly SwitchRawEvent[];
    } | undefined>) | undefined, 
    /**
     * 第三标题源（可选）:官方投影缓存里的 title 行。事件流没有 session/title
     * 的老会话,快照服务又整片不可用时,这是最后兜底。
     */
    readProjectionTitle?: ((sessionId: string) => string) | undefined, 
    /**
     * DRS 语料源（可选,T7.1）:提供时每轮先走 DRS 轮(docs 直插);DRS 整轮
     * 失败（网络/路由/包络）自动回退原生 sessionQuery + 文件兜底。
     */
    drsSource?: SwitchDrsCorpusSource | undefined);
    /**
     * 读取一个会话的日志:服务面优先,失败落文件兜底。两条路都失败时抛最后
     * 一个错误,由调用方按会话隔离记失败。
     */
    private readSessionLog;
    /** Current progress snapshot (cloned). */
    snapshot(): SwitchSyncState;
    /**
     * Fold titles for an explicit id set without running a full pass.
     *
     * Used by the `session/title` event listener so a rename lands immediately
     * rather than at the next poll. It deliberately leaves watermarks alone: a
     * title-only refresh can never make the index claim content it has not read,
     * and the next poll still re-ingests the session off its bumped version.
     * Safe for unknown ids — the header write is a no-op when no row exists.
     * @param sessionIds - sessions whose titles should be re-folded.
     */
    refreshTitles(sessionIds: readonly string[]): Promise<void>;
    /**
     * Run one incremental pass (or await the running one).
     * @returns the state after the pass completes.
     */
    poll(): Promise<SwitchSyncState>;
    private runPass;
    /**
     * DRS 语料轮(T7.1):语料头从 DRS `op=sessions` 分页拉取,水位
     * diff(version=artifact_mtime_ms)后按会话 `op=session&fields=search`
     * 取检索臂 docs 直插引擎(upsertSessionDocs)。归档集合改用 DRS 行的
     * archived 旗标(DRS sync 本就只读跟随 workspace.json,同源);标题直接
     * 采 DRS 行(投影侧同一 extractTitleFromEvents 视界),不再走快照精修。
     * 每会话失败隔离语义与原生轮一致;无可索引文本仍进 confirmedEmpty 缓存。
     */
    private runDrsPass;
    /**
     * Fold latest titles for changed sessions into the index header rows.
     *
     * beta.4 教训:整批一次调用,任何一个坏 id（典型:归档 id）让整个 promise
     * reject,catch 一吞就是**全部**标题丢失。改为分块 + 块失败时逐 id 重试 ——
     * 单点坏 id 最多损失它自己的精修标题（入索引时的 extractTitleFromEvents
     * 基础层仍然在）。
     */
    private backfillTitles;
}
//# sourceMappingURL=sync.d.ts.map