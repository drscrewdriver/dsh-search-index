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