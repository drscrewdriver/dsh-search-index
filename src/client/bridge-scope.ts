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
import type { SwitchSearchConfig } from '../config.ts'
import { callHostAny } from './host-api.ts'

/** 与宿主 settings-bridge.ts 的命名空间键一致（存储键稳定承诺）。 */
const SEARCH_NS = 'switch-search'

/** 单视图快照（StewardCardScope / SwitchCardScope 的结构交集）。 */
export interface BridgeSnapshot<V> {
  status: 'loading' | 'ready' | 'unavailable'
  value: V | undefined
  revision: number | undefined
  writable: boolean
}

/** 卡片 scope 面（两张卡各自的结构化镜像的交集）。 */
export interface BridgeScope<V> {
  getSnapshot(): BridgeSnapshot<V>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/** 共享文档仓：两视图读同一份 describe/mutate 结果。 */
interface SharedDoc {
  search: Record<string, unknown>
  status: 'loading' | 'ready' | 'unavailable'
  writable: boolean
  revision: number | undefined
}

const shared: SharedDoc = {
  search: {},
  status: 'loading',
  writable: false,
  revision: undefined,
}

const listeners = new Set<() => void>()
let describeInFlight: Promise<void> | undefined

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      /* 单个订阅者异常绝不破坏其余通知 */
    }
  }
}

function replaceDoc(next: Partial<SharedDoc>): void {
  Object.assign(shared, next)
  notify()
}

/** 首个订阅触发一次 describe；并发调用共享同一 in-flight promise。 */
function ensureDescribe(): Promise<void> {
  if (describeInFlight !== undefined) return describeInFlight
  describeInFlight = callHostAny<{ ok?: boolean; writable?: boolean; revision?: number; namespaces?: Record<string, Record<string, unknown>>; error?: string }>(
    'settings-describe',
    {},
  )
    .then((res) => {
      if (res.ok === true && res.namespaces !== null && typeof res.namespaces === 'object') {
        replaceDoc({
            search: res.namespaces[SEARCH_NS] ?? {},
          status: 'ready',
          writable: res.writable === true,
          revision: typeof res.revision === 'number' ? res.revision : undefined,
        })
      } else {
        replaceDoc({ status: 'unavailable', writable: false })
      }
    })
    .catch(() => {
      replaceDoc({ status: 'unavailable', writable: false })
    })
    .finally(() => {
      describeInFlight = undefined
    })
  return describeInFlight
}

/** 组装一个视图 scope。`ns` 决定读/写哪个命名空间文档。 */
function makeBridgeScope<V extends object>(
  ns: string,
  keyOf: (doc: SharedDoc) => Record<string, unknown>,
): BridgeScope<V> {
  let snapshot: BridgeSnapshot<V> = { status: 'loading', value: undefined, revision: undefined, writable: false }

  const refresh = (): void => {
    const next: BridgeSnapshot<V> = {
      status: shared.status,
      value: (shared.status === 'ready' ? { ...keyOf(shared) } : undefined) as V | undefined,
      revision: shared.revision,
      writable: shared.writable,
    }
    const changed =
      next.status !== snapshot.status ||
      next.writable !== snapshot.writable ||
      next.revision !== snapshot.revision ||
      JSON.stringify(next.value ?? null) !== JSON.stringify(snapshot.value ?? null)
    if (changed) {
      snapshot = next
    }
  }

  return {
    getSnapshot: () => {
      // 每次读取都先对账共享仓再回缓存（引用稳定性由 refresh 的变更检测保证）；
      // 裸读（无 subscribe）只重算缓存，绝不触发 fetch。
      refresh()
      return snapshot
    },
    subscribe: (listener) => {
      listeners.add(listener)
      void ensureDescribe()
      return () => {
        listeners.delete(listener)
      }
    },
    set: async (field, value) => {
      if (shared.status !== 'ready' || shared.writable === false) {
        throw new Error('设置桥不可写（describe 未就绪或宿主只读）')
      }
      const before = keyOf(shared)[field]
      // 乐观回显：开关即时翻转，权威值由 mutate 响应修正。
      keyOf(shared)[field] = value
      refresh()
      const res = await callHostAny<{ ok?: boolean; revision?: number; namespaces?: Record<string, Record<string, unknown>>; error?: string }>(
        'settings-mutate',
        { ns, fields: { [field]: value } },
      )
      if (res.ok === true && res.namespaces !== null && typeof res.namespaces === 'object') {
        replaceDoc({
          search: res.namespaces[SEARCH_NS] ?? shared.search,
          revision: typeof res.revision === 'number' ? res.revision : shared.revision,
        })
      } else {
        // 失败回滚：开关弹回 = 用户可见的失败信号。
        keyOf(shared)[field] = before
        refresh()
        throw new Error(res.error ?? '设置写入失败')
      }
    },
  }
}

let searchScope: BridgeScope<SwitchSearchConfig> | undefined


/** 搜索卡/搜索入口的桥 scope（命名空间 switch-search）。 */
export function searchBridgeScope(): BridgeScope<SwitchSearchConfig> {
  searchScope ??= makeBridgeScope<SwitchSearchConfig>(SEARCH_NS, (doc) => doc.search)
  return searchScope
}

/**
 * 原生句柄 + 桥的合成 scope：原生快照**在任意时刻**观测到 unavailable（出生
 * 死或 loading→死，0.1.7 上 steward 条目的 configForms 实测后者）就地读桥，
 * 不做 apply 期时序猜测。写侧同理：原生 unavailable 即走桥（桥在无 legacy
 * settings 服务的宿主上 set 会显式拒绝，卡片保持只读真值）。双订阅：桥的
 * describe 全页一次（模块单例），代价可忽略。
 */
export function withBridgeFallback<V extends object>(
  native: BridgeScope<V> | undefined,
  bridge: BridgeScope<V>,
): BridgeScope<V> {
  if (native === undefined) return bridge
  return {
    getSnapshot: () => {
      const snap = native.getSnapshot()
      return snap.status === 'unavailable' ? bridge.getSnapshot() : snap
    },
    subscribe: (listener) => {
      const offNative = native.subscribe(listener)
      const offBridge = bridge.subscribe(listener)
      return () => {
        offNative()
        offBridge()
      }
    },
    set: async (field, value) => {
      if (native.getSnapshot().status === 'unavailable') return bridge.set(field, value)
      return native.set(field, value)
    },
  }
}
