/**
 * 搜索子域 client 组件（原 dsh-search-index client 半身的面板部分）。
 *
 * 注册职责（侧栏入口 / 家族 tab / 插件页配置卡）在合并包的 client/index.ts；
 * 本文件只持有：样式表、悬浮搜索面板（标题/内容双模式）、侧栏 footer 按钮、
 * 唤出和弦绑定。
 *
 * The `locale` and config services are consumed structurally: when
 * the host release lacks them the footer falls back to the bundled zh
 * dictionary and the host-composition config layer.
 */
import { type ReactElement } from 'react';
import type { SwitchSearchConfig } from '../config.ts';
import { type SwitchSessionsService, type SwitchUiWorkspaceService } from './host-api.ts';
import type { SwitchCardScope } from './card.tsx';
import { type LocaleKey } from './locales.ts';
/** ------------------------------------------------------------------ types */
/** The client slots service face (structural subset used here). */
interface SwitchSlotsService {
    inject(key: string, callback: () => () => void, label?: string): () => void;
    register(options: {
        name: string;
        id?: string;
        key?: string;
        order?: number;
        store?: unknown;
        locale?: string;
        label?: string | (() => string);
        inject?: (actions: unknown) => unknown;
    }, component: unknown): () => void;
}
/**
 * The client sessions service face: open a session from a search result.
 * Defined in `host-api.ts` (shared with `openSessionThrough`); re-imported as
 * a type here for the cordis Context augmentation below.
 */
/** The client settings-scope service face (structural subset). */
interface SwitchSettingsScope<C> {
    bind(spec: {
        namespace: string;
    }): SwitchScopeLike<C>;
}
interface SwitchScopeLike<T> {
    getSnapshot(): {
        status: 'loading' | 'ready' | 'unavailable';
        value: T | undefined;
        revision: number | undefined;
        writable: boolean;
    };
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
}
/**
 * The client locale service face (structural mirror; the plugin must not
 * value- or type-import a single release of the official locale package).
 */
interface SwitchLocaleService {
    register(ns: string, dicts: Record<string, Record<string, string>>): () => void;
    register(ns: string, localeId: string, dicts: Record<string, string>): () => void;
    /**
     * Read-time translator bound to a namespace (host `dsh-client-locale`).
     * Needed for slot `label` thunks, which the owner re-reads per render so the
     * tab text follows locale switches without re-registration. Optional: older
     * hosts may expose `register` only, hence the guarded call site.
     */
    bind?(ns: string): (key: string, params?: Record<string, unknown>) => string;
}
/** The locale dictionary face the renderer may hand the card as `t`. */
type CardLocale = (key: LocaleKey, params?: Record<string, unknown>) => string;
/** The footer-action owner share (structural subset). */
interface SwitchFooterProps {
    wide: boolean;
}
declare module 'cordis' {
    interface Context {
        slots: SwitchSlotsService;
        sessions?: SwitchSessionsService;
        uiWorkspace?: SwitchUiWorkspaceService;
        settingsScope?: SwitchSettingsScope<SwitchSearchConfig>;
        locale?: SwitchLocaleService;
    }
}
/** Inject the plugin stylesheet once per activation (removed on disposal). */
export declare function injectStyles(): () => void;
/** ------------------------------------------------------------------ view */
/** The floating search panel. */
export declare function SwitchPanel({ t, onClose, open, variant, }: {
    t?: CardLocale;
    onClose: () => void;
    open: (sessionId: string) => void;
    /** `dialog` = 遮罩上的浮动面板（017-）；`page` = 填满主栏的整页（017+）。 */
    variant?: 'dialog' | 'page';
}): ReactElement;
/** The footer entry: one icon button that opens the search panel. */
export declare function SwitchFooter({ t, wide, open, scope, }: SwitchFooterProps & {
    t?: CardLocale;
    open: (sessionId: string) => void;
    scope?: SwitchCardScope;
}): ReactElement | null;
export {};
//# sourceMappingURL=panel.d.ts.map