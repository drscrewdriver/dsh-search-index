#!/usr/bin/env node
/**
 * The independent index engine, proven against the built host bundle.
 *
 * What it proves:
 * - The engine opens its own sqlite file (official application id untouched),
 *   ingests raw session logs with the official extraction semantics, and
 *   answers session-grouped FTS queries with snippets and type filters.
 * - Watermark sync only re-reads changed sessions and isolates broken logs.
 * - A non-destructive rebuild keeps the old index queryable mid-build and
 *   swaps in the shadow atomically, archiving the old file.
 * - The JSON Lines snapshot round-trips: export → parse → import → same hits.
 *
 * Usage: node tests/index-engine.test.mjs  (after npm run build)
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const { SwitchIndexEngine, rebuildIndex, importIntoIndex, DEFAULT_INDEX_LAYOUT } = await import('../lib/index.mjs')

/** One temp workspace per run; each test gets its own directory. */
function tempDir(label) {
  return mkdtempSync(join(tmpdir(), `switch-search-${label}-`))
}

/** A minimal raw user/message event. */
function userMessage(seq, text) {
  return { seq, type: 'user/message', time: 1000 + seq, surfaceOp: 'append', data: { content: [{ type: 'text', text }] } }
}

/** A minimal raw assistant/message event. */
function assistantMessage(seq, text) {
  return { seq, type: 'assistant/message', time: 1000 + seq, surfaceOp: 'append', data: { message: { content: [{ type: 'text', text }] } } }
}

test('engine: ingest + session-grouped search with snippet', async () => {
  const dir = tempDir('basic')
  const engine = new SwitchIndexEngine({ path: join(dir, 'index.sqlite') })
  await engine.open()
  engine.upsertSession({
    sessionId: 's1', version: 1, title: '会话一', cwd: '/tmp', updatedAt: 10,
    events: [
      userMessage(0, '帮我修复登录超时的 bug'),
      assistantMessage(1, '登录超时通常来自 session 过期，我先检查 token 刷新逻辑。'),
    ],
  })
  engine.upsertSession({
    sessionId: 's2', version: 1, title: '会话二', cwd: '/tmp', updatedAt: 20,
    events: [userMessage(0, '写一个快速排序的 TypeScript 实现')],
  })
  assert.equal(engine.countSessions(), 2)

  const hits = engine.search({ query: '登录超时', types: ['all'], limit: 10 })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].sessionId, 's1')
  assert.equal(hits[0].title, '会话一')
  assert.ok(hits[0].snippet.includes('登录超时'))
  assert.equal(hits[0].type, 'user/message')

  // Type filter: reply-only must surface the assistant document.
  const replies = engine.search({ query: 'token 刷新', types: ['reply'] })
  assert.equal(replies.length, 1)
  assert.equal(replies[0].type, 'assistant/message')

  // User filter excludes the assistant document.
  const users = engine.search({ query: 'token 刷新', types: ['user'] })
  assert.equal(users.length, 0)

  // Sanitization: raw FTS syntax is treated as literal text.
  assert.equal(engine.search({ query: '"NOT" AND (syntax)' }).length, 0)

  engine.close()
})

test('engine: upsert replaces documents for the same session', async () => {
  const dir = tempDir('upsert')
  const engine = new SwitchIndexEngine({ path: join(dir, 'index.sqlite') })
  await engine.open()
  engine.upsertSession({ sessionId: 's1', version: 1, events: [userMessage(0, '第一版内容关键词针尖')] })
  engine.upsertSession({ sessionId: 's1', version: 2, events: [userMessage(0, '第二版内容关键词麦芒')] })
  assert.equal(engine.countSessions(), 1)
  assert.equal(engine.search({ query: '针尖' }).length, 0)
  assert.equal(engine.search({ query: '麦芒' }).length, 1)
  engine.close()
})

test('rebuild: old index stays queryable mid-build, archives swap in', async () => {
  const dir = tempDir('rebuild')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  const engine = new SwitchIndexEngine({ path: join(layout.dir, layout.active) })
  await engine.open()
  engine.upsertSession({ sessionId: 'old', version: 1, events: [userMessage(0, '旧索引内容')] })
  assert.equal(engine.search({ query: '旧索引' }).length, 1)

  // A corpus whose readSession stalls until we release it: proves the old
  // engine keeps serving while the shadow is still building.
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const sessionQuery = {
    listSessions: async () => [
      { header: { id: 'new', version: 1, createdAt: 5, cwd: '/w' } },
    ],
    readSession: async () => {
      await gate
      return { session: { id: 'new', version: 1, createdAt: 5, cwd: '/w' }, events: [userMessage(0, '新索引内容内容')] }
    },
  }
  const building = rebuildIndex(engine, layout, sessionQuery, 2)
  assert.equal(engine.search({ query: '旧索引' }).length, 1, 'old index serves during build')
  release()
  const state = await building
  assert.equal(state.state, 'idle')
  assert.equal(state.failures.length, 0)

  // Swap happened: the active engine now answers with the new corpus only.
  assert.equal(engine.search({ query: '新索引' }).length, 1)
  assert.equal(engine.search({ query: '旧索引' }).length, 0)
  assert.ok(existsSync(join(dir, 'index.sqlite')), 'active file exists')
  assert.ok(!existsSync(join(dir, layout.building)), 'shadow file consumed')
  engine.close()
  assert.ok(readFileSync(join(dir, 'index.sqlite')).length > 0)
})

