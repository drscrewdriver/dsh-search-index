/**
 * The archived-sessions viewer — a read-only centered dialog over the
 * official archive set as mirrored by the independent index.
 *
 * The official backend has no unarchive endpoint (workspace-controller ships
 * only archiveSession), so the panel browses and opens; it never mutates.
 * Shared by the search panel's footer entry and the settings card.
 */
import { type ReactElement } from 'react';
import { type LocaleKey } from './locales.ts';
/** The locale face handed to the panel (same seat as the card). */
export type ArchiveLocale = (key: LocaleKey, params?: Record<string, unknown>) => string;
/**
 * The archived-sessions viewer.
 * @param props.t - optional host dictionary lookup.
 * @param props.onClose - close the dialog.
 * @param props.open - open a session by id (lazy sessions-service resolution).
 */
export declare function ArchivePanel({ t, onClose, open, }: {
    t?: ArchiveLocale;
    onClose: () => void;
    open: (sessionId: string) => void;
}): ReactElement;
//# sourceMappingURL=archive-panel.d.ts.map