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

// 0.7.8 起内容检索通道与六档诊断文案，0.7.11 加 drs-not-activated 档与未激活提示：
// 十语字典必须全部带键，不得只靠 zh 回退。
test('every dictionary carries the transport + failure-code keys', () => {
  const keys = [
    'card.contentTransport', 'card.contentTransport.desc',
    'card.transport.auto', 'card.transport.http', 'card.transport.in-process',
    'card.drsStatus.mode', 'card.drsStatus.inactive',
    'card.drsReason.browser-access-denied', 'card.drsReason.drs-http-unreachable', 'card.drsReason.drs-http-error',
    'card.drsReason.drs-not-activated',
    'card.drsReason.drs-missing', 'card.drsReason.drs-empty', 'card.drsReason.drs-schema-mismatch',
    'panel.contentErr.browser-access-denied', 'panel.contentErr.drs-http-unreachable', 'panel.contentErr.drs-http-error',
    'panel.contentErr.drs-not-activated',
    'panel.contentErr.drs-missing', 'panel.contentErr.drs-empty', 'panel.contentErr.drs-schema-mismatch',
    // 0.7.21「保留搜索历史」开关：设置卡两键 + 面板清除按钮两键，十语不得只靠 zh 回退。
    'card.rememberQuery', 'card.rememberQuery.desc',
    'panel.history.clear', 'panel.history.clear.hint',
    // issue #4：深度同步失败的可见原因。失败原因一直是排查的唯一入口，
    // 十语必须齐 —— 少一种，那种语言的用户就只能看到 zh 回退的报错原文。
    'panel.deepSync', 'panel.deepSync.hint', 'panel.deepSync.drs',
    'panel.deepSync.rebuild', 'panel.deepSync.done', 'panel.deepSync.failed',
    'panel.deepSync.failedReason', 'panel.deepSync.retry',
    // issue #4 后续：诊断报告的按钮与四种反馈（成功 / 生成失败 / 复制失败 / 提示）。
    'panel.doctor', 'panel.doctor.hint', 'panel.doctor.copied',
    'panel.doctor.failed', 'panel.doctor.copyFailed',
  ]
  const missing = []
  const placeholderProblems = []
  for (const [locale, dict] of Object.entries(dictionaries)) {
    for (const key of keys) {
      if (typeof dict[key] !== 'string' || dict[key] === '') {
        missing.push(`${locale}.${key}`)
        continue
      }
      const expected = placeholders(zh[key])
      const actual = placeholders(dict[key])
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        placeholderProblems.push(`${locale}.${key}: zh ${JSON.stringify(expected)} vs ${JSON.stringify(actual)}`)
      }
    }
  }
  assert.deepEqual(missing, [], 'missing keys')
  assert.deepEqual(placeholderProblems, [], 'placeholder mismatches')
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
  // 每个键都有 zh 模板：无 locale 回调时回 zh（en 已全覆盖，故不依赖「en 缺键」）。
  const anyKey = 'card.title'
  assert.equal(translate(undefined, anyKey), zh[anyKey])
  assert.equal(translate(undefined, 'key.not.in.any.dictionary'), 'key.not.in.any.dictionary')
})

test('a live locale callback wins over the built-in dictionaries', () => {
  assert.equal(translate((key) => (key === 'card.title' ? 'Suchen' : ''), 'card.title'), 'Suchen')
  // But an empty or echo-like answer falls through to zh.
  assert.equal(translate(() => '', 'card.title'), zh['card.title'])
  assert.equal(translate((key) => key, 'card.title'), zh['card.title'])
})

