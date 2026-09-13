/**
 * The archived-sessions viewer — a centered dialog over the official archive
 * set as mirrored by the independent index, plus a batch cleanup mode:
 * multi-select rows, JS-confirm, and prune the ids from the canonical
 * storage hub's archivedSessionIds array.
 *
 * Rows never navigate: archived sessions are gone from the user's active
 * system, so there is nothing to open. Pruning edits the storage file
 * (backup + atomic replace) and needs a DSH restart for the host's
 * in-memory registry to reload it. Shared by the search panel's footer
 * entry and the settings card.
 */
import { type ReactElement } from 'react';
import { type LocaleKey } from './locales.ts';
/** The locale face handed to the panel (same seat as the card). */
export type ArchiveLocale = (key: LocaleKey, params?: Record<string, unknown>) => string;
/**
 * The archived-sessions viewer with batch cleanup.
 * @param props.t - optional host dictionary lookup.
 * @param props.onClose - close the dialog.
 */
export declare function ArchivePanel({ t, onClose, }: {
    t?: ArchiveLocale;
    onClose: () => void;
}): ReactElement;
//# sourceMappingURL=archive-panel.d.ts.map