/**
 * dsh-search-index 客户端半身：入口双形态 + 设置卡 + 字典/样式。
 *
 * **017 分代**（用户定标）：
 * - 宿主声明了 `sidebar.workspaces.session.menu.item`（0.1.7 线实证存在，0.1.5 线没有）
 *   且 `main` 席位在场 → 走「官方插件页式」：`sidebar.panellist` 行（order 5，落在
 *   「插件」0 之后、「会话管理」6 之前）+ `main` 整页（key = `dsh-search-index`），
 *   点行 / `Ctrl+K` → `layout.selectPanel`；
 * - 否则（< 0.1.7）→ 原样弹窗：`sidebar.footer.action` 入口（order 5）+ `SwitchPanel`
 *   dialog 形态；`Ctrl+K` 由入口组件自己绑定。
 *
 * 两形态互斥：席位探测用 `inject`（声明即回调），接线期不 sync，就绪后一次性决定；
 * 席位后到时就地撤掉另一形态。`enabled=false` 时整对注销。
 */
import type { Context } from 'cordis'
import { createElement, useSyncExternalStore, type ReactElement } from 'react'
import type { SwitchSearchConfig } from '../config.ts'
import { SearchSettingsCard, type SwitchCardScope } from './card.tsx'
import { searchBridgeScope, withBridgeFallback, type BridgeScope } from './bridge-scope.ts'
import { dictionaries, NS, translate, type LocaleKey } from './locales.ts'
import { injectStyles, SwitchFooter, SwitchPanel } from './panel.tsx'
import { openSessionThrough } from './host-api.ts'
import { configureLocator } from './locate.ts'
import { isInvokeChord, LABELS } from './platform.ts'

export { NS as SWITCH_SEARCH_LOCALE_NAMESPACE, translate }
export type { LocaleKey }

/** 设置 scope（configForms 原生句柄 / legacy 桥的结构交集）。 */
type SettingsScope = BridgeScope<SwitchSearchConfig> & { set(field: string, value: unknown): Promise<void> }

/** 槽位服务面（结构化镜像）。 */
interface SwitchSlotsService {
  inject(name: string, callback: () => unknown, label?: string): () => void
  register(config: Record<string, unknown>, component: unknown): unknown
  entries(name: string): Array<{ options: { id?: string; key?: string; order?: number; label?: unknown } }>
  getVersion(name: string): number
  subscribe(name: string, listener: () => void): () => void
}

/** locale 服务面。 */
interface SwitchLocaleService {
  register(ns: string, dicts: Record<string, Record<string, string>>): () => void
  bind?(ns: string): (key: LocaleKey, params?: Record<string, unknown>) => string
}

/** configForms 服务面（0.1.7：以 profile entry id 取句柄）。 */
interface SwitchConfigForms {
  get<U>(entryId: string): SettingsScope & { getSnapshot(): { value: U | undefined } }
}

/** 客户端插件声明的注入面。 */
export const inject = ['slots', 'locale']

/** 底栏入口的 props（宿主给的结构子集）。 */
export interface SwitchFooterProps {
  wide?: boolean
}

/** 017+ 页 id / 面板行 id / main key（同一值）。 */
const PANEL_ID = 'dsh-search-index'
/** 面板行与底栏入口的 order：落在「插件」(0) 之后、「会话管理」(6) 之前。 */
const ENTRY_ORDER = 5
/** 顶栏工具槽位（面板行列表）。 */
const PANEL_SEAT = 'sidebar.panellist'
/** 主栏整页槽位（keyed）。 */
const MAIN_SEAT = 'main'
/** 017 代际信号：0.1.7 线起声明的会话菜单子席位（0.1.5 线无）。 */
const GEN_017_SEAT = 'sidebar.workspaces.session.menu.item'

/**
 * 入口按钮壳：把设置 scope 绑到搜索入口组件上（底栏弹窗形态）。
 * @param props - 宿主给的槽位 props + 绑定面。
 */
function FooterEntry(props: SwitchFooterProps & {
  scope?: SwitchCardScope
  open: (sessionId: string) => void
}): ReactElement {
  return createElement(SwitchFooter, {
    wide: props.wide === true,
    open: props.open,
    scope: props.scope,
  })
}

/**
 * 整页形态：搜索面板占满主栏（017+）。
 * @param props - 关闭动作 + 打开会话回调（真实导航，不是空函数）。
 */
