import { SWITCH_SEARCH_SETTINGS_NAMESPACE } from '../config.ts';
/** 老宿主 settings 服务面（结构化镜像，绝不 value-import 官方包）。 */
export interface LegacySettingsFace {
    register?: (ns: string, schema: unknown) => unknown;
    get?: (ns: string) => unknown;
    update?: (ns: string, patch: Record<string, unknown>) => Promise<unknown>;
}
/** 桥对 handleMethod 暴露的面。 */
export interface LegacySettingsBridge {
    /** 读命名空间文档（无文档/非对象 → undefined）。 */
    get(ns: string): Record<string, unknown> | undefined;
    /** 合并写命名空间文档；宿主拒绝时抛错（调用方转显式失败）。 */
    update(ns: string, patch: Record<string, unknown>): Promise<void>;
}
/**
 * 在老宿主上租约注册命名空间；返回**同步创建的可变 holder**，桥面在
 * `ctx.inject(['settings'], …)` 回调里填入。
 * @param ctx - 宿主插件上下文。
 */
export declare function installLegacySettingsBridge(ctx: object): BridgeState;
/** 命名空间文档（describe/mutate 响应的统一形状）。 */
export interface BridgeNamespaces {
    [SWITCH_SEARCH_SETTINGS_NAMESPACE]: Record<string, unknown>;
}
/** 桥运行时状态（revision 随每次成功写自增，客户端据此识别权威新值）。 */
export interface BridgeState {
    bridge: LegacySettingsBridge | undefined;
    revision: number;
}
/** 汇总命名空间文档：legacy 读盘上文档合并缺省；modern 返回空投影（writable=false）。 */
export declare function describeNamespaces(state: BridgeState): BridgeNamespaces;
/** 运行时叠加文档（≤0.1.5 专用）：不铺缺省，只回已写键；桥未咬合恒空。 */
export interface BridgeOverlayDocs {
    /** switch-search ns 原始已写文档（桥未咬合时 = {}）。 */
    search: Record<string, unknown>;
}
export declare function bridgeOverlay(state: BridgeState): BridgeOverlayDocs;
/** describe 响应。 */
export declare function settingsDescribe(state: BridgeState): {
    ok: boolean;
    namespaces: BridgeNamespaces;
    writable: boolean;
    revision: number;
};
/** mutate 请求载荷形状。 */
export interface MutatePayload {
    ns?: unknown;
    fields?: unknown;
}
/** 合并写命名空间；任何校验/宿主拒绝都显式失败，成功回权威文档。 */
export declare function settingsMutate(state: BridgeState, payload: unknown): Promise<{
    ok: boolean;
    error?: string;
    namespaces?: BridgeNamespaces;
    revision?: number;
}>;
//# sourceMappingURL=settings-bridge.d.ts.map