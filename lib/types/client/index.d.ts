import type { Context } from 'cordis';
import { type SwitchSearchConfig } from '../config.ts';
import { NS, translate } from './locales.ts';
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
/** The client sessions service face: open a session from a search result. */
interface SwitchSessionsService {
    open(id: string): void;
}
/** The client settings-scope service face (structural subset). */
interface SwitchSettingsScope<T> {
    bind<T>(spec: {
        namespace: string;
    }): SwitchScopeLike<T>;
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
    register(ns: string, dicts: Partial<Record<string, Record<string, string>>>): () => void;
    register(ns: string, localeId: string, dicts: Record<string, string>): () => void;
    /**
     * Read-time translator bound to a namespace (host `dsh-client-locale`).
     * Needed for slot `label` thunks, which the owner re-reads per render so the
     * tab text follows locale switches without re-registration. Optional: older
     * hosts may expose `register` only, hence the guarded call site.
     */
    bind?(ns: string): (key: string, params?: Record<string, unknown>) => string;
}
declare module 'cordis' {
    interface Context {
        slots: SwitchSlotsService;
        sessions?: SwitchSessionsService;
        settingsScope?: SwitchSettingsScope<SwitchSearchConfig>;
        locale?: SwitchLocaleService;
    }
}
/** ------------------------------------------------------------------ plugin */
/** The child settings seat **under 「插件配置」** — the only settings seat we occupy. */
export declare const SETTINGS_CARD_SEAT = "settings.plugin.item";
/**
 * Sibling-tab seat (`settings.plugins.tab`). **Deliberately NOT registered.**
 *
 * Kept as a named constant because it is the seat this plugin used to also
 * occupy — registering both is what made the card appear twice (once next to
 * 「插件配置」 and once under it). If a future host line drops the child seat, the
 * right move is to re-derive the target seat from that host's source, not to
 * register both.
 */
export declare const SETTINGS_SIBLING_SEAT = "settings.plugins.tab";
/** Services required before mounting: the slot registry (others optional). */
export declare const inject: string[];
/**
 * Client plugin body: dictionaries, the plugin settings card, and the
 * (disabled upstream) footer search panel entry.
 * @param ctx - client plugin context (slots, optional locale/settingsScope/sessions).
 */
export declare function apply(ctx: Context): void;
export { NS as SWITCH_SEARCH_LOCALE_NAMESPACE, translate };
//# sourceMappingURL=index.d.ts.map