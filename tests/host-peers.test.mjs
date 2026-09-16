#!/usr/bin/env node
/**
 * The peer probe never mistakes "I could not tell" for "it is not installed".
 *
 * Why this test exists
 * --------------------
 * The settings card tells the user where archived sessions are managed. The
 * wording differs depending on whether `dsh-session-steward` is installed, and
 * that answer comes from a resolution probe.
 *
 * The dangerous failure is not a crash — it is a probe that reports `missing`
 * when it merely failed to run: the card would then tell a user to install a
 * plugin they already have installed, which is worse than saying nothing. So
 * the probe has three states, and only a genuine module-not-found may produce
 * `missing`.
 *
 * What it proves: a definitely-absent package reports `missing`; a resolvable
 * specifier reports `installed`; a malformed specifier is not silently
 * classified as absent.
 * What it does NOT prove: that the running profile resolves the steward
 * package — that depends on the profile, not on this code.
 *
 * Usage: node --import tsx tests/host-peers.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { STEWARD_PACKAGE, detectSteward, probePeer } from '../src/host/peers.ts'

const STATES = new Set(['installed', 'missing', 'unknown'])

// A name nobody can have published: the module-not-found path, deterministically.
assert.equal(
  probePeer('dsh-definitely-not-a-real-package-9f3a1c'),
  'missing',
  'an unresolvable package must report `missing`',
)

// A builtin always resolves — the `installed` path without depending on what
// happens to be installed in this checkout.
assert.equal(probePeer('node:fs'), 'installed', 'a resolvable specifier must report `installed`')

// The branch that matters: a package that *exists* but cannot be read must not
// be reported as absent. Node raises ERR_INVALID_PACKAGE_CONFIG for an
// unparseable manifest — a failure mode this checkout cannot produce, hence
// the injectable resolution base.
const fixture = mkdtempSync(join(tmpdir(), 'dsh-peers-'))
try {
  mkdirSync(join(fixture, 'node_modules', 'broken-peer'), { recursive: true })
  writeFileSync(join(fixture, 'node_modules', 'broken-peer', 'package.json'), '{ this is not json')
  const base = pathToFileURL(join(fixture, 'probe.mjs')).href
  assert.equal(
    probePeer('broken-peer', base),
    'unknown',
    'a package that exists but cannot be read must report `unknown`, never `missing`',
  )
} finally {
  rmSync(fixture, { recursive: true, force: true })
}

// The named probe is the parameterised one plus the package name, and it must
// never throw regardless of what the local checkout happens to contain.
assert.equal(STEWARD_PACKAGE, 'dsh-session-steward', 'the probe must target the package that owns archiving')
assert.ok(STATES.has(detectSteward()), 'the steward probe must always return a known state')

console.log(`host-peers: ok (missing/installed/unreadable all classified, steward=${detectSteward()})`)
