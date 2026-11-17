#!/usr/bin/env node
/**
 * 搜索现场快照的纯函数契约（`src/client/query-history.ts`）。
 *
 * 为什么这个用例存在
 * ------------------
 * 「保留搜索历史」这个开关有三条会静默出错的路径，全都不在任何 GUI 冒烟里：
 *
 * 1. **过期不失效** —— 没有 TTL 时，用户隔三天打开面板看到上次的关键词，
 *    第一反应是「搜索坏了」。这条只能靠注入时钟测。
 * 2. **坏数据炸面板** —— 手改过 localStorage、旧版本残留、字段类型漂移，
 *    任何一个 `JSON.parse` 或类型假设失误都会让整个面板白屏。
 * 3. **越界滚动** —— 期间删过会话，行数变少，原 scrollTop 超界。
 *
 * 本仓跑不了 React 渲染路径（见 `client-store.test.mjs` 的说明），所以把这三条
 * 做成纯函数用例是唯一能真正测到的办法。
 *
 * 能证明什么：读写往返、TTL、版本、坏数据、存储抛异常、滚动收敛全部按契约。
 * 不能证明什么：面板真的把快照接上了 —— 那部分由 `client-query-history-wiring`
 * 的结构断言 + 真机冒烟覆盖。
 *
 * Usage: node --import tsx tests/client-query-history.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const {
  QUERY_HISTORY_KEY,
  QUERY_HISTORY_TTL_MS,
  QUERY_HISTORY_VERSION,
  clampScroll,
  clearSnapshot,
  readSnapshot,
  writeSnapshot,
} = await import('../src/client/query-history.ts')

/** 内存版 Storage 替身：与浏览器同语义（未写的键返回 null）。 */
function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

/** 一个完整的现场，各用例按需覆盖字段。 */
const SAMPLE = {
  mode: 'content',
  query: '冷数据回溯',
  contentType: 'assistant/message',
  archivedFilter: 'archived',
  dateFrom: '2026-11-01',
  dateTo: '2026-11-17',
  scrollTop: 480,
}

test('键名带插件前缀，不与其他 localStorage 用户撞', () => {
  assert.equal(QUERY_HISTORY_KEY, 'dsh-search-index.queryHistory')
})

test('写→读往返：现场逐字段还原', () => {
  const storage = memoryStorage()
  writeSnapshot(SAMPLE, storage)
  const got = readSnapshot(Date.now(), storage)
  assert.notEqual(got, null)
  assert.equal(got.mode, 'content')
  assert.equal(got.query, '冷数据回溯')
  assert.equal(got.contentType, 'assistant/message')
  assert.equal(got.archivedFilter, 'archived')
  assert.equal(got.dateFrom, '2026-11-01')
  assert.equal(got.dateTo, '2026-11-17')
  assert.equal(got.scrollTop, 480)
  assert.equal(got.v, QUERY_HISTORY_VERSION)
})

test('写入时盖戳 at，调用方不必自己关心时钟', () => {
  const storage = memoryStorage()
  const before = Date.now()
  writeSnapshot(SAMPLE, storage)
  const got = readSnapshot(Date.now(), storage)
  assert.ok(got.at >= before && got.at <= Date.now(), `at 应落在写入区间内，实际 ${got.at}`)
})

test('没有快照 → null，且不抛', () => {
  const storage = memoryStorage()
  assert.equal(readSnapshot(Date.now(), storage), null)
})

test('TTL：13 小时前写的快照读出来是 null，且键被清', () => {
  const storage = memoryStorage()
  writeSnapshot(SAMPLE, storage)
  assert.equal(storage.map.has(QUERY_HISTORY_KEY), true, '写入后键应在')
  const later = Date.now() + 13 * 60 * 60 * 1000
  assert.equal(readSnapshot(later, storage), null)
  assert.equal(storage.map.has(QUERY_HISTORY_KEY), false, '过期后必须顺手清键，否则陈旧现场常驻')
})

test('TTL：11 小时前写的快照仍然有效（边界内不误杀）', () => {
  const storage = memoryStorage()
  writeSnapshot(SAMPLE, storage)
  const later = Date.now() + 11 * 60 * 60 * 1000
  assert.notEqual(readSnapshot(later, storage), null)
})

test('TTL 常量就是 12 小时', () => {
  assert.equal(QUERY_HISTORY_TTL_MS, 12 * 60 * 60 * 1000)
})

test('版本不符 → null 且清键（旧结构不尽力兼容）', () => {
  const storage = memoryStorage({
    [QUERY_HISTORY_KEY]: JSON.stringify({ ...SAMPLE, v: 2, at: Date.now() }),
  })
  assert.equal(readSnapshot(Date.now(), storage), null)
  assert.equal(storage.map.has(QUERY_HISTORY_KEY), false)
})

