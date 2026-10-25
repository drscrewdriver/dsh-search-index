/**
 * DRS 语料源:dsh-reference-session-collector 投影库的 HTTP 只读客户端(T7.1)。
 *
 * 语料契约 = DRS 单条 fenced 路由 `GET /api/dsh-reference-session-collector`:
 * - `op=sessions&offset=&limit=` → `{ok, total, rows:[sessions 行]}`(分页);
 * - `op=session&session=<id>&fields=search` → `{ok, session, rows:[检索臂]}`。
 *
 * 字段对照(T7.0,DRS wire snake → steward 引擎列):
 *   sessions.version ← artifact_mtime_ms(水位代理:日志重写必 bump mtime);
 *   sessions.updated_at ← last_time_ms;title/cwd/archived ← 同名列;
 *   docs.type ← kind;docs.surface ← on_surface(1='current'/0='shadowed');
 *   docs.time ← time;docs.text ← search_text;index_text 由本引擎
 *   segmentForIndex 重算(自有切分面不动)。
 *
 * 自调用信任面:DRS 的 Host 门是精确匹配(trustedHosts 全小写比对),本客户
 * 端可带 hostHeader 显式回显首个 trustedHosts 条目,规避「条目省略端口而
 * URL 带端口」的精确匹配失配;loopback + 无 trustedHosts 的老宿主天然放行。
 */
/** DRS API 路径(与 dsh-reference-session-collector 的 DRS_API_PATH 字面一致;不跨包 import)。 */
export declare const DRS_API_PATH = "/api/dsh-reference-session-collector";
/** 语料列表分页大小(百会话级一轮 1-2 页;DRS 侧 offset/limit 透传)。 */
export declare const DRS_CORPUS_PAGE = 500;
/** 一个 DRS 会话头(watermark 代理 + 检索排序字段)。 */
export interface DrsCorpusHead {
    sessionId: string;
    version: number;
    title: string;
    cwd: string;
    updatedAt: number;
    archived: boolean;
}
/** 一个 DRS 检索臂文档(surface 已折算成引擎列的字符串域)。 */
export interface DrsCorpusDoc {
    seq: number;
    type: string;
    surface: 'current' | 'shadowed';
    time: number;
    text: string;
}
/** 一个 DRS 会话的完整语料(头 + docs)。 */
export interface DrsCorpusSession {
    head: DrsCorpusHead;
    docs: DrsCorpusDoc[];
}
export interface DrsCorpusSourceOptions {
    /** DRS API 基址(http://host[:port];解析序见 resolveDrsBaseUrl)。 */
    baseUrl: string;
    /** 注入面(单测);缺省全局 fetch。 */
    fetchImpl?: typeof fetch;
    /** 显式 Host 头(trustedHosts 首条回显;缺省不覆盖)。 */
    hostHeader?: string;
    log?: (message: string) => void;
}
/**
 * 基址解析:显式配置 > 首个 trustedHosts 条目(补 http:// 前缀)>
 * `http://127.0.0.1:8080`(宿主默认口;trustedHosts 缺席的老线 DRS 门本就放行)。
 */
export declare function resolveDrsBaseUrl(explicit: string | undefined, trustedHosts?: readonly string[]): string;
export declare class DrsCorpusSource {
    private readonly options;
    private readonly fetchImpl;
    constructor(options: DrsCorpusSourceOptions);
    /** 一个 GET 的 JSON 包络(ok!==true 或非 2xx 一律抛,由调用方回退 native)。 */
    private getJson;
    private static headOf;
    /** 全量语料头(内部翻页;rows 空或凑满 total 即止)。 */
    listSessions(): Promise<DrsCorpusHead[]>;
    /** 一个会话的检索臂 docs；DRS 无此会话（session:null）返回 undefined。 */
    readSession(sessionId: string): Promise<DrsCorpusSession | undefined>;
    /**
     * 分组内容搜索直连臂（op=search&group=session，DRS surface.searchGrouped 同构）：
     * 会话分组/加权/过滤/锚定节选全部在 DRS 侧完成，本方法只搬 wire →
     * 引擎命中形状（SwitchSearchHit 字段同名）。失败（网络/非 2xx/包络）直抛，
     * 调用侧按硬依赖语义显式报错——**不回退本地索引**。
     */
    searchGrouped(request: {
        query: string;
        /** 原事件 type 列表（调用方展开粗类）；空=DRS 缺省 user+assistant。 */
        kinds?: readonly string[];
        archived?: 'active' | 'archived' | 'all';
        from?: number;
        to?: number;
        sortBy?: 'relevance' | 'time';
        limit?: number;
        /** 命中展开（wire `expand=1`）：同会话多命中各自成行；缺省聚合。 */
        expand?: boolean;
        /** 同源 Host 覆盖（转发调用方请求头；优先于装配 baseUrl）。 */
        atHost?: string;
    }): Promise<{
        sessionId: string;
        title: string;
        seq: number;
        type: string;
        time: number;
        updatedAt: number;
        snippet: string;
    }[]>;
    /**
     * 触发 DRS 后台同步（`POST ?op=sync`）：慢速全扫，用于修复投影库自身的滞后。
     * **op 走 query**：DRS 的 POST 分发只读 `url.searchParams.get('op')`，落进 body 会
     * 400 `unknown POST op: (missing)`；body 仍为 `{op:'sync'}` 兼容早期只读体版本。
     * 与 op=status 的 `syncing`（新）/ `last_sync.busy`（旧）配合轮询。
     * @param atHost - 同源 Host 覆盖。
     */
    triggerSync(atHost?: string): Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** DRS 状态明细（op=status 原始体；失败返回 undefined）。 */
    statusDetail(atHost?: string): Promise<Record<string, unknown> | undefined>;
    /** 可性探针（op=status）：硬依赖预检/降级提示用；失败返回 false。 */
    probe(atHost?: string): Promise<boolean>;
}
//# sourceMappingURL=drs-source.d.ts.map