test('rebuild: broken session is isolated, rest indexed', async () => {
  const dir = tempDir('broken')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  const engine = new SwitchIndexEngine({ path: join(layout.dir, layout.active) })
  await engine.open()
  const sessionQuery = {
    listSessions: async () => [
      { header: { id: 'good', version: 1, createdAt: 1 } },
      { header: { id: 'bad', version: 1, createdAt: 2 } },
    ],
    readSession: async (id) => {
      if (id === 'bad') throw new Error('replay validation failed')
      return { session: { id, version: 1, createdAt: 1 }, events: [userMessage(0, '完好的日志内容')] }
    },
  }
  const state = await rebuildIndex(engine, layout, sessionQuery, 2)
  assert.equal(state.state, 'idle')
  assert.deepEqual(state.failures.map(f => f.sessionId), ['bad'])
  assert.equal(engine.search({ query: '完好' }).length, 1)
  engine.close()
})

test('snapshot: export → parse → import round-trips the hits', async () => {
  const { exportSnapshot, parseSnapshot } = await import('../lib/index.mjs')
  const dir = tempDir('snapshot')
  const layout = { ...DEFAULT_INDEX_LAYOUT, dir }
  const source = new SwitchIndexEngine({ path: join(dir, 'src.sqlite') })
  await source.open()
  source.upsertSession({
    sessionId: 's1', version: 3, title: '迁移会话',
    events: [userMessage(0, '快照迁移关键词琥珀'), assistantMessage(1, '收到，我会处理琥珀相关的请求。')],
  })
  const text = exportSnapshot(source)
  source.close()

  const parsed = parseSnapshot(text)
  assert.equal(parsed.skipped, 0)
  assert.equal(parsed.records.length, 1)

  const target = new SwitchIndexEngine({ path: join(layout.dir, layout.active) })
  await target.open()
  target.upsertSession({ sessionId: 'scratch', version: 1, events: [userMessage(0, '将被替换的内容')] })
  const state = await importIntoIndex(target, layout, parsed.records, 2)
  assert.equal(state.state, 'idle')
  // Import replaces the whole active index.
  assert.equal(target.search({ query: '将被替换' }).length, 0)
  const hits = target.search({ query: '琥珀', types: ['all'] })
  assert.equal(hits.length, 1)
  assert.equal(hits[0].sessionId, 's1')
  assert.equal(hits[0].title, '迁移会话')
  assert.equal(target.getSession('s1').version, 3)
  target.close()
})

test('engine: Intl.Segmenter word semantics (short query, precision, prefix)', async () => {
  const dir = tempDir('segmenter')
  const engine = new SwitchIndexEngine({ path: join(dir, 'index.sqlite') })
  await engine.open()
  engine.upsertSession({
    sessionId: 's1', version: 1, title: '会话一',
    events: [userMessage(0, '帮我修复登录超时的 bug'), assistantMessage(1, '正在搜索会话历史进行诊断')],
  })

  // 2-char short query: word segmentation matches where trigram could not.
  assert.equal(engine.search({ query: '超时' }).length, 1)

  // Partial input: trailing prefix matches the word being typed.
  const partial = engine.search({ query: '正在搜' })
  assert.equal(partial.length, 1)
  assert.equal(partial[0].seq, 1)

  // Cross-word fragments are NOT matches: precision, not substring noise.
  assert.equal(engine.search({ query: '登超' }).length, 0)

  // Unrelated raw FTS syntax stays inert.
  assert.equal(engine.search({ query: '"NOT" AND (syntax)' }).length, 0)

  engine.close()
})

test('snapshot: malformed lines are skipped, not fatal', async () => {
  const { parseSnapshot } = await import('../lib/index.mjs')
  const parsed = parseSnapshot([
    '{"v":1,"kind":"dsh-switch-search-snapshot","exportedAt":1}',
    'not json at all',
    '{"sessionId":"s1","version":1,"docs":[{"seq":0,"type":"user/message","surface":"current","time":1,"text":"内容"}]}',
    '{"sessionId":""}',
  ].join('\n'))
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.skipped, 2)
  assert.equal(parsed.records[0].docs[0].text, '内容')
})