function SearchPage(props: { onClose: () => void; openSession: (sessionId: string) => void }): ReactElement {
  return createElement(SwitchPanel, {
    variant: 'page',
    onClose: props.onClose,
    // 点结果：先退回会话（卸载本页），再打开目标会话；定位巡逻在模块级继续。
    open: (sessionId: string) => {
      props.onClose()
      props.openSession(sessionId)
    },
  })
}

/**
 * 客户端插件主体。
 * @param ctx - 客户端上下文（slots、可选 locale / configForms / layout / conversation）。
 */
export function apply(ctx: Context): void {
  ctx.effect(() => injectStyles(), 'dsh-search-index: stylesheet')

  const locale = ctx.get('locale') as SwitchLocaleService | undefined
  if (locale !== undefined && typeof locale.register === 'function') {
    ctx.effect(() => locale.register(NS, dictionaries), 'dsh-search-index: dictionaries')
  }

  // 设置面回退链：configForms 原生句柄优先，观测到 unavailable 就地落桥（A2 死路）。
  const configForms = ctx.get('configForms') as SwitchConfigForms | undefined
  const bound = withBridgeFallback(
    configForms?.get<SwitchSearchConfig>(PANEL_ID) as BridgeScope<SwitchSearchConfig> | undefined,
    searchBridgeScope(),
  )

  const slots = ctx.get('slots') as SwitchSlotsService | undefined
  if (slots === undefined) return

  /** 设置快照（缺字段按缺省；用于入口可见性）。 */
  const useConfig = (): SwitchSearchConfig => {
    const snapshot = useSyncExternalStore(
      (listener) => bound.subscribe(listener),
      () => bound.getSnapshot(),
    )
    return (snapshot.value ?? {}) as SwitchSearchConfig
  }

  // 结果点击：host-api 内解析 uiWorkspace.openSession / sessions.open（惰性取）。
  const openHit = (sessionId: string): void => {
    openSessionThrough((name) => ctx.get(name), sessionId)
  }

  // 命中定位翻页供给（巡逻可用宿主历史分页往回拉）。
  configureLocator({
    loadOlder: async (): Promise<boolean> => {
      try {
        const conv = ctx.get('conversation') as { loadOlder?: () => Promise<void> } | undefined
        if (conv === undefined || typeof conv.loadOlder !== 'function') return false
        await conv.loadOlder()
        return true
      } catch {
        return false
      }
    },
  })

  /** 回退到会话（017+ 页内关闭 / 快捷键占位）。 */
  const closePage = (): void => {
    try {
      const layout = ctx.get('layout') as { selectPanel?: (id: string | null) => void } | undefined
      layout?.selectPanel?.(null)
    } catch { /* 布局服务缺席：留在页内，用户可点「会话」行返回 */ }
  }

  /** 打开 017+ 页（点行之外的另一条路：快捷键）。 */
  const openPage = (): void => {
    try {
      const layout = ctx.get('layout') as { selectPanel?: (id: string | null) => void } | undefined
      layout?.selectPanel?.(PANEL_ID)
    } catch { /* 同上 */ }
  }

  // ── 入口双形态：席位探测 + 一次性 sync ────────────────────────────────
  ctx.effect(() => {
    let gen017 = false
    let mainSeat = false
    let wired = false
    let footerOff: (() => void) | undefined
    let pageOff: (() => void) | undefined
    let chordOff: (() => void) | undefined

    const mountPage = (): (() => void) => {
      const row = slots.inject(PANEL_SEAT, () => slots.register({
        name: PANEL_SEAT,
        id: PANEL_ID,
        order: ENTRY_ORDER,
        label: () => translate(locale?.bind?.(NS), 'card.title'),
        locale: NS,
      }, () => createElement(SearchIcon, {})), 'dsh-search-index: sidebar tool row')
      const page = slots.inject(MAIN_SEAT, () => slots.register({
        name: MAIN_SEAT,
        key: PANEL_ID,
        locale: NS,
      }, () => createElement(PageHost, { onClose: closePage, openSession: openHit })), 'dsh-search-index: main page')
      return () => { page(); row() }
    }

    const mountFooter = (): (() => void) => slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: PANEL_ID, order: ENTRY_ORDER, locale: NS },
      (props: SwitchFooterProps) => createElement(FooterEntry, {
        ...props,
        scope: bound as unknown as SwitchCardScope,
        open: openHit,
      }),
    ), 'dsh-search-index: sidebar footer entry')

    const sync = (): void => {
      const pageReady = gen017 && mainSeat
      if (pageReady && pageOff === undefined) {
        if (footerOff !== undefined) { const off = footerOff; footerOff = undefined; off() }
        pageOff = mountPage()
        // 017+：快捷键直接切主栏页（底栏入口不在了，弹窗也不该偷偷开）。
        chordOff = bindInvokeChord(() => { openPage() })
        return
      }
      if (!pageReady && footerOff === undefined && pageOff === undefined) {
        footerOff = mountFooter()
      }
    }

    const onSeat = (): void => { if (wired) sync() }

    const offGen = slots.inject(GEN_017_SEAT, () => {
      gen017 = true
      onSeat()
      return () => { gen017 = false }
    }, 'dsh-search-index: probe 017 seat')

    const offMain = slots.inject(MAIN_SEAT, () => {
      mainSeat = true
      onSeat()
      return () => { mainSeat = false }
    }, 'dsh-search-index: probe main seat')

    wired = true
    sync()

    return () => {
      offGen()
      offMain()
      if (chordOff !== undefined) { const off = chordOff; chordOff = undefined; off() }
      if (footerOff !== undefined) { const off = footerOff; footerOff = undefined; off() }
      if (pageOff !== undefined) { const off = pageOff; pageOff = undefined; off() }
    }
  }, 'dsh-search-index: sidebar entry')

  // 可见性：enabled=false 时入驻口整对撤下（与设置卡同源）。
  ctx.effect(() => {
    let off: (() => void) | undefined
    const apply = (): void => {
      const enabled = bound.getSnapshot().value?.enabled !== false
      if (!enabled && off !== undefined) { const fn = off; off = undefined; fn() }
    }
    apply()
    const unsubscribe = bound.subscribe(apply)
    return () => { unsubscribe(); if (off !== undefined) off() }
  }, 'dsh-search-index: entry gate')

  // 插件族共用设置 tab（dsh-thinking-levels 的顶级「起子插件设置」节声明该子席位）。
  slots.inject('dsh-family.tab', () => slots.register(
    {
      name: 'dsh-family.tab',
      id: PANEL_ID,
      order: 30,
      label: () => translate(locale?.bind?.(NS), 'card.title'),
      locale: NS,
    },
    (props: { t?: (key: LocaleKey, params?: Record<string, unknown>) => string }) => createElement(SearchSettingsCard, {
      scope: bound as unknown as SwitchCardScope,
      t: props.t,
    }),
  ), 'dsh-search-index: family settings tab')

  // Plugins 页配置卡（key = 包名，0.1.7 宿主的 Plugins 页只渲染 key 与包名相等的条目）。
  slots.inject('plugins.bundle.config', () => slots.register(
    { name: 'plugins.bundle.config', key: PANEL_ID },
    (props: { t?: (key: LocaleKey, params?: Record<string, unknown>) => string }) => createElement(SearchSettingsCard, {
      scope: bound as unknown as SwitchCardScope,
      t: props.t,
    }),
  ), 'dsh-search-index: plugins page config card')

  // 让 useConfig 不被 tree-shake 掉（设置快照读取是入口可见性的备用路径）。
  void useConfig
}