test('坏 JSON → null 且清键，不抛', () => {
  const storage = memoryStorage({ [QUERY_HISTORY_KEY]: '{not json' })
  assert.equal(readSnapshot(Date.now(), storage), null)
  assert.equal(storage.map.has(QUERY_HISTORY_KEY), false)
})

test('JSON 是数组 / 字符串 / null → null 且清键', () => {
  for (const raw of ['[]', '"text"', 'null', '42']) {
    const storage = memoryStorage({ [QUERY_HISTORY_KEY]: raw })
    assert.equal(readSnapshot(Date.now(), storage), null, `raw=${raw} 应判无效`)
    assert.equal(storage.map.has(QUERY_HISTORY_KEY), false, `raw=${raw} 应被清键`)
  }
})

test('字段类型漂移 → 退化为中性值而不是抛错', () => {
  const storage = memoryStorage({
    [QUERY_HISTORY_KEY]: JSON.stringify({
      v: QUERY_HISTORY_VERSION,
      at: Date.now(),
      mode: 'nonsense',
      query: 123,
      contentType: null,
      archivedFilter: {},
      dateFrom: [],
      dateTo: undefined,
      scrollTop: 'abc',
    }),
  })
  const got = readSnapshot(Date.now(), storage)
  assert.notEqual(got, null)
  assert.equal(got.mode, 'title', '未知模式退回 title')
  assert.equal(got.query, '')
  assert.equal(got.contentType, '')
  assert.equal(got.archivedFilter, '')
  assert.equal(got.dateFrom, '')
  assert.equal(got.dateTo, '')
  assert.equal(got.scrollTop, 0)
})

test('scrollTop 为负数 → 收敛成 0', () => {
  const storage = memoryStorage({
    [QUERY_HISTORY_KEY]: JSON.stringify({ ...SAMPLE, v: QUERY_HISTORY_VERSION, at: Date.now(), scrollTop: -50 }),
  })
  assert.equal(readSnapshot(Date.now(), storage).scrollTop, 0)
})

test('at 缺失或非数字 → 视为过期（无法判定年龄的快照不可信）', () => {
  for (const at of [undefined, 'yesterday', 0, -1]) {
    const storage = memoryStorage({
      [QUERY_HISTORY_KEY]: JSON.stringify({ ...SAMPLE, v: QUERY_HISTORY_VERSION, at }),
    })
    assert.equal(readSnapshot(Date.now(), storage), null, `at=${String(at)} 应判过期`)
  }
})

test('clearSnapshot 后读不到', () => {
  const storage = memoryStorage()
  writeSnapshot(SAMPLE, storage)
  clearSnapshot(storage)
  assert.equal(readSnapshot(Date.now(), storage), null)
})

test('clearSnapshot 对空存储无副作用', () => {
  const storage = memoryStorage()
  clearSnapshot(storage)
  assert.equal(storage.map.size, 0)
})

test('存储读写抛异常 → 静默降级，不把面板拖崩', () => {
  const throwing = {
    getItem: () => { throw new Error('SecurityError: localStorage denied') },
    setItem: () => { throw new Error('QuotaExceededError') },
    removeItem: () => { throw new Error('SecurityError') },
  }
  assert.doesNotThrow(() => writeSnapshot(SAMPLE, throwing))
  assert.equal(readSnapshot(Date.now(), throwing), null)
  assert.doesNotThrow(() => clearSnapshot(throwing))
})

test('clampScroll：界内原值、负数归零、超界压到上界、容器比内容高归零', () => {
  assert.equal(clampScroll(300, 1000, 400), 300, '界内原值')
  assert.equal(clampScroll(-20, 1000, 400), 0, '负数归零')
  assert.equal(clampScroll(5000, 1000, 400), 600, '超界压到 scrollHeight-clientHeight')
  assert.equal(clampScroll(120, 300, 400), 0, '内容比可视区还矮 → 无处可滚')
  assert.equal(clampScroll(0, 1000, 400), 0, '零就是零')
  assert.equal(clampScroll(NaN, 1000, 400), 0, 'NaN 归零')
})

test('开关关闭的语义：clearSnapshot 之后重开读不到（不留陈旧现场）', () => {
  const storage = memoryStorage()
  writeSnapshot(SAMPLE, storage)
  clearSnapshot(storage)              // 用户把开关从开切到关
  assert.equal(readSnapshot(Date.now(), storage), null, '关开关后不得恢复关之前的老现场')
})
