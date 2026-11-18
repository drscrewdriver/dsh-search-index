#!/usr/bin/env node
/**
 * 异常台账 + 排查编排（issue #4 后续）。
 *
 * 这条 issue 暴露的真问题不是「某一次搜索失败」，而是**失败信息到不了排查的人
 * 手里**：detail 只进宿主日志、界面只画四个字。0.7.22 修了「显示当下这一次」，
 * 本文件钉的是另外两段：
 *
 *  - 台账：连续踩坑时能回答「先后踩了哪几个坑、各几次」，且同类重复不塞满缓冲；
 *  - 编排：报告必须**每一步都带可执行命令**，不是「请检查配置」这种空话。
 *
 * Usage: node --import tsx tests/doctor.test.mjs
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { FailureLedger, diagnose, renderDoctorReport, LEDGER_CAPACITY } from '../src/host/index/doctor.ts'

/** 一份「一切正常」的基线输入，各用例按需覆盖。 */
function baseline(over = {}) {
  return {
    mode: 'in-process',
    notActivated: false,
    transport: 'auto',
    local: { schemaVersion: '3', expected: '3', sessions: 21, dir: 'C:/Users/u/.dsh/cache/dsh-reference-session-collector' },
    indexed: 21,
    failures: [],
    hostVersion: '0.2.2-rc.3',
    ...over,
  }
}

// ── 台账 ────────────────────────────────────────────────────────────────

test('台账：同档位同 detail 重复只累加计数，不塞满缓冲', () => {
  const ledger = new FailureLedger()
  for (let i = 0; i < 20; i += 1) {
    ledger.record({ code: 'drs-empty', detail: '未找到投影库', op: 'content-search', at: 1000 + i })
  }
  const snap = ledger.snapshot()
  assert.equal(snap.length, 1, '同一件事出现 20 次只留一行')
  assert.equal(snap[0].count, 20)
  assert.equal(snap[0].at, 1019, '时刻更新为最近一次')
})

test('台账：不同 detail 视为不同的坑，各留一行', () => {
  const ledger = new FailureLedger()
  ledger.record({ code: 'drs-empty', detail: '未找到投影库：A', op: 'content-search', at: 1 })
  ledger.record({ code: 'drs-empty', detail: '投影库内尚无会话行', op: 'content-search', at: 2 })
  assert.equal(ledger.snapshot().length, 2, '同档位不同成因必须分开记 —— 它们要跑的命令不同')
})

test('台账：容量满时淘汰最旧的，且计数同步收缩', () => {
  const ledger = new FailureLedger()
  for (let i = 0; i < LEDGER_CAPACITY + 5; i += 1) {
    ledger.record({ code: `code-${i}`, op: 'content-search', at: i })
  }
  const snap = ledger.snapshot()
  assert.equal(snap.length, LEDGER_CAPACITY)
  assert.equal(snap[0].code, `code-${LEDGER_CAPACITY + 4}`, '最近的在前')
  assert.ok(!snap.some((r) => r.code === 'code-0'), '最旧的已被淘汰')
})

test('台账：snapshot 按时刻倒序，最近的在前', () => {
  const ledger = new FailureLedger()
  ledger.record({ code: 'a', op: 'x', at: 100 })
  ledger.record({ code: 'b', op: 'x', at: 300 })
  ledger.record({ code: 'c', op: 'x', at: 200 })
  assert.deepEqual(ledger.snapshot().map((r) => r.code), ['b', 'c', 'a'])
})

test('台账：countOf 跨 detail 汇总同档位', () => {
  const ledger = new FailureLedger()
  ledger.record({ code: 'drs-empty', detail: 'A', op: 'x', at: 1 })
  ledger.record({ code: 'drs-empty', detail: 'B', op: 'x', at: 2 })
  ledger.record({ code: 'drs-empty', detail: 'B', op: 'x', at: 3 })
  assert.equal(ledger.countOf('drs-empty'), 3)
  assert.equal(ledger.countOf('drs-missing'), 0)
})

test('台账：clear 之后彻底干净', () => {
  const ledger = new FailureLedger()
  ledger.record({ code: 'a', op: 'x', at: 1 })
  ledger.clear()
  assert.deepEqual(ledger.snapshot(), [])
  assert.equal(ledger.countOf('a'), 0)
})

// ── 编排 ────────────────────────────────────────────────────────────────

test('编排：一切正常时全部 ok，且不塞无意义的命令', () => {
  const steps = diagnose(baseline(), 'win32')
  assert.ok(steps.every((s) => s.verdict === 'ok' || s.verdict === 'warn'), '基线不应出现 fail')
  const withCommand = steps.filter((s) => s.command !== undefined)
  assert.equal(withCommand.length, 0, '正常状态不该给用户一串命令')
})

