/**
 * Legacy 设置桥 scope（客户端半身，≤0.1.5 专用）。
 *
 * 为什么存在：旧宿主的 `settingsScope.bind()` 是数据死路（台账 A2——scope
 * status 永远 'unavailable'，永不就绪），卡在老线上只剩「不可用」空壳。本
 * 模块把卡片数据面改走自家 webServer 桥（`settings-describe`/`settings-mutate`，
 * 宿主半落在 legacy settings 租约上，context-compression 六格实证的持久化
 * 写路径）。0.1.7+ 不走此路——client/index.ts 的回退链里 configForms 原生
 * 句柄优先，桥只是 legacy 兜底。
 *
 * 形状纪律：快照对象只在状态真正变化时更换引用（useSyncExternalStore 的
 * getSnapshot 缓存语义）；describe 在首个 subscribe 时才发起（bundle 级
 * 无头测试只调 getSnapshot、不 subscribe，绝不触发 fetch）。
 */
import type { SwitchSearchConfig } from '../config.ts';
/** 单视图快照（StewardCardScope / SwitchCardScope 的结构交集）。 */
export interface BridgeSnapshot<V> {
    status: 'loading' | 'ready' | 'unavailable';
    value: V | undefined;
    revision: number | undefined;
    writable: boolean;
}
/** 卡片 scope 面（两张卡各自的结构化镜像的交集）。 */
export interface BridgeScope<V> {
    getSnapshot(): BridgeSnapshot<V>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
}
/** 搜索卡/搜索入口的桥 scope（命名空间 switch-search）。 */
export declare function searchBridgeScope(): BridgeScope<SwitchSearchConfig>;
/**
 * 原生句柄 + 桥的合成 scope：原生快照**在任意时刻**观测到 unavailable（出生
 * 死或 loading→死，0.1.7 上 steward 条目的 configForms 实测后者）就地读桥，
 * 不做 apply 期时序猜测。写侧同理：原生 unavailable 即走桥（桥在无 legacy
 * settings 服务的宿主上 set 会显式拒绝，卡片保持只读真值）。双订阅：桥的
 * describe 全页一次（模块单例），代价可忽略。
 */
export declare function withBridgeFallback<V extends object>(native: BridgeScope<V> | undefined, bridge: BridgeScope<V>): BridgeScope<V>;
//# sourceMappingURL=bridge-scope.d.ts.map