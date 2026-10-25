#!/usr/bin/env node
/**
 * The stylesheet has no orphan selectors, and the settings binding has one owner.
 *
 * Why this test exists
 * --------------------
 * Two silent-rot classes, both found by hand in this repo and neither reachable
 * by a GUI check:
 *
 * 1. **Orphan CSS.** When the archived-sessions viewer moved to
 *    `dsh-session-steward`, its selectors stayed behind: `.dsws_archRow`,
 *    `.dsws_archCheck`, `.dsws_dialogHead`, `.dsws_dangerBtn` and friends kept
 *    shipping in every bundle. A stylesheet full of classes for a panel that no
 *    longer exists reads as "this plugin still owns that panel" — exactly the
 *    confusion the split was meant to end. Thirteen such classes had
 *    accumulated before this test existed.
 * 2. **A switch wired to nothing.** `enabled` was declared, defaulted and
 *    exposed as a toggle, but the sidebar entry registered unconditionally, so
 *    the switch controlled nothing. The fix is that the entry and the settings
 *    card read *the same* bound scope — one binding, two consumers — which is
 *    what this test pins.
 *
 * The stylesheet is read from source rather than from the built bundle: in the
 * bundle it is one opaque string literal, and the invariant is about the source
 * of truth anyway.
 *
 * What it proves: no stylesheet class is unreferenced, and the entry/card share
 * one scope binding.
 * What it does NOT prove: that the entry actually disappears when switched off
 * — that is a React render path, and stays a GUI check.
 *
 * Usage: node tests/client-styles.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT_DIR = join(HERE, '..', 'src', 'client')

const files = readdirSync(CLIENT_DIR).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
const sources = new Map(files.map(f => [f, readFileSync(join(CLIENT_DIR, f), 'utf8')]))

/** ------------------------------------------------------ one stylesheet owner */

// The stylesheet lives in whichever client source declares it; exactly one owner
// across the whole half (a second declaration means two places to keep in sync).
const CSS_DECL = 'const CSS = `'
const owners = [...sources.entries()].filter(([, src]) => src.includes(CSS_DECL))
assert.equal(owners.length, 1, `the stylesheet must have exactly one owner; found ${owners.length}`)
const [cssFile, cssSource] = owners[0]
const cssStart = cssSource.indexOf(CSS_DECL)
const cssEnd = cssSource.indexOf('`', cssStart + CSS_DECL.length)
const css = cssSource.slice(cssStart, cssEnd)
console.log(`  stylesheet owner: ${cssFile}`)

const classes = new Set()
for (const m of css.matchAll(/\.(dsws_[A-Za-z0-9_]+)/g)) classes.add(m[1])
assert.ok(classes.size > 20, `the stylesheet should still define the panel's classes; found ${classes.size}`)

/** --------------------------------------------------------- no orphan classes */

// Code = every client source, with the stylesheet literal removed so a class
// cannot satisfy the check by matching its own rule.
const code = [...sources.values()].join('\n').replace(css, '')

const orphans = []
for (const name of [...classes].sort()) {
  const hits = (code.match(new RegExp(`${name}(?![A-Za-z0-9_])`, 'g')) ?? []).length
  if (hits === 0) orphans.push(name)
}

assert.deepEqual(
  orphans,
  [],
  `every stylesheet class must be referenced from code; orphaned: ${orphans.join(', ')}`,
)

/** ------------------------------------------- settings binding has one owner */

// 设置面只允许一条回退链：configForms 原生句柄 → legacy 桥。
const entrySource = sources.get('index.ts')
assert.ok(entrySource !== undefined, 'src/client/index.ts must exist')
const bridgeCalls = entrySource.match(/withBridgeFallback[(]/g) ?? []
assert.equal(bridgeCalls.length, 1, `one settings binding chain expected; found ${bridgeCalls.length}`)
const scopeCalls = entrySource.match(/searchBridgeScope[(][)]/g) ?? []
assert.equal(scopeCalls.length, 1, `legacy bridge scope must be created once; found ${scopeCalls.length}`)
assert.ok(/enabled !== false/.test(code), 'the entry must consult `enabled` from the shared scope')

console.log(`client-styles: ok (${classes.size} classes, 0 orphans, 1 settings chain)`)
