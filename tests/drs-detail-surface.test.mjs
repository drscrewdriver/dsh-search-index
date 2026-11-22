#!/usr/bin/env node
/**
 * 内容搜索失败的 detail 表面（issue #4 建立、issue #5 收口）。
 *
 * issue #4：detail 必须随失败一起回到界面（此前只进宿主日志）。
 * issue #5：宿主不再拼任何语言的散文——`messageForDrsFailure`（7 档中文）整体
 * 删除，失败响应只出 `{ code, detail }`；本地化文案由 client 按 code 查字典
 * （`panel.contentErr.*`，10 locale），`{error}` 插槽的数据源换成宿主原始
 * `detail`。非 zh locale 不再混排输出。
 *
 * 断言五件事：
 * 1. `contentSearch` 的失败响应只含 `code: failure.code, detail: failure.detail`，
 *    且宿主全文不再引用 `messageForDrsFailure`；
 * 2. 契约模块已无散文函数；`classifyDrsFailure` 的 detail 原样透传
 *    （无 `（…）` 后缀加工——格式化是 client 的事）；
 * 3. 客户端十语文案都带 `{error}` 占位，否则 translate 无处可插；
 * 4. `drs-empty` 的四种成因各自的 detail 都真的被构造出来（不是空串）；
 * 5. client 把宿主 `detail` 接到 `{error}` 槽（host-api 透传 + panel 数据源）。
 *
 * Usage: node --import tsx tests/drs-detail-surface.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const HOST = readFileSync(join(ROOT, 'src', 'index.ts'), 'utf8')
const LOCAL = readFileSync(join(ROOT, 'src', 'host', 'index', 'drs-local.ts'), 'utf8')

const { classifyDrsFailure } = await import('../src/host/index/drs-contract.ts')

test('issue #5：contentSearch 失败响应只出 code + detail，宿主无散文引用', () => {
  assert.match(
    HOST,
    /return \{ ok: false, code: failure\.code, detail: failure\.detail \}/,
    '失败响应必须是 { ok, code, detail } —— 散文字段 error 已随 issue #5 删除',
  )
  assert.ok(
    !HOST.includes('messageForDrsFailure'),
    '宿主不得再引用 messageForDrsFailure —— 非 zh locale 的面板曾混排输出（issue #5）',
  )
})

test('issue #5：契约模块已无散文函数，classifyDrsFailure 的 detail 原样透传', () => {
  const CONTRACT = readFileSync(join(ROOT, 'src', 'host', 'index', 'drs-contract.ts'), 'utf8')
  assert.ok(
    !CONTRACT.includes('messageForDrsFailure'),
    '契约模块不得再有散文函数（issue #5 删除）',
  )
  const failure = classifyDrsFailure(new Error('DRS ?op=probe → HTTP 404 XYZ-DETAIL'))
  assert.equal(failure.code, 'drs-not-activated')
  assert.equal(
    failure.detail,
    'DRS ?op=probe → HTTP 404 XYZ-DETAIL',
    `detail 必须原样透传，不得被宿主加工（实际：${failure.detail}）`,
  )
  assert.ok(!failure.detail.includes('（'), '宿主侧不得出现括号后缀加工')
})

test('issue #4：drs-empty 的四种成因都真的构造了 detail', () => {
  // 空 detail 会让「带 detail 后缀」形同虚设，所以钉的是构造点本身。
  const markers = [
    '未找到投影库：',
    '投影库无法打开：',
    '投影库缺少 meta.schema_version',
    '投影库内尚无会话行',
  ]
  for (const marker of markers) {
    assert.ok(LOCAL.includes(marker), `drs-empty 的成因 detail 缺失：${marker}`)
  }
})

test('issue #4：客户端十语文案都带 {error} 占位', () => {
  const LOCALES = readFileSync(join(ROOT, 'src', 'client', 'locales.ts'), 'utf8')
  const codes = [
    'browser-access-denied', 'drs-http-unreachable', 'drs-http-error',
    'drs-not-activated', 'drs-missing', 'drs-empty', 'drs-schema-mismatch',
  ]
  /**
   * 逐行解析而不是正则取引号内容：法语/意大利语的 `L\'hôte` 带转义单引号，
   * `'([^']*)'` 会在那里截断，把「有 {error}」误判成「没有」。
   */
  const missing = []
  let seen = 0
  for (const line of LOCALES.split('\n')) {
    const m = /^\s*'panel\.contentErr\.([\w-]+)':\s*'(.*)',\s*$/.exec(line)
    if (m === null || !codes.includes(m[1])) continue
    seen += 1
    if (!m[2].includes('{error}')) missing.push(`${m[1]}: ${m[2].slice(0, 40)}`)
  }
  assert.equal(seen, codes.length * 10, `应扫到 ${codes.length * 10} 条 contentErr 文案，实际 ${seen}`)
  assert.deepEqual(missing, [], '这些 contentErr 文案缺 {error} 占位，detail 会无处可插')
})

test('issue #5：client 把宿主 detail 接到 {error} 槽', () => {
  const HOST_API = readFileSync(join(ROOT, 'src', 'client', 'host-api.ts'), 'utf8')
  assert.match(
    HOST_API,
    /typeof record\?\.detail === 'string' \? \{ detail: record\.detail \} : \{\}/,
    'callHost 失败分支必须透传宿主 detail',
  )
  const PANEL = readFileSync(join(ROOT, 'src', 'client', 'panel.tsx'), 'utf8')
  assert.match(
    PANEL,
    /panel\.contentErr\.\$\{activeContent\.code\}` as LocaleKey, \{ error: activeContent\.detail \?\? '' \}/,
    '`{error}` 槽的数据源必须是宿主原始 detail（宿主散文已随 issue #5 删除）',
  )
})
