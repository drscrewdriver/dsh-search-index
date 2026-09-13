/**
 * The archived-sessions viewer — a read-only centered dialog over the
 * official archive set as mirrored by the independent index.
 *
 * Rows are informational only (uuid + cached title): archived sessions are
 * gone from the user's active system, so there is nothing to open — the
 * panel never navigates and never mutates. Shared by the search panel's
 * footer entry and the settings card.
 */
import { type ReactElement } from 'react';
import { type LocaleKey } from './locales.ts';
/** The locale face handed to the panel (same seat as the card). */
export type ArchiveLocale = (key: LocaleKey, params?: Record<string, unknown>) => string;
/**
 * The archived-sessions viewer.
 * @param props.t - optional host dictionary lookup.
 * @param props.onClose - close the dialog.
 */
export declare function ArchivePanel({ t, onClose, }: {
    t?: ArchiveLocale;
    onClose: () => void;
}): ReactElement;
//# sourceMappingURL=archive-panel.d.ts.map