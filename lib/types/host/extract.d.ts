/**
 * First-party semantic text extraction for the independent switch-search index.
 *
 * Semantics mirror the official session-query `extractSessionEventText` and the
 * core-session surface fold, mirrored structurally: the plugin must not
 * value-import official packages, so the event data is inspected as plain
 * records. Structural boundaries, embedded raw streams, request envelopes, and
 * unknown declaration-merged events contribute no text.
 */
/** One raw session event the plugin reads through sessionQuery.readSession. */
export interface SwitchRawEvent {
    seq: number;
    type: string;
    time?: number;
    ignorable?: boolean;
    surfaceOp?: unknown;
    data: unknown;
}
/** Surface membership of one indexed document. */
export type SwitchSurface = 'current' | 'shadowed';
/** One searchable document projected from one raw event. */
export interface SwitchIndexDoc {
    sessionId: string;
    seq: number;
    type: string;
    time: number;
    surface: SwitchSurface;
    text: string;
}
/**
 * Extract searchable semantic text from one raw session event.
 * @param event - event to inspect.
 * @returns newline-joined semantic text, or an empty string when non-searchable.
 */
export declare function extractSessionEventText(event: SwitchRawEvent): string;
/**
 * Classify raw-log events into current vs shadowed surface membership.
 *
 * Simplified fold of the official `foldSurface`: append events join the
 * surface, and a `replace` op shadows the declared inclusive seq range plus
 * removes it from the surface. Validation is intentionally lax — a broken op
 * degrades to append rather than failing the whole index build.
 * @param events - complete contiguous raw event log.
 * @returns seq → surface map; entries absent from the map are log-only.
 */
export declare function classifySurface(events: readonly SwitchRawEvent[]): Map<number, SwitchSurface>;
/**
 * Project one complete raw log into searchable documents.
 * @param sessionId - session that owns the log.
 * @param events - complete contiguous raw event log.
 * @returns documents in ascending seq order; structural events are omitted.
 */
export declare function buildIndexDocuments(sessionId: string, events: readonly SwitchRawEvent[]): SwitchIndexDoc[];
//# sourceMappingURL=extract.d.ts.map