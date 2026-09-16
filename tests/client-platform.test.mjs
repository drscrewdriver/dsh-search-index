#!/usr/bin/env node
/**
 * The shortcut hint and the shortcut binding have one owner, and the hint
 * tells the truth on every platform.
 *
 * Why this test exists
 * --------------------
 * Two failure modes are invisible in a Windows browser and therefore sail
 * through a GUI check:
 *
 * 1. **One hard-coded vocabulary.** The panel advertised `⌘K` to everyone, so
 *    the shortcut was undiscoverable on Windows and Linux. Worse, the old
 *    detection was a single `navigator.platform` test — a deprecated API that
 *    returns an empty string in some privacy configurations, silently
 *    degrading every Mac user to the Windows vocabulary.
 * 2. **A hint that disagrees with the handler.** A footer promising `⌘K`
 *    while the keydown handler matches `Ctrl+K` looks correct in a screenshot
 *    and does nothing when pressed.
 *
 * The React render path is not exercised by this suite (see the note in
 * `client-store.test.mjs`), so the behaviour of the pure helpers is tested by
 * importing `src/client/platform.ts` through tsx, and the *wiring* — that the
 * bundle actually calls those helpers from the chip and from the listener — is
 * pinned structurally against the built bundle.
 *
 * What it proves: the vocabulary is platform-correct, the chord test agrees
 * with the chip it advertises, and the bundle binds the chord it shows.
 * What it does NOT prove: that a keypress opens the panel in a real browser —
 * that stays a GUI check.
 *
 * Usage: node --import tsx tests/client-platform.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { LABELS, detectPlatform, isInvokeChord, platformLabels } from '../src/client/platform.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', 'lib', 'client.js')

/** Build a keydown payload with the given key and modifiers. */
function key(k, mods = {}) {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods }
}

/** Count non-overlapping matches of a regex in a string. */
function count(source, pattern) {
  return (source.match(pattern) ?? []).length
}

/** ------------------------------------------------- platform detection tiers */

assert.equal(
  detectPlatform({ userAgentData: { platform: 'macOS' }, platform: 'Win32', userAgent: 'Windows NT 10.0' }),
  'macos',
  'tier 1 (UA-CH) must win over the deprecated navigator.platform',
)

assert.equal(
  detectPlatform({ platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }),
  'macintel',
  'tier 2 (navigator.platform) must be used when UA-CH is absent',
)

// The privacy-mode case: UA-CH undefined and navigator.platform present but
// empty. This is exactly where the old single-test detection lost the Mac.
assert.equal(
  detectPlatform({ userAgentData: { platform: '' }, platform: '', userAgent: 'Mozilla/5.0 (Macintosh)' }),
  'mozilla/5.0 (macintosh)',
  'an empty UA-CH platform and an empty navigator.platform must fall through to the UA string, not to the wrong vocabulary',
)

assert.equal(detectPlatform(undefined), '', 'a missing navigator must yield an empty platform, not throw')
assert.equal(detectPlatform({ platform: 42, userAgent: '' }), '', 'non-string navigator fields must be ignored')
assert.equal(detectPlatform({ userAgentData: { platform: 42 } }), '', 'a non-string UA-CH platform must be ignored')

/** ------------------------------------------------------ label vocabularies */

const mac = platformLabels('macos')
const win = platformLabels('win32')
const linux = platformLabels('linux x86_64')
const unknown = platformLabels('')

assert.equal(mac.invokeLabel, '⌘K', 'macOS advertise the symbol chord')
assert.equal(mac.escLabel, 'esc', 'macOS spell Escape in lower case')
assert.equal(mac.altLabel, '⌥', 'macOS draw the option glyph')
assert.equal(mac.shiftLabel, '⇧', 'macOS draw the shift glyph')
assert.equal(mac.isMac, true, 'macOS must be detected as macOS')

assert.equal(win.invokeLabel, 'Ctrl K', 'Windows must spell the chord out')
assert.equal(win.escLabel, 'Esc', 'Windows must capitalise Escape')
assert.equal(win.altLabel, 'Alt', 'Windows must spell Alt')
assert.equal(win.isWindows, true, 'Win32 must be detected as Windows')

assert.equal(linux.invokeLabel, 'Ctrl K', 'Linux takes the non-Mac vocabulary')
assert.equal(linux.isMac, false, 'Linux is not macOS')