test('the default-seat keys exist in zh with their {error} placeholders (PR #3 wiring)', () => {
  // The PR #3 mechanism (bindDefaultSeat) makes these keys reachable without a
  // props `t`; they must exist in the canonical dictionary, and the one
  // templated hint must keep its {error} placeholder in en as well.
  for (const key of [
    'panel.sessionsError.bare', 'panel.searchFailed', 'panel.unknownError',
    'panel.indexUnreachable', 'panel.locate.pending', 'panel.locate.ok', 'panel.locate.miss',
    'card.indexStatus.requestFailed', 'card.indexStatus.readFailed',
    'card.indexStatus.readFailedHint', 'card.indexStatus.retry',
  ]) {
    assert.ok(typeof zh[key] === 'string' && zh[key].length > 0, `zh is missing ${key}`)
  }
  assert.ok(en['card.indexStatus.readFailedHint'].includes('{error}'), 'en readFailedHint lost its {error} placeholder')
  assert.equal(placeholders(zh['card.indexStatus.readFailedHint']).join(','), placeholders(en['card.indexStatus.readFailedHint']).join(','))
})

// 0.7.27 语料补齐首批（search-index-locale-live-audit task_9，所有者拍板）：
// 20 个高频可见键（panel 状态条 / HUD / 冷数据徽标与确认 / 深度同步按钮）七语必须全部在场，
// 不得只靠宿主链落 en 中间态；占位符与 zh 逐一对应。
test('every dictionary carries the first-batch high-visibility keys', () => {
  const keys = [
    'panel.index.count', 'panel.index.none', 'panel.index.rebuilding',
    'domain.all', 'tag.archived', 'date.from', 'date.to',
    'hud.progress', 'hud.done', 'hud.jump', 'hud.fail', 'hud.retry', 'hud.close',
    'cold.badge.hint', 'cold.confirm.body', 'cold.confirm.ok', 'cold.confirm.cancel',
    'toocold.badge.hint', 'toocold.hint', 'card.deepSync.btn',
  ]
  const missing = []
  const placeholderProblems = []
  for (const [locale, dict] of Object.entries(dictionaries)) {
    for (const key of keys) {
      if (typeof dict[key] !== 'string' || dict[key] === '') {
        missing.push(`${locale}.${key}`)
        continue
      }
      const expected = placeholders(zh[key])
      const actual = placeholders(dict[key])
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        placeholderProblems.push(`${locale}.${key}: zh ${JSON.stringify(expected)} vs ${JSON.stringify(actual)}`)
      }
    }
  }
  assert.deepEqual(missing, [], 'missing first-batch keys')
  assert.deepEqual(placeholderProblems, [], 'placeholder mismatches')
})

// 覆盖率地板：七语 Partial 在首批补齐后各 ≥150 键（191 的 ~78%）。
// 钉住下限防倒退——任何人删键守卫立刻红；后续批次补齐时随批次抬高。
test('partial dictionaries keep the batch-1 coverage floor', () => {
  const FLOOR = 150
  const below = Object.entries(dictionaries)
    .filter(([locale]) => locale !== 'zh' && locale !== 'en' && locale !== 'pt')
    .filter(([, dict]) => Object.keys(dict).length < FLOOR)
    .map(([locale, dict]) => `${locale}=${Object.keys(dict).length}`)
  assert.deepEqual(below, [], `dictionaries below the ${FLOOR}-key floor`)
})

test('panel.tsx and card.tsx ship no bare CJK runtime strings', async () => {
  // The 2026-11-22 wiring pass replaced every bare Chinese runtime string in
  // the two client components with `translate(t, …)` calls (PR #3 follow-up).
  // Comments are exempt — both files are documentation-dense.
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const CJK = /[\u4e00-\u9fff]/
  const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')
  for (const file of ['panel.tsx', 'card.tsx']) {
    const src = stripComments(readFileSync(fileURLToPath(new URL(`../src/client/${file}`, import.meta.url)), 'utf8'))
    const hits = src.split('\n').map((line, i) => (CJK.test(line) ? `${file}:${i + 1} ${line.trim().slice(0, 80)}` : null)).filter(Boolean)
    assert.deepEqual(hits, [], `${file} still ships bare CJK runtime strings:\n${hits.join('\n')}`)
  }
})
