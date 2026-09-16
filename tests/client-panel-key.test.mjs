#!/usr/bin/env node
/**
 * The content-search request key has exactly one owner.
 *
 * Why this test exists
 * --------------------
 * The request key decides whether a stored result belongs to the current
 * inputs. It used to be written twice: the effect that issues the request
 * built a three-part key, while the render path rebuilt a two-part key from
 * the same inputs. The two drifted apart, `activeContent` fell through to its
 * empty `loading` state on every query, and content search rendered nothing
 * while the host kept returning correct results.
 *
 * The React render path is not exercised by this suite (see the note in
 * `client-store.test.mjs`), so no behavioural test can catch that class. This
 * test pins the structural invariant instead: exactly one template literal
 * carries the NUL separator, and both sides consume the shared helper.
 *
 * What it proves: the key still has a single owner in the built bundle.
 * What it does NOT prove: that the panel renders — that stays a GUI check.
 *
 * Usage: node tests/client-panel-key.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', 'lib', 'client.js')
const source = readFileSync(BUNDLE, 'utf8')

const KEY_TEMPLATE = /`[^`]*\\u0000[^`]*`/g
const templates = source.match(KEY_TEMPLATE) ?? []
assert.equal(
  templates.length,
  1,
  `the request key must have exactly one owner; found ${templates.length} template literals carrying the separator: ${JSON.stringify(templates)}`,
)

const references = source.match(/contentRequestKey/g) ?? []
assert.ok(
  references.length >= 3,
  `the shared key helper must be defined and consumed by both sides; found ${references.length} references`,
)

console.log(`client-panel-key: ok (1 owner, ${references.length} references)`)
