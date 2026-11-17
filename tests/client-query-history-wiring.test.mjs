#!/usr/bin/env node
/**
 * 「保留搜索历史」的接线结构断言（对**构建产物** `lib/client.js` 跑）。
 *
 * 为什么这个用例存在
 * ------------------
 * 本仓跑不了 React 渲染路径（见 `client-store.test.mjs` 的说明），所以没有行为
 * 用例能证明「开关真的接上了」。而这类改动有三种静默失败，全都能通过 typecheck
 * 和 lint：
 *
 * 1. **开关读了但没用** —— `useRememberQuery` 定义了却没人调，面板照旧每次空白。
 * 2. **只接了一半** —— 恢复路径写了，写盘路径漏了；或者只有防抖、没有卸载补写。
 *    后者尤其隐蔽：用户改完筛选立刻点结果，300ms 防抖还没落地，面板已卸载。
 * 3. **产物是旧的** —— 改完 `src/` 忘了 `npm run build`，这个用例对着旧包跑，
 *    断言的是旧代码里本来就有的东西，绿得毫无意义。
 *
 * 第 3 条是本仓踩过的坑（stale-build），所以这里第一条断言就是「产物里必须出现
 * 快照键」——它是「这份产物确实是新的」的指纹。
 *
 * 能证明什么：产物里存在快照键、恢复/写盘/滚动三条链路都在、开关走的是
 * `=== true` 而不是 `!== false`。
 * 不能证明什么：真机上点一下确实恢复了 —— 那必须是 GUI 冒烟。
 *
 * Usage: node tests/client-query-history-wiring.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', 'lib', 'client.js')
const source = readFileSync(BUNDLE, 'utf8')

// ── 0. 产物新鲜度指纹 ────────────────────────────────────────────────
// 没有这一条，下面所有断言都可能是在对一个不含本功能的旧包跑。
assert.ok(
  source.includes('dsh-search-index.queryHistory'),
  'lib/client.js 里没有快照键：产物是旧的，先跑 npm run build',
)

// ── 1. 存储三件套都在产物里 ──────────────────────────────────────────
for (const fn of ['readSnapshot', 'writeSnapshot', 'clearSnapshot', 'clampScroll']) {
  assert.ok(
    source.includes(fn),
    `产物里找不到 ${fn}：query-history 模块没有被打进 client 半身`,
  )
}

// ── 2. 开关读取存在，且方向是 `=== true` ─────────────────────────────
// `!== false` 会把 undefined 判成「开」，等于未经同意就记忆用户输入。
assert.ok(source.includes('rememberQuery'), '产物里没有 rememberQuery：开关没接进面板')
assert.ok(
  source.includes('rememberQuery === true'),
  'rememberQuery 必须按 `=== true` 判定；`!== false` 会让缺省变成「开」',
)
assert.ok(
  !source.includes('rememberQuery !== false'),
  '发现 `rememberQuery !== false`：方向反了，缺省会变成「开」',
)

// ── 3. 三条链路：首帧恢复 / 卸载补写 / 滚动恢复 ──────────────────────
assert.ok(
  source.includes('restoreRef'),
  '产物里没有 restoreRef：滚动位置恢复链路缺失',
)
assert.ok(
  source.includes('scrollRef'),
  '产物里没有 scrollRef：滚动位置采集链路缺失',
)
assert.ok(
  /latestRef/.test(source),
  '产物里没有 latestRef：卸载 cleanup 会读到闭包里的旧 state',
)
assert.ok(
  source.includes('onScroll'),
  '产物里没有 onScroll：列表滚动位置没有被采集',
)

// ── 4. 防抖写盘存在（300ms）──────────────────────────────────────────
// 产物被格式化过（换行 + 缩进），所以不能指望 `setTimeout(fn, 300)` 在同一行；
// 改成「找每个 setTimeout，看它闭合处是否带 300」。
const setTimeoutHeads = [...source.matchAll(/setTimeout\(/g)].map(m => m.index)
const hasDebounce = setTimeoutHeads.some((at) => {
  const window = source.slice(at, at + 3000)
  return /\},\s*300\)\s*;/.test(window) || /,\s*300\)\s*;/.test(window)
})
assert.ok(
  hasDebounce,
  '找不到 300ms 防抖：筛选变更后不会写快照',
)

// ── 5. 配置三面同值：默认 false ──────────────────────────────────────
const repoRoot = join(HERE, '..')
const configSrc = readFileSync(join(repoRoot, 'src', 'config.ts'), 'utf8')
const hostSrc = readFileSync(join(repoRoot, 'src', 'index.ts'), 'utf8')
const bridgeSrc = readFileSync(join(repoRoot, 'src', 'host', 'settings-bridge.ts'), 'utf8')

assert.ok(
  /rememberQuery:\s*false/.test(configSrc),
  'src/config.ts 的 DEFAULT_CONFIG.rememberQuery 必须为 false',
)
assert.ok(
  /rememberQuery:\s*z\.boolean\(\)\.default\(false\)\.volatile\(\)/.test(hostSrc),
  'src/index.ts 的 Config 必须有 rememberQuery: z.boolean().default(false).volatile()',
)
assert.ok(
  /rememberQuery:\s*z\.boolean\(\)\.default\(false\)/.test(bridgeSrc),
  'src/host/settings-bridge.ts 的 SwitchNsSchema 必须有 rememberQuery（纯 plain，不带 volatile）',
)
assert.ok(
  !/rememberQuery:\s*z\.boolean\(\)\.default\(false\)\.volatile\(\)/.test(bridgeSrc),
  '老线 schema 不得带 volatile：settings.register 会拒收',
)

// ── 6. 设置卡有这一行 ────────────────────────────────────────────────
const cardSrc = readFileSync(join(repoRoot, 'src', 'client', 'card.tsx'), 'utf8')
assert.ok(
  cardSrc.includes("scope.set('rememberQuery'"),
  '设置卡没有写 rememberQuery 的入口：开关只能读不能改',
)
assert.ok(
  /value\.rememberQuery \?\? false/.test(cardSrc),
  '设置卡的初值必须 `?? false`，与面板同方向',
)

console.log('client-query-history-wiring: 产物指纹、三条链路、开关方向、三面配置全部对上 ok')
