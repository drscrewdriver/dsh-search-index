/**
 * Platform detection and the keyboard-label vocabulary, for the client half.
 *
 * Why this module exists
 * ----------------------
 * A shortcut hint is the one place where a single hard-coded string is wrong
 * for most users: `⌘K` is meaningless on Windows, `Ctrl K` is wrong on macOS.
 * The obvious implementation — one `navigator.platform` test — is also the
 * fragile one: that API is deprecated, and it returns an empty string in some
 * privacy configurations, which silently degrades every Mac user to the
 * Windows vocabulary without any error to notice.
 *
 * This module is the single owner of both the platform answer and every label
 * derived from it. The hint rendered in the sidebar, the hint rendered in the
 * panel footer, and the chord the keydown handler actually matches all read
 * from here — so a platform fix cannot land in one of them and miss another,
 * and the advertised key cannot drift away from the bound key.
 */
/** The navigator fields the detection reads (all optional, all untrusted). */
export interface NavigatorLike {
    userAgentData?: {
        platform?: unknown;
    };
    platform?: unknown;
    userAgent?: unknown;
}
/**
 * Resolve the running platform string, three tiers deep.
 *
 * 1. UA-CH (`navigator.userAgentData.platform`) — modern and precise.
 * 2. `navigator.platform` — broadly available, deprecated, and empty in some
 *    privacy modes.
 * 3. The UA string — last resort, still non-empty in practice.
 *
 * @param nav - the navigator to read; `undefined` is allowed (non-DOM host).
 * @returns a lower-cased platform string, or `''` when nothing could be read.
 */
export declare function detectPlatform(nav: NavigatorLike | undefined): string;
/** The keyboard vocabulary for one platform. */
export interface PlatformLabels {
    /** The lower-cased platform string these labels were derived from. */
    platform: string;
    isMac: boolean;
    isWindows: boolean;
    /** Invoke-key modifier: `⌘` on macOS, `Ctrl` elsewhere. */
    modLabel: string;
    /** Secondary modifier: `⌥` on macOS, `Alt` elsewhere. */
    altLabel: string;
    /** Shift: `⇧` on macOS, `Shift` elsewhere. */
    shiftLabel: string;
    /** Confirm: the arrow glyph is legible on every platform. */
    enterLabel: string;
    /** Escape: `esc` is the macOS spelling, `Esc` the one everywhere else. */
    escLabel: string;
    /**
     * The whole invoke chord as one face, ready for a key chip: `⌘K` on macOS,
     * `Ctrl K` on Windows and Linux. `Ctrl K` keeps the space because `CtrlK`
     * reads as a word rather than as two keys.
     */
    invokeLabel: string;
}
/**
 * Derive the label vocabulary from a platform string.
 *
 * An unrecognised platform — an empty string, or a UA that names neither
 * system — takes the non-Mac vocabulary on purpose: `Ctrl` is legible to
 * everyone, while `⌘` is opaque to anyone who has never used a Mac.
 *
 * @param platform - the string produced by {@link detectPlatform}.
 * @returns the label vocabulary for that platform.
 */
export declare function platformLabels(platform: string): PlatformLabels;
/** The labels for the platform this bundle is running on. */
export declare const LABELS: PlatformLabels;
/** The minimal keydown face the chord test reads. */
export interface KeyChordEvent {
    key: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
}
/**
 * Whether a keydown event is the invoke chord advertised by
 * {@link PlatformLabels.invokeLabel}.
 *
 * The hint and the binding have to agree: a footer promising `⌘K` while the
 * handler matches `Ctrl+K` is worse than showing no hint at all. Both sides
 * call this, so neither can be changed alone. Requiring the other modifier to
 * be *absent* keeps the two chords distinct instead of letting either one
 * satisfy both platforms.
 *
 * @param event - the keydown payload.
 * @param isMac - the running platform's macOS-ness, from {@link LABELS}.
 * @returns `true` when the event is the invoke chord.
 */
export declare function isInvokeChord(event: KeyChordEvent, isMac: boolean): boolean;
//# sourceMappingURL=platform.d.ts.map