test('编排：drs-empty 时必须给出「去哪个目录看」的可执行命令', () => {
  const steps = diagnose(
    baseline({ mode: 'none', reason: 'drs-empty', detail: '未找到投影库：C:/x/projection.db' }),
    'win32',
  )
  const step = steps.find((s) => s.check === '投影库文件是否存在')
  assert.ok(step, 'drs-empty 必须有「投影库文件是否存在」这一步')
  assert.equal(step.verdict, 'fail')
  assert.match(step.command, /^dir "/, 'Windows 上必须是 dir "路径"')
  // 命令列的是**目录**（用户要在里面找 projection.db），所以断言目录名而不是文件名。
  assert.ok(step.command.includes('dsh-reference-session-collector'), '命令必须指向真实目录')
})

test('编排：POSIX 平台给 ls -la 而不是 dir', () => {
  const steps = diagnose(baseline({ reason: 'drs-empty' }), 'linux')
  const step = steps.find((s) => s.check === '投影库文件是否存在')
  assert.match(step.command, /^ls -la "/)
})

test('编排：drs-not-activated 必须两步 —— 先看清单，再加插件', () => {
  const steps = diagnose(baseline({ notActivated: true, reason: 'drs-not-activated' }), 'win32')
  const checks = steps.filter((s) => s.verdict === 'fail').map((s) => s.command)
  assert.ok(checks.some((c) => c.includes('plugin --profile') && c.includes('list')), '第一步应是看清单')
  assert.ok(checks.some((c) => c.includes('add dsh-reference-session-collector')), '第二步应是加插件')
})

test('编排：drs-missing 时后续步骤不该再喊「加插件」', () => {
  const steps = diagnose(baseline({ reason: 'drs-missing', detail: 'Cannot find module' }), 'win32')
  const failCmds = steps.filter((s) => s.verdict === 'fail').map((s) => s.command ?? '')
  assert.ok(failCmds.some((c) => c.includes('npm ls')), '依赖没装成时先查解析')
  assert.ok(!failCmds.some((c) => c.includes('add dsh-reference-session-collector')), '包都没有，加插件是错的动作')
})

test('编排：schema 不符时给升级命令，绝不给「清库」', () => {
  const steps = diagnose(
    baseline({ reason: 'drs-schema-mismatch', local: { schemaVersion: '2', expected: '3', sessions: 5, dir: 'D' } }),
    'win32',
  )
  const step = steps.find((s) => s.check === '投影库 schema 版本')
  assert.equal(step.verdict, 'fail')
  assert.match(step.command, /dsh-reference-session-collector@latest/)
  assert.ok(!/delete|rm |drop|清库/u.test(step.command), '诊断绝不能建议清库')
})

test('编排：浏览器访问被拒是 warn 不是 fail（桌面版默认行为）', () => {
  const steps = diagnose(baseline({ mode: 'in-process', reason: 'browser-access-denied' }), 'win32')
  const step = steps.find((s) => s.check.includes('禁止浏览器访问'))
  assert.equal(step.verdict, 'warn', '这不是故障，是桌面版的既定行为')
})

test('编排：本地索引为 0 时给「整理索引」而不是让用户去查投影库', () => {
  const steps = diagnose(baseline({ indexed: 0 }), 'win32')
  const step = steps.find((s) => s.check.includes('本地索引'))
  assert.equal(step.verdict, 'warn')
  assert.match(step.command, /整理索引/)
})

test('编排：有台账时列出「最近的失败记录」并说明会丢', () => {
  const steps = diagnose(
    baseline({ failures: [{ code: 'drs-empty', detail: '未找到投影库', op: 'content-search', at: 1, count: 3 }] }),
    'win32',
  )
  const step = steps.find((s) => s.check === '最近的失败记录')
  assert.ok(step)
  assert.match(step.observed, /drs-empty/)
  assert.match(step.observed, /× 3/, '次数必须显示出来（形如 × 3）')
  assert.match(step.why, /重启/u, '必须说明台账是内存的')
})

// ── 报告 ────────────────────────────────────────────────────────────────

test('报告：首行给出结论，且是 Markdown（可直接粘进 issue）', () => {
  const report = renderDoctorReport(
    baseline({ mode: 'none', reason: 'drs-empty', detail: '未找到投影库：C:/x/projection.db' }),
    'win32',
  )
  assert.match(report, /^## dsh-search-index 诊断报告/m)
  // mode:'none' 本身也算一项阻断（无可用通道），所以这里是 2 项。
  assert.match(report, /\*\*结论\*\*：发现 2 项阻断/, '结论必须前置且量化')
  assert.match(report, /### 环境/)
  assert.match(report, /### 排查步骤/)
})

test('报告：每一步都带观测值，fail 的带命令', () => {
  const report = renderDoctorReport(
    baseline({ mode: 'none', reason: 'drs-empty', detail: '未找到投影库：C:/x/projection.db' }),
    'win32',
  )
  assert.match(report, /❌ \*\*投影库文件是否存在\*\*/)
  assert.match(report, /- 下一步：`dir "/, 'fail 项必须带可执行命令')
  assert.match(report, /- 为什么：/, 'fail 项必须解释为什么重要')
})

test('报告：台账段按行列出，含次数与时刻', () => {
  const report = renderDoctorReport(
    baseline({
      failures: [
        { code: 'drs-empty', detail: '未找到投影库', op: 'content-search', at: Date.UTC(2026, 10, 18, 1, 30), count: 7 },
        { code: 'deep-sync-failed', op: 'index-deep-sync', at: Date.UTC(2026, 10, 18, 1, 31), count: 1 },
      ],
    }),
    'win32',
  )
  assert.match(report, /### 失败台账/)
  assert.match(report, /drs-empty/)
  assert.match(report, /×7/, '报告里的次数')
  assert.match(report, /2026-11-18 01:30:00/)
})

test('报告：无台账时不出台账段（不制造空标题）', () => {
  const report = renderDoctorReport(baseline(), 'win32')
  assert.ok(!report.includes('### 失败台账'))
})

test('编排：ok 的步骤不带 why（避免「通过却像有问题」的误读）', () => {
  const steps = diagnose(baseline(), 'win32')
  for (const step of steps) {
    if (step.verdict === 'ok') {
      assert.equal(step.why, undefined, `ok 步骤不该带解释：${step.check}`)
    }
  }
})

test('报告：正常状态说「各项检查通过」，不吓唬人', () => {
  const report = renderDoctorReport(baseline(), 'win32')
  assert.match(report, /各项检查通过/)
})
