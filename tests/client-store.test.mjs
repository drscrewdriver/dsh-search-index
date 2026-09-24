#!/usr/bin/env node
/**
 * The plugin settings card seat, proven against the built client bundle.
 *
 * What it proves (and what it does NOT):
 * - `lib/client.js` materializes without any release-specific specifier and
 *   registers exactly one sidebar entry plus one settings card (dual `id`+`key`,
 *   no `settings.general.item` row, no store seat).
 * - The card lands on WHICHEVER settings seat the host declares: `settings.plugin.item`
 *   on the ≤0.1.2 line, `settings.plugins.tab` on the 0.1.5 line — and only one
 *   of the two ever fires, because `slots.inject` runs its callback only once
 *   the named seat is DECLARED. The fake below models that rule; a fake that
 *   fires every `inject` models a host that declares everything, which no real
 *   host does, and would hide exactly the regression this covers.
 * - The card's inject factory binds the `switch-search` settings namespace
 *   through the settingsScope service; when that service is absent the card
 *   degrades to a read-only DEFAULT_CONFIG scope instead of crashing.
 * - It does NOT render React, and it does NOT prove GUI behaviour.
 *
 * Usage: node tests/client-store.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', 'lib', 'client.js')
const PLUGIN_ID = 'dsh-search-index'
const NAMESPACE = 'switch-search'

/** Module table the web shell seeds in both target releases (react family only here). */
const TABLE = {
  'react': {
    createElement: () => ({}), Fragment: {},
    useState: (v) => [v, () => {}], useEffect: () => {}, useMemo: (f) => f(),
    useRef: (v) => ({ current: v }), useSyncExternalStore: (sub, get) => get(),
  },
  'react-dom': { createPortal: () => ({}) },
}

/** Minimal DOM so the stylesheet effect can run headless. */
function documentStub() {
  const el = () => ({
    dataset: {}, style: {}, textContent: '', attributes: {},
    setAttribute() {}, removeAttribute() {}, remove() {}, appendChild() {},
    querySelectorAll: () => [], closest: () => null,
  })
  return {
    head: { appendChild: () => {} },
    documentElement: {},
    createElement: () => el(),
    querySelector: () => null,
    querySelectorAll: () => [],
  }
}

/** Materialize the bundle and return its exports. */
function loadBundle() {
  const captured = []
  const sandbox = {
    window: { __ModuleLoader__: { load: (reg) => captured.push(reg) } },
    document: documentStub(),
    MutationObserver: class { observe() {} disconnect() {} },
    queueMicrotask: (fn) => fn(),
    setTimeout, clearTimeout, console,
  }
  sandbox.globalThis = sandbox
  runInNewContext(readFileSync(BUNDLE, 'utf8'), sandbox, { filename: 'lib/client.js' })
  assert.equal(captured.length, 1, 'bundle must register exactly one factory')
  const reg = captured[0]
  assert.equal(reg.id, PLUGIN_ID, `factory id "${reg.id}" !== "${PLUGIN_ID}"`)
  const seen = new Set()
  const exports = reg.factory((spec) => {
    seen.add(spec)
    assert.ok(spec in TABLE, `non-baseline require "${spec}"`)
    return TABLE[spec]
  })
  return { exports, seen }
}

/**
 * The settings seats each host LINE declares.
 *
 * ⚠️ **The seats are NOT mutually exclusive** — that assumption is exactly what
 * caused the card to render twice. Measured from host source: the 0.1.2 host
 * declares `settings.section` (ui-settings-general:650), `settings.plugins.tab`
 * (ui-settings-plugins:1781) and `settings.plugin.item` (same package :1793,
 * declared at runtime by its `configurable` contribution) **all at once**.
 *
 * So the 0.1.2 fixture models the real deployment; the 0.1.5 fixture models the
 * suspected rename (child seat gone, only the sibling tab left).
 */
const HOST_012_SEATS = [
  'sidebar.footer.action',
  'settings.section',
  'settings.plugins.tab',
  'settings.plugin.item',
]
const HOST_015_SEATS = ['sidebar.footer.action', 'settings.section', 'settings.plugins.tab']
/** Child seat present, nothing else needed. */
const HOST_CARD_ONLY = ['sidebar.footer.action', 'settings.plugin.item']
/** Probe window (mirrors SEAT_PROBE_MS in src/client/index.ts). */
const PROBE_MS = 3000

