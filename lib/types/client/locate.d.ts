/**
 * 命中定位臂（B 路线 v3，T7.4）：内容搜索点击打开会话后，把宿主会话视图 DOM
 * 里对应的那一行滚进视口并瞬时高亮。
 *
 * 前提实证（0.2.1 宿主前端包扫描）：会话列表**无虚拟化**（无 virtuoso/
 * react-window 指纹，IntersectionObserver 仅做 sticky 标题与入视口激活），
 * 打开会话后历史行全量在 DOM。宿主导航接口面无消息锚点
 * （uiWorkspace.openSession(SessionTarget) 全签名），DOM 文本匹配是唯一通路；
 * 一切失败静默退化为「仅打开」（绝不抛、绝不遮主流程）。
 *
 * v2 教训（真机「还停在底部」）：一次性 scrollIntoView 会被宿主会话打开后
 * 的贴底/滚动恢复覆盖——v3 改「巡逻-驻留」模型：每 TICK 重定位+补滚，
 * 目标行稳定驻留视口 STICK_MS 后才打高亮；用户手动滚动立即让位。
 *
 * v4 根因修正（宿主接口面实锤）：dsh-client-ui-conversation 的 IConversation
 * 暴露 loadOlder()（"Pull one older history page"）——历史是**分页**的，
 * 首轮视口外找不到的真实原因是目标行根本没挂载。巡逻循环每 N tick 调
 * 一次 loadOlder 往回翻页，直到目标 turn 的行进入 DOM 再驻留跳转；
 * 翻页能力经 configureLocator 由 client apply 注入（本模块不持 ctx）。
 *
 * 数据面：同源 GET /api/dsh-reference-session-collector?op=session&session=<id>
 * ——行含 seq/text/search_text/surface_text/on_surface/compressed：
 * - on_surface=0（被替换原文行）：GUI 不渲染该文本 → 放弃定位（不是失败）；
 * - compressed=1：GUI 渲染的是链解析后的 surface_text（替身文本）；
 * - 其余行优先 search_text（已剥宿主注入样板段=用户可见文本），退化 text。
 */
import type { HostContentHit } from './host-api.ts';
/** 热/冷分界：消息轨（tidy-display RailView）只索引最新往回这么多回合。 */
export declare const RAIL_INDEX_TURNS = 40;
/** 安全回溯护栏：超出这么多回合不自动翻页（过冷），仅打开会话。 */
export declare const MAX_BACKTRACK_TURNS = 200;
/** 深加载页数上限（页宽无法静态得知时的安全上界；命中即停，实际很少跑满）。
 * 导出供 panel 失败重试推导追加预算后的硬顶。 */
export declare const DEEP_MAX_PAGES = 40;
/** 归一化/取 needle 用的一个 DRS 段行（wire 蛇形，只声明消费字段）。 */
export interface LocateRowFace {
    seq: number;
    /** 行归属 turn（阅读模式 [data-reader-turn] 直接寻址键）。 */
    turn?: number;
    text?: string;
    search_text?: string;
    on_surface?: number;
    compressed?: number;
    surface_text?: string | null;
}
/** 归一化比对文本：去空白与 markdown 噪声字符。 */
export declare function normalizeForMatch(text: string): string;
/**
 * 从段行选一条可定位 needle（按纯函数导出，供单测）。
 * @returns 归一化 needle；null=该行不可定位（被替换原文/无有效文本/过短歧义）。
 */
export declare function resolveNeedle(row: LocateRowFace | undefined): string | null;
/** 命中的可达性档位。 */
export type HitClass = 'hot' | 'cold' | 'too-cold' | 'unknown';
/**
 * 按 turn_gap 分档：≤40 热（直接跳）、41..200 冷（确认+深加载）、>200 过冷
 * （不自动回溯）、undefined 未知（富化失败/老库，按热处理）。
 */
export declare function classifyHit(hit: {
    turnGap?: number;
}): HitClass;
/** 定位执行面（测试可注入假环境；缺省走真浏览器）。 */
export interface LocateEnv {
    fetchImpl?: typeof fetch;
    doc?: Document;
    win?: Window;
    timeoutMs?: number;
    log?: (message: string) => void;
    /** 覆盖注入的翻页供给（测试用）；缺省走 configureLocator 的全局注入。 */
    loadOlder?: () => Promise<boolean>;
    /** 深加载模式：冷数据确认后由 panel 置 true，放宽封顶并测页宽收紧预算。 */
    deep?: boolean;
    /** 显式页数预算（测试用）；缺省由 deep 标志与运行时页宽推导。 */
    pageBudget?: number;
    /** 翻页进度回调（已翻页数, 当前预算）。 */
    onProgress?: (pulled: number, budget: number) => void;
    /** 取消令牌：外部置 cancelled=true 时巡逻立即收手。 */
    cancel?: {
        cancelled: boolean;
    };
    /** 强制着陆：跳过 STICK 驻留窗判定（HUD「跳转」按钮二次调用用——目标已在 DOM，
     * 但要立即补滚+高亮，不等驻留期满）。 */
    forceLand?: boolean;
}
/** 外部能力注入面：client apply 期接线宿主会话服务，模块自身零 ctx 依赖。 */
export interface LocatorDeps {
    /** 拉一页更早历史；true=已发起（行数可能增），false=服务缺席/报错。 */
    loadOlder?: () => Promise<boolean>;
}
/** 接线点：client apply 调一次；未接线时定位退化为 v3 纯 DOM 巡逻。 */
export declare function configureLocator(deps: LocatorDeps): void;
/**
 * 点击豁免探测：拉 DRS 行→选 needle→单次 findMessageElement 判目标行是否已在 DOM。
 * 不滚动、不翻页；命中=true（用户已翻到过，算激活，可直接跳）。任何异常返回 false。
 */
export declare function probeHitInDom(hit: HostContentHit, env?: LocateEnv): Promise<boolean>;
/** 目标行是否基本完整落在**其滚动窗口**内由 landedInPort 判定；旧视口函数已废弃。 */
/**
 * 主管线：拉 DRS 段行 → 选 needle → 巡逻宿主 DOM 补滚 → 驻留后高亮。
 * fire-and-forget 语义：任何一步不满足都 resolve(false)，从不抛。
 */
export declare function locateSearchHit(hit: HostContentHit, env?: LocateEnv): Promise<boolean>;
//# sourceMappingURL=locate.d.ts.map