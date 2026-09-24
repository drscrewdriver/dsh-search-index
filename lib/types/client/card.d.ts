/**
 * Session-search settings card（0.1.7 起不再挂载：设置表单由 host 侧 .volatile() 字段自动生成）。
 * plugin, following the dsh-thinking-levels card pattern.
 *
 * The card binds the `switch-search` settings namespace through the
 * `settingsScope` cordis service and renders its fields as one editable card:
 * the enable switch, the default panel mode, the independent-index sync
 * knobs, and the index-lifecycle block (status, the non-destructive 整理
 * button, and the JSON snapshot export/import seam). Every change commits
 * immediately through the scope (no staged form).
 *
 * Kept dependency-free beyond react: the scope is subscribed with
 * `useSyncExternalStore`, and the controls are plain HTML reusing the
 * stylesheet the client half injects.
 */
import { type JSX } from 'react';
import type { SwitchSearchConfig } from '../config.ts';
import { type LocaleKey } from './locales.ts';
/**
 * Structural mirror of the settings scope (the plugin must not value- or
 * type-import a single release of the official settings packages).
 */
export interface SwitchCardScope {
    getSnapshot(): {
        status: 'loading' | 'ready' | 'unavailable';
        value: SwitchSearchConfig | undefined;
        revision: number | undefined;
        writable: boolean;
    };
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
}
/** Injected face the settings slot factory hands the card. */
export interface SearchSettingsCardInjected {
    scope: SwitchCardScope;
    /** Optional host dictionary lookup (present when the locale service exists). */
    t?: (key: LocaleKey, params?: Record<string, unknown>) => string;
}
/** Full card props. */
export type SearchSettingsCardProps = SearchSettingsCardInjected;
/**
 * The settings card body: a collapsed drawer shell (title + description +
 * chevron, thinking-levels pattern) expanding into the namespace fields and
 * the index-lifecycle block.
 * @param props - locale seat (optional) and the bound namespace scope.
 */
export declare function SearchSettingsCard(props: SearchSettingsCardProps): JSX.Element;
//# sourceMappingURL=card.d.ts.map