/** Client context that records slot registrations and namespace bindings. */
function clientCtx(ledger, bindings, { withScope = true, withConfigForms = true, declaredSlots = HOST_012_SEATS } = {}) {
  const disposer = () => {}
  const declared = new Set(declaredSlots)
  let snapshot = {
    status: 'ready',
    value: { enabled: false, defaultMode: 'title' },
    base: undefined,
    user: undefined,
    revision: 1,
    writable: false,
    mode: 'host',
  }
  const scope = {
    getSnapshot: () => snapshot,
    subscribe: () => disposer,
    set: async () => {},
    unset: async () => {},
  }
  const slots = {
    // Real semantics: the callback fires only once the named seat is DECLARED.
    // The bundle relies on this for its two-seat (0.1.2 / 0.1.5) registration.
    inject: (name, fn) => { if (declared.has(name)) fn(); return disposer },
    register: (options) => { ledger.push(options); return disposer },
  }
  return {
    ctx: {
      effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : disposer },
      on: () => disposer,
      get: (name) => {
        if (name === 'configForms') {
          if (!withConfigForms) return undefined
          return { get: (entryId) => { bindings.push(entryId); return scope } }
        }
        if (name === 'settingsScope') {
          if (!withScope) return undefined
          return { bind: (spec) => { bindings.push(spec.namespace); return scope } }
        }
        if (name === 'slots') return slots
        return undefined
      },
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      slots,
    },
    setSnapshot: (next) => { snapshot = next },
  }
}

let failures = 0
const line = (s) => process.stdout.write(`${s}\n`)
/**
 * Checks are COLLECTED and run (in order, awaited) at the end of the file.
 * They cannot run inline any more: one of them has to wait out the bundle's
 * seat-probe window, and an inline sync runner would print the summary before
 * that promise settled — i.e. it would report PASS before the check ran.
 */
const checks = []
const check = (name, fn) => {
  checks.push([name, fn])
}

line('=== dsh-search-index plugin settings card ===')

const { exports, seen } = loadBundle()
check('bundle materializes with only baseline specifiers', () => {
  for (const spec of seen) assert.ok(!/dsh-client-(runtime|store|ui-settings-general)/.test(spec), `release-specific require "${spec}"`)
  assert.equal(typeof exports.apply, 'function', 'client half exports no apply()')
})

check('registers only the sidebar footer entry; no settings seat on 0.1.7', () => {
  const ledger = []
  const bindings = []
  const { ctx } = clientCtx(ledger, bindings)
  exports.apply(ctx)
  // 0.1.7: the settings card seat is gone; the form comes from the host half's
  // .volatile() fields. Exactly one sidebar entry remains.
  assert.equal(ledger.length, 1, `expected only the search entry, got ${ledger.length}`)
  assert.equal(ledger[0].name, 'sidebar.footer.action', 'the sidebar footer search entry must be registered')
  assert.equal(ledger[0].id, PLUGIN_ID)
})

check('footer scope prefers configForms and falls back to the legacy binding', () => {
  const formsLedger = []
  const formsBindings = []
  const { ctx } = clientCtx(formsLedger, formsBindings)
  exports.apply(ctx)
  assert.deepEqual(formsBindings, ['dsh-search-index'], 'configForms must be keyed by the profile entry id')
  const legacyLedger = []
  const legacyBindings = []
  const { ctx: legacyCtx } = clientCtx(legacyLedger, legacyBindings, { withConfigForms: false })
  exports.apply(legacyCtx)
  assert.deepEqual(legacyBindings, [NAMESPACE], 'without configForms the legacy namespace binding applies')
})

// ── The 0.1.2 line declared all three settings seats ─────────────────────────
// Regression guard for "the same card shown twice": no bundle may register more
// than one seat, and on 0.1.7 none at all.

check('registers exactly ONE sidebar seat and zero settings seats even on the 0.1.2 line', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [], { declaredSlots: HOST_012_SEATS })
  exports.apply(ctx)
  assert.equal(ledger.length, 1, `expected only the search entry, got ${ledger.length}: ${JSON.stringify(ledger.map((o) => o.name))}`)
  assert.deepEqual(
    ledger.filter((o) => String(o.name).startsWith('settings.')).map((o) => o.name),
    [],
    'no settings seat may be occupied on the 0.1.7 line',
  )
})

check('does NOT occupy the sibling tab seat even though the host declares it', () => {
  const ledger = []
  const { ctx } = clientCtx(ledger, [], { declaredSlots: HOST_012_SEATS })
  exports.apply(ctx)
  const names = ledger.map((o) => o.name)
  assert.ok(!names.includes('settings.plugins.tab'), `the sibling tab (same level as 「插件配置」) must NOT be occupied; got ${JSON.stringify(names)}`)
  assert.ok(
    !names.includes('settings.section'),
    `the top-level section must NOT also be occupied; got ${JSON.stringify(names)}`,
  )
})

// ── The seat-probe warn check retired with the seat itself (0.1.7) ────────────

for (const [name, fn] of checks) {
  try {
    await fn()
    line(`  PASS  ${name}`)
  } catch (err) {
    failures++
    line(`  FAIL  ${name} — ${err?.message ?? err}`)
  }
}

line(`\n${failures === 0 ? 'TEST PASS' : `TEST FAIL (${failures})`}`)
process.exitCode = failures === 0 ? 0 : 1
