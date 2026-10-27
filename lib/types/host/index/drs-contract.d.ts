/**
 * DRS 通道契约（HTTP 臂 / 进程内臂共用）。
 *
 * 为什么单独成文，而不是写在 `drs-source.ts`：
 * - `drs-source.ts` 需要引用进程内臂（`DrsLocalArm`），`drs-local.ts` 又需要同样的
 *   错误类与命中形状；`instanceof` 判定要求两个文件拿到的是**同一个类实例**，
 *   类型导入不够。抽到这里即可让两边都只依赖契约，不互相依赖。
 *
 * 错误语义（`DrsFailureCode`）刻意做成多档而不是一句 `drs-unavailable`：
 * 「包没装」「库没建」「插件未激活」「版本不匹配」「宿主禁止浏览器访问」「路由不可达」「DRS 报错」
 * 是几种完全不同的处置动作，混成一句会直接把用户引到错误的修复路径
 * （历史上就出现过：403 被当成"没装 DRS"，用户重装也修不好）。
 */
/** 内容检索的通道选择（配置面 `contentTransport`）。 */
export type DrsTransport = 'auto' | 'http' | 'in-process';
/** 六档失败语义（客户端按 code 取本地化文案）。 */
export type DrsFailureCode = 
/** 宿主 web 层拒绝非 renderer 请求（DSH NEXT 桌面版默认行为）。 */
'browser-access-denied'
/** fetch 层失败：端口不通 / 连接被拒 / DNS。 */
 | 'drs-http-unreachable'
/** DRS 返回了非 2xx（非 403/404）或 ok=false。 */
 | 'drs-http-error'
/** 路由 404：DRSC 包已随本插件落地但**插件未激活**（宿主 bundles 只扫顶层依赖，
 * 传递依赖装得上不激活；`dsh.pluginDependencies` 声明宿主不消费）。 */
 | 'drs-not-activated'
/** 依赖包解析失败，或运行时缺 node:sqlite（Node < 22.5）。 */
 | 'drs-missing'
/** 投影库不存在 / 0 会话 / 版本串缺失（半建库）。 */
 | 'drs-empty'
/** 库 schema 与本包预期不符——只报错，绝不清库。 */
 | 'drs-schema-mismatch';
/** 一条会话分组命中（HTTP 臂与进程内臂逐字同形）。 */
export interface DrsSearchHit {
    sessionId: string;
    title: string;
    seq: number;
    type: string;
    /** 最强命中行的时间戳（非会话级）。 */
    time: number;
    /** 会话末活跃时间（排序键）。 */
    updatedAt: number;
    snippet: string;
}
/** 兼容别名：宿主侧（`index.ts`）已有同名结构类型，这里给契约一个一致的名字。 */
export type SwitchSearchHit = DrsSearchHit;
/** 通道探针结果（search-status 直接透出给卡片）。 */
export interface DrsProbe {
    ok: boolean;
    /** 当前实际可用通道；都不可用 → 'none'。 */
    mode: 'http' | 'in-process' | 'none';
    reason?: DrsFailureCode;
    /** HTTP 探针拿到 404：DRSC 路由缺席（插件未激活）——即使其它通道可用也如实标记。 */
    notActivated?: boolean;
    detail?: string;
    schemaVersion?: string;
    expected?: string;
    sessions?: number;
    dir?: string;
}
/** 通道不可用（带可判定的 code 与原始细节）。 */
export declare class DrsUnavailableError extends Error {
    readonly code: DrsFailureCode;
    readonly detail: string;
    constructor(code: DrsFailureCode, detail: string);
}
/**
 * 把任意失败归一成 `DrsUnavailableError`。
 *
 * 判别依据是 `drs-source.getJson` / `triggerSync` 的既有错误文案：
 * - `DRS ?op=… → HTTP 403`
 * - `DRS ?op=… → HTTP 500`
 * - `DRS ?op=…: fetch failed`
 * - `DRS ?op=…: ok=false(…)` / `响应非 JSON 对象`
 */
export declare function classifyDrsFailure(err: unknown): DrsUnavailableError;
/** 服务端兜底文案（与客户端 `card.drsReason.*` / `panel.contentErr.*` 同义）。 */
export declare function messageForDrsFailure(code: DrsFailureCode, detail?: string): string;
//# sourceMappingURL=drs-contract.d.ts.map