/** 017+ 页宿主：把 closePage / 打开会话绑进 SwitchPanel（page 形态）。 */
function PageHost(props: { onClose: () => void; openSession: (sessionId: string) => void }): ReactElement {
  return SearchPage({ onClose: props.onClose, openSession: props.openSession })
}

/** 顶栏行图标：放大镜（随行字色）。 */
function SearchIcon({ size }: { size?: number }): ReactElement {
  const edge = size ?? 16
  return createElement('svg', {
    width: edge, height: edge, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
  },
  createElement('circle', { cx: 7, cy: 7, r: 4.5, stroke: 'currentColor', strokeWidth: 1.75, fill: 'none' }),
  createElement('path', { d: 'M10.5 10.5 L14 14', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' }))
}

/**
 * 绑定调出快捷键（Ctrl/⌘+K）——只用于 017+（017- 由 SwitchFooter 自己绑）。
 * @param open - 命中快捷键时的动作。
 * @returns 解绑函数。
 */
function bindInvokeChord(open: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const onKey = (event: KeyboardEvent): void => {
    if (!isInvokeChord(event, LABELS.isMac)) return
    event.preventDefault()
    open()
  }
  document.addEventListener('keydown', onKey)
  return () => { document.removeEventListener('keydown', onKey) }
}
