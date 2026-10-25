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
import type { Context } from 'cordis';
import { NS, translate, type LocaleKey } from './locales.ts';
export { NS as SWITCH_SEARCH_LOCALE_NAMESPACE, translate };
export type { LocaleKey };
/** 客户端插件声明的注入面。 */
export declare const inject: string[];
/** 底栏入口的 props（宿主给的结构子集）。 */
export interface SwitchFooterProps {
    wide?: boolean;
}
/**
 * 客户端插件主体。
 * @param ctx - 客户端上下文（slots、可选 locale / configForms / layout / conversation）。
 */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map