// The degradation contract: an unreadable platform must never render a glyph
// that is meaningless to the user reading it.
assert.equal(unknown.invokeLabel, 'Ctrl K', 'an unknown platform must degrade to the legible vocabulary')
assert.equal(unknown.escLabel, 'Esc', 'an unknown platform must degrade to the legible vocabulary')
assert.equal(unknown.isMac, false, 'an unknown platform must not claim to be macOS')

/** --------------------------------------------------------- chord agreement */

assert.equal(isInvokeChord(key('k', { metaKey: true }), true), true, '⌘K must fire on macOS')
assert.equal(isInvokeChord(key('K', { metaKey: true }), true), true, '⌘K must fire with a shifted key value too')
assert.equal(isInvokeChord(key('k', { ctrlKey: true, metaKey: true }), true), false, '⌘K must not fire while Ctrl is also held')
assert.equal(isInvokeChord(key('k', { altKey: true, metaKey: true }), true), false, '⌥⌘K is a different chord')
assert.equal(isInvokeChord(key('k', { shiftKey: true, metaKey: true }), true), false, '⇧⌘K is a different chord')
assert.equal(isInvokeChord(key('j', { metaKey: true }), true), false, 'other keys must not fire')

assert.equal(isInvokeChord(key('k', { ctrlKey: true }), false), true, 'Ctrl+K must fire off macOS')
assert.equal(isInvokeChord(key('k', { metaKey: true }), false), false, '⌘K must not fire off macOS')
assert.equal(isInvokeChord(key('k', { ctrlKey: true, metaKey: true }), false), false, 'Ctrl+K must not fire while Meta is also held')
assert.equal(isInvokeChord(key('k'), false), false, 'a bare K must not fire')
assert.equal(isInvokeChord(key('Escape'), false), false, 'Escape must not fire the invoke chord')

// The invariant that ties the two halves together: for every platform, an
// event carrying exactly the modifier that platform's label names must be
// accepted. This is what stops the chip and the handler from drifting.
for (const labels of [mac, win, linux, unknown]) {
  const event = labels.isMac ? key('k', { metaKey: true }) : key('k', { ctrlKey: true })
  assert.equal(
    isInvokeChord(event, labels.isMac),
    true,
    `the chord advertised as ${labels.invokeLabel} must be the chord the handler accepts`,
  )
}

/** ------------------------------------------- wiring, pinned in the bundle */

const source = readFileSync(BUNDLE, 'utf8')

// Code-shaped patterns: doc comments survive bundling, and a bare word count
// would happily match the comment that explains the code.
assert.equal(
  count(source, /\.userAgentData\?\.platform/g),
  1,
  'the UA-CH tier must have exactly one owner in the bundle',
)
assert.equal(count(source, /function detectPlatform\(/g), 1, 'the platform detection must be defined once')
assert.ok(count(source, /detectPlatform\(/g) >= 2, 'detection must be defined and consumed')
assert.ok(count(source, /platformLabels\(/g) >= 2, 'the label vocabulary must be derived through one helper')

// The decisive wiring assertion: `isInvokeChord` must appear at least twice —
// its definition plus the keydown handler that calls it. One occurrence means
// the helper shipped but nothing listens for the chord.
assert.ok(
  count(source, /isInvokeChord\(/g) >= 2,
  'the advertised chord must be the chord the keydown handler actually matches',
)
assert.equal(count(source, /addEventListener\("keydown"/g), 2, 'exactly two keydown listeners: Escape and the invoke chord')

// Three key caps: the sidebar entry, the footer invoke hint, the footer Escape
// hint. Plus two stylesheet selectors.
assert.equal(count(source, /"dsws_kbd"/g), 3, 'three key caps must be rendered')
assert.ok(count(source, /dsws_kbd/g) >= 5, 'the key-cap stylesheet must ship with its consumers')

// Both faces of the chord must be produced by the same derivation.
assert.equal(count(source, /\$\{modLabel\}K/g), 1, 'the macOS chord face must be derived from the modifier label')
assert.equal(count(source, /\$\{modLabel\} K/g), 1, 'the Windows/Linux chord face must be derived from the same label')

console.log(`client-platform: ok (4 vocabularies, ${count(source, /isInvokeChord\(/g)} chord references, 3 key caps)`)
