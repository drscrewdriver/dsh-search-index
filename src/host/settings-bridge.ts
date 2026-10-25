/**
 * Legacy 设置桥（宿主半身，≤0.1.5 专用）：老宿主的服务端 settings 服务保留
 * register/get/update 三件套 —— context-compression legacy 租约（六格实证
 * POST 200 + 持久化）验证过的持久化写路径。0.1.7+ 宿主删掉 register，本桥在
 * 那些线上解析为 undefined，describe/mutate 降级为「显式拒绝写」。
 *
 * 命名空间：`switch-search`（存储键稳定承诺）。schema 必须**纯 plain**
 * （不 withVolatile）—— volatile 节点会被 legacy register 拒收。
 *
 * 同一 settings 服务上重复 apply（HMR / 双 loader 行）的防重：Symbol.for 键挂
 * 在服务对象上，首见者注册，后来者直接共享。
 */
import z from '@deepseek-ai/schemastery'
import {
  SWITCH_SEARCH_SETTINGS_NAMESPACE,
  SWITCH_DEFAULT_CONFIG,
} from '../config.ts'

/** 老宿主 settings 服务面（结构化镜像，绝不 value-import 官方包）。 */
export interface LegacySettingsFace {
  register?: (ns: string, schema: unknown) => unknown
  get?: (ns: string) => unknown
  update?: (ns: string, patch: Record<string, unknown>) => Promise<unknown>
}

/** 桥对 handleMethod 暴露的面。 */
export interface LegacySettingsBridge {
  /** 读命名空间文档（无文档/非对象 → undefined）。 */
  get(ns: string): Record<string, unknown> | undefined
  /** 合并写命名空间文档；宿主拒绝时抛错（调用方转显式失败）。 */
  update(ns: string, patch: Record<string, unknown>): Promise<void>
}

const SHARED_LEASE = Symbol.for('dsh-search-index/legacy-settings-bridge')

/** 搜索命名空间 schema（纯 plain，无 volatile —— 老线 register 拒收 volatile 节点）。 */
const SwitchNsSchema = z.object({
  enabled: z.boolean().default(true),
  defaultMode: z.union(['title', 'content']).default('title'),
  autoSync: z.boolean().default(true),
  syncIntervalMs: z.number().default(30_000),
  archiveKeep: z.number().default(2),
  indexDir: z.string().default(''),
  corpusSource: z.union(['native', 'drs']).default('drs'),
  drsBaseUrl: z.string().default(''),
})

/** settings.get 返回值是否像一份文档（老宿主对未写过的 ns 可能回 undefined）。 */
function asDoc(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * 在老宿主上租约注册命名空间；返回**同步创建的可变 holder**，桥面在
 * `ctx.inject(['settings'], …)` 回调里填入。
 * @param ctx - 宿主插件上下文。
 */
export function installLegacySettingsBridge(ctx: object): BridgeState {
  const state: BridgeState = { bridge: undefined, revision: 0 }
  const injectFn = (ctx as { inject?: (services: string[], cb: (sctx: Record<string, unknown>) => void) => void }).inject
  if (typeof injectFn !== 'function') return state
  try {
    injectFn.call(ctx, ['settings'], (sctx) => {
      try {
        const settings = sctx?.settings as LegacySettingsFace | undefined
        if (settings === undefined || typeof settings.register !== 'function') return
        const carrier = settings as LegacySettingsFace & { [SHARED_LEASE]?: true }
        if (carrier[SHARED_LEASE] !== true) {
          settings.register(SWITCH_SEARCH_SETTINGS_NAMESPACE, SwitchNsSchema)
          try {
            Object.defineProperty(carrier, SHARED_LEASE, {
              configurable: false,
              enumerable: false,
              writable: false,
              value: true,
            })
          } catch {
            /* 服务对象冻结时无法钉标记：退化为可能重复注册（幂等宿主无碍） */
          }
        }
        state.bridge = {
          get: (ns) => {
            try {
              return asDoc(settings.get?.(ns))
            } catch {
              return undefined
            }
          },
          update: async (ns, patch) => {
            await settings.update?.(ns, patch)
          },
        }
        console.log(`[switch-search] legacy settings bridge engaged (${SWITCH_SEARCH_SETTINGS_NAMESPACE})`)
      } catch (err) {
        console.log(`[switch-search] legacy settings bridge FAILED (cards degrade to read-only): ${String(err instanceof Error ? err.message : err)}`)
      }
    })
  } catch {
    /* ctx 无 inject（异常宿主）：保持空桥 */
  }
  return state
}

/** 单字段校验器：通过返回清洗后的值，否则返回错误文案。 */
type FieldVerdict = { ok: true; value: unknown } | { ok: false; error: string }

function asBoolean(v: unknown): FieldVerdict {
  return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false, error: '期望布尔值' }
}

