#!/usr/bin/env node
/**
 * The locale dictionaries stay internally consistent.
 *
 * What it proves:
 * - `en` never invents a key `zh` does not own (en is Partial on purpose, but
 *   a stray key would be dead weight and a typo would ship silently).
 * - Every `{placeholder}` used by an English translation has the same
 *   placeholder set as its zh source — a mismatch means the interpolation
 *   would render a raw `{name}` for one locale only.
 * - `translate()` interpolation: known params substitute, unknown params keep
 *   their braces, missing locale falls back to zh, then to the key itself.
 * - No dictionary value is empty (an empty string would defeat the
 *   `raw !== ''` fallback in translate and render nothing).
 *
 * Usage: node --import tsx tests/client-locales.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const { NS, zh, en, dictionaries, translate } = await import('../src/client/locales.ts')

const PLACEHOLDER = /\{(\w+)\}/gu
const placeholders = (s) => [...String(s).matchAll(PLACEHOLDER)].map(m => m[1]).sort()

test('namespace is the settings namespace', () => {
  assert.equal(NS, 'switch-search')
})

test('en never invents a key zh does not own', () => {
  const zhKeys = new Set(Object.keys(zh))
  const strays = Object.keys(en).filter(k => !zhKeys.has(k))
  assert.deepEqual(strays, [], `en has keys missing from zh: ${strays.join(', ')}`)
})

test('no dictionary value is empty', () => {
  for (const [locale, dict] of Object.entries(dictionaries)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.ok(typeof value === 'string' && value.length > 0, `${locale}.${key} is empty`)
    }
  }
})

test('translated en keys keep the zh placeholder set', () => {
  const problems = []
  for (const [key, enValue] of Object.entries(en)) {
    const expected = placeholders(zh[key])
    const actual = placeholders(enValue)
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      problems.push(`${key}: zh ${JSON.stringify(expected)} vs en ${JSON.stringify(actual)}`)
    }
  }
  assert.deepEqual(problems, [], 'placeholder mismatches')
})

test('translate interpolates known params and keeps unknown braces', () => {
  assert.equal(translate(undefined, 'card.index.desc', { indexed: 7 }), '索引正常：已收录 7 个会话。')
  assert.equal(translate(undefined, 'card.index.desc', {}), '索引正常：已收录 {indexed} 个会话。')
  assert.ok(translate(undefined, 'card.index.rebuilding', { done: 1, total: 9 }).includes('1/9'))
})

test('translate falls back zh → key', () => {
  // A key en has not translated falls back to the zh template, not to undefined.
  const untranslated = Object.keys(zh).find(k => !(k in en))
  assert.ok(untranslated, 'expected at least one zh-only key for this probe')
  assert.equal(translate(undefined, untranslated), zh[untranslated])
  assert.equal(translate(undefined, 'key.not.in.any.dictionary'), 'key.not.in.any.dictionary')
})

test('a live locale callback wins over the built-in dictionaries', () => {
  assert.equal(translate((key) => (key === 'card.title' ? 'Suchen' : ''), 'card.title'), 'Suchen')
  // But an empty or echo-like answer falls through to zh.
  assert.equal(translate(() => '', 'card.title'), zh['card.title'])
  assert.equal(translate((key) => key, 'card.title'), zh['card.title'])
})