/** 命名空间允许写入的字段与校验（未列出的字段一律拒绝——桥不是任意写缝）。 */
const FIELD_VALIDATORS: Record<string, Record<string, (v: unknown) => FieldVerdict>> = {
  [SWITCH_SEARCH_SETTINGS_NAMESPACE]: {
    enabled: asBoolean,
    defaultMode: (v) => (v === 'title' || v === 'content' ? { ok: true, value: v } : { ok: false, error: 'defaultMode 只接受 title|content' }),
    autoSync: asBoolean,
    syncIntervalMs: (v) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, error: 'syncIntervalMs 必须是有限数字' }
      return { ok: true, value: Math.min(3_600_000, Math.max(5_000, Math.round(v))) }
    },
    archiveKeep: (v) => {
      if (typeof v !== 'number' || !Number.isInteger(v)) return { ok: false, error: 'archiveKeep 必须是整数' }
      return { ok: true, value: Math.min(20, Math.max(0, v)) }
    },
    indexDir: (v) => {
      if (typeof v !== 'string') return { ok: false, error: 'indexDir 必须是字符串' }
      const trimmed = v.trim()
      if (trimmed.length > 500) return { ok: false, error: 'indexDir 过长（>500 字符）' }
      return { ok: true, value: trimmed }
    },
    corpusSource: (v) => (v === 'native' || v === 'drs' ? { ok: true, value: v } : { ok: false, error: 'corpusSource 只接受 native|drs' }),
    drsBaseUrl: (v) => {
      if (typeof v !== 'string') return { ok: false, error: 'drsBaseUrl 必须是字符串' }
      const trimmed = v.trim()
      if (trimmed.length > 500) return { ok: false, error: 'drsBaseUrl 过长（>500 字符）' }
      return { ok: true, value: trimmed }
    },
  },
}

/** 命名空间文档（describe/mutate 响应的统一形状）。 */
export interface BridgeNamespaces {
  [SWITCH_SEARCH_SETTINGS_NAMESPACE]: Record<string, unknown>
}

/** 桥运行时状态（revision 随每次成功写自增，客户端据此识别权威新值）。 */
export interface BridgeState {
  bridge: LegacySettingsBridge | undefined
  revision: number
}

/** 汇总命名空间文档：legacy 读盘上文档合并缺省；modern 返回空投影（writable=false）。 */
export function describeNamespaces(state: BridgeState): BridgeNamespaces {
  const { bridge } = state
  if (bridge !== undefined) {
    return {
      [SWITCH_SEARCH_SETTINGS_NAMESPACE]: { ...SWITCH_DEFAULT_CONFIG, ...(bridge.get(SWITCH_SEARCH_SETTINGS_NAMESPACE) ?? {}) },
    }
  }
  return { [SWITCH_SEARCH_SETTINGS_NAMESPACE]: {} }
}

/** 运行时叠加文档（≤0.1.5 专用）：不铺缺省，只回已写键；桥未咬合恒空。 */
export interface BridgeOverlayDocs {
  /** switch-search ns 原始已写文档（桥未咬合时 = {}）。 */
  search: Record<string, unknown>
}

export function bridgeOverlay(state: BridgeState): BridgeOverlayDocs {
  const { bridge } = state
  if (bridge === undefined) return { search: {} }
  return {
    search: bridge.get(SWITCH_SEARCH_SETTINGS_NAMESPACE) ?? {},
  }
}

/** describe 响应。 */
export function settingsDescribe(state: BridgeState): {
  ok: boolean
  namespaces: BridgeNamespaces
  writable: boolean
  revision: number
} {
  return {
    ok: true,
    namespaces: describeNamespaces(state),
    writable: state.bridge !== undefined,
    revision: state.revision,
  }
}

/** mutate 请求载荷形状。 */
export interface MutatePayload {
  ns?: unknown
  fields?: unknown
}

/** 合并写命名空间；任何校验/宿主拒绝都显式失败，成功回权威文档。 */
export async function settingsMutate(
  state: BridgeState,
  payload: unknown,
): Promise<{ ok: boolean; error?: string; namespaces?: BridgeNamespaces; revision?: number }> {
  if (state.bridge === undefined) {
    return { ok: false, error: '本宿主无 legacy settings 服务（0.1.7+ 走 configForms 原生句柄），桥不可写' }
  }
  const request = (payload ?? {}) as MutatePayload
  if (typeof request.ns !== 'string' || !(request.ns in FIELD_VALIDATORS)) {
    return { ok: false, error: `未知设置命名空间：${String(request.ns)}` }
  }
  if (request.fields === null || typeof request.fields !== 'object' || Array.isArray(request.fields)) {
    return { ok: false, error: 'fields 必须是对象' }
  }
  const validators = FIELD_VALIDATORS[request.ns]
  const clean: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(request.fields as Record<string, unknown>)) {
    const validate = validators[field]
    if (validate === undefined) return { ok: false, error: `命名空间 ${request.ns} 不接受字段 "${field}"` }
    const verdict = validate(value)
    if (verdict.ok !== true) return { ok: false, error: `${field}: ${verdict.error}` }
    clean[field] = verdict.value
  }
  if (Object.keys(clean).length === 0) return { ok: false, error: 'fields 为空' }
  try {
    await state.bridge.update(request.ns, clean)
  } catch (err) {
    return { ok: false, error: `宿主拒绝写入：${String(err instanceof Error ? err.message : err)}` }
  }
  state.revision += 1
  return { ok: true, namespaces: describeNamespaces(state), revision: state.revision }
}
