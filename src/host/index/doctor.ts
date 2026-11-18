/**
 * 异常台账 + 排查编排（issue #4 的后续）。
 *
 * 为什么单独一个模块：`content-search` 失败的原因分散在三层（宿主路由 / DRS
 * HTTP 臂 / 进程内只读臂），而用户能提供的只有一句「搜不出来」。0.7.22 把
 * detail 显示出来了，但那只是**当下一次**的失败；用户连续踩坑时，真正有用的是
 * 「这一段时间里失败了几次、每次是哪一档、最早的第一次是什么」。
 *
 * 三段职责，刻意分开：
 *   1. 记账（{@link FailureLedger}）—— 纯内存环形缓冲，不写盘、不占内存无上限；
 *   2. 分诊（{@link diagnose}）—— 纯函数，把探针结果 + 台账合成一份「问题清单」；
 *   3. 编排（{@link renderDoctorReport}）—— 纯函数，把清单排成可粘贴的报告，
 *      每步带**可执行命令**（不是「请检查配置」这种无法执行的措辞）。
 *
 * 三层都是纯的：没有时间变量、没有 IO、没有全局状态（台账由调用方持有）。
 */

/** 一条失败记录。字段刻意少而稳：能归因即可，不追求全量。 */
export interface FailureRecord {
  /** 失败档位（`DrsFailureCode` 或本地索引侧的自造码）。 */
  code: string
  /** 原始细节（路径 / HTTP 码 / 模块名）。可能为空。 */
  detail?: string
  /** 哪个操作失败的：`content-search` / `index-rebuild` / `index-deep-sync`。 */
  op: string
  /** 发生时刻（ms）。台账不排序，靠它给「最近一次 / 最早一次」。 */
  at: number
}

/** 台账容量。够覆盖「用户从发现坏了到决定报 issue」这段，又不至于无限涨。 */
export const LEDGER_CAPACITY = 50

/**
 * 失败台账：固定容量的环形缓冲，同档位同 detail 连续重复时只累加计数。
 *
 * 为什么合并重复：一次搜索会打多次请求，同一个「投影库未建立」可能在几秒内
 * 出现十几次。逐条记会让台账被同一件事塞满，看不出「先后踩了不同的坑」。
 */
export class FailureLedger {
  private readonly records: FailureRecord[] = []
  /** `code|detail|op` → 出现次数。与 records 同步维护。 */
  private readonly counts = new Map<string, number>()

  /** 记一条。返回是否真的写入了（容量满且是重复项时为 false）。 */
  record(entry: FailureRecord): boolean {
    const key = `${entry.code}|${entry.detail ?? ''}|${entry.op}`
    const existing = this.counts.get(key)
    if (existing !== undefined) {
      this.counts.set(key, existing + 1)
      // 重复项只更新计数与最近时刻，不新增行 —— 台账要显示「不同的坑」。
      const hit = this.records.find((r) => `${r.code}|${r.detail ?? ''}|${r.op}` === key)
      if (hit !== undefined) hit.at = entry.at
      return true
    }
    this.records.push(entry)
    this.counts.set(key, 1)
    if (this.records.length > LEDGER_CAPACITY) {
      const dropped = this.records.shift()
      if (dropped !== undefined) {
        const droppedKey = `${dropped.code}|${dropped.detail ?? ''}|${dropped.op}`
        const n = this.counts.get(droppedKey) ?? 1
        if (n <= 1) this.counts.delete(droppedKey)
        else this.counts.set(droppedKey, n - 1)
      }
    }
    return true
  }

  /** 快照（按发生时刻倒序：最近的在前）。 */
  snapshot(): Array<FailureRecord & { count: number }> {
    return [...this.records]
      .sort((a, b) => b.at - a.at)
      .map((r) => ({ ...r, count: this.counts.get(`${r.code}|${r.detail ?? ''}|${r.op}`) ?? 1 }))
  }

  /** 某档位累计出现次数（跨 detail）。 */
  countOf(code: string): number {
    let total = 0
    for (const [key, n] of this.counts) {
      if (key.startsWith(`${code}|`)) total += n
    }
    return total
  }

  /** 清空（用户手动清 / 测试用）。 */
  clear(): void {
    this.records.length = 0
    this.counts.clear()
  }

  /** 台账里出现过的档位（去重，按首次出现顺序）。 */
  codes(): string[] {
    const seen = new Set<string>()
    const out: string[] = []
    for (const r of this.records) {
      if (seen.has(r.code)) continue
      seen.add(r.code)
      out.push(r.code)
    }
    return out
  }
}

/** 一步排查动作。`command` 必须可执行 —— 这是本模块的存在理由。 */
export interface DoctorStep {
  /** 这一条在查什么（一句话，用户读得懂）。 */
  check: string
  /** 结论：`ok` / `warn` / `fail` / `unknown`。 */
  verdict: 'ok' | 'warn' | 'fail' | 'unknown'
  /** 观测到的值（原样，不美化）。 */
  observed: string
  /** 下一步可执行的命令；`undefined` 表示这条无需操作。 */
  command?: string
  /** 为什么这条重要（短，一句话）。 */
  why?: string
}

/** 诊断输入：全是已经读好的数据，本函数不做任何探测。 */
export interface DoctorInput {
  /** 当前实际可用通道：http / in-process / none。 */
  mode: string
  /** 通道探针档位（`ok` 时无）。 */
  reason?: string
  /** 探针细节。 */
  detail?: string
  /** DRSC 路由 404（装了但没激活）。 */
  notActivated: boolean
  /** 配置面选择的通道。 */
  transport: string
  /** 进程内库明细。 */
  local: { schemaVersion?: string; expected?: string; sessions?: number; dir?: string }
  /** 本地索引条数。 */
  indexed: number
  /** 失败台账快照。 */
  failures: Array<FailureRecord & { count: number }>
  /** 宿主版本串（用户报 issue 时要贴）。 */
  hostVersion?: string
}

/** 一步「复制即用」的命令：Windows 与 POSIX 都要能跑，所以按平台给。 */
function dirListCommand(dir: string | undefined, platform: NodeJS.Platform): string {
  const target = dir ?? '<未解析>'
  return platform === 'win32'
    ? `dir "${target}"`
    : `ls -la "${target}"`
}

/**
 * 把探针结果 + 台账编排成一份排查清单。
 *
 * 顺序是**由因到果**，不是由严重到轻：先确认依赖在不在，再看库建没建，
 * 再看通道通不通，最后才看历史失败。用户从上往下做，做完一条就少一种可能。
 *
 * @param input - 已经读好的观测数据。
 * @param platform - 决定命令的平台形态（注入以便测试）。
 * @returns 有序的排查步骤。
 */
export function diagnose(input: DoctorInput, platform: NodeJS.Platform = process.platform): DoctorStep[] {
  const steps: DoctorStep[] = []
  const dir = input.local.dir

  // ① 依赖是否解析得到（包没装 = 后面都不用查了）
  if (input.reason === 'drs-missing') {
    steps.push({
      check: '内容检索依赖包能否解析',
      verdict: 'fail',
      observed: input.detail ?? '未解析到 dsh-reference-session-collector',
      command: 'npm ls dsh-reference-session-collector',
      why: '依赖没装成，投影库与查询面都不存在；后面的步骤都会连带失败。',
    })
  } else {
    steps.push({
      check: '内容检索依赖包能否解析',
      verdict: 'ok',
      observed: '已解析',
    })
  }

  // ② DRSC 是否作为插件**激活**（装得上 ≠ 激活，这是最常见的坑）
  if (input.notActivated || input.reason === 'drs-not-activated') {
    steps.push({
      check: 'dsh-reference-session-collector 是否作为插件激活',
      verdict: 'fail',
      observed: input.notActivated
        ? '宿主路由返回 404（包在，但插件未激活）'
        : (input.detail ?? '路由 404'),
      command: 'dsh plugin --profile <你的profile名> list',
      why: '宿主只扫 profile 顶层 dependencies；作为传递依赖装上来的包装得上但不激活，投影库不会更新。',
    })
    steps.push({
      check: '把 DRSC 显式加进 profile 并重启宿主',
      verdict: 'fail',
      observed: '未激活',
      command: 'dsh plugin --profile <你的profile名> add dsh-reference-session-collector',
      why: '加完必须**完全重启 dsh web**——浏览器刷新不重载宿主半。',
    })
  } else {
    steps.push({
      check: 'dsh-reference-session-collector 是否作为插件激活',
      verdict: 'ok',
      observed: '已激活',
    })
  }

  // ③ 投影库文件在不在（drs-empty 的四种成因里，这条最常见）
  if (input.reason === 'drs-empty') {
    steps.push({
      check: '投影库文件是否存在',
      verdict: 'fail',
      observed: input.detail ?? '投影库尚未建立',
      command: dirListCommand(dir, platform),
      why: '目录里应有 projection.db；没有 = 首轮同步从没跑完，有但很小 = 建库中断。',
    })
  } else if (input.local.sessions !== undefined) {
    steps.push({
      check: '投影库内会话数',
      verdict: input.local.sessions > 0 ? 'ok' : 'warn',
      observed: `${input.local.sessions} 条`,
      ...(input.local.sessions > 0 ? {} : { command: dirListCommand(dir, platform) }),
    })
  } else {
    steps.push({
      check: '投影库内会话数',
      verdict: 'unknown',
      observed: '进程内只读臂未接上，读不到',
      command: dirListCommand(dir, platform),
    })
  }

  // ④ schema 版本对不对（不符只报错、绝不清库）
  if (input.reason === 'drs-schema-mismatch') {
    steps.push({
      check: '投影库 schema 版本',
      verdict: 'fail',
      observed: `库内 ${input.local.schemaVersion ?? '?'} / 期望 ${input.local.expected ?? '?'}`,
      command: 'npm i dsh-reference-session-collector@latest',
      why: '版本不符时本插件只报错不清库；升级 DRSC 让它自己迁移。',
    })
  } else if (input.local.schemaVersion !== undefined) {
    steps.push({
      check: '投影库 schema 版本',
      verdict: 'ok',
      observed: `${input.local.schemaVersion}（期望 ${input.local.expected ?? '同'}）`,
    })
  }

  // ⑤ 通道：宿主是否禁了非 renderer 访问（桌面版默认行为，不是故障）
  if (input.reason === 'browser-access-denied') {
    steps.push({
      check: '宿主是否禁止浏览器访问本地接口',
      verdict: 'warn',
      observed: '是（桌面版默认行为），已回退进程内只读臂',
      why: '这不是故障：DSH NEXT 桌面版在路由分发前就 403 非 renderer 请求。内容检索应走进程内通道。',
    })
  }

  // ⑥ 当前实际通道
  steps.push({
    check: '内容检索当前走的通道',
    verdict: input.mode === 'none' ? 'fail' : 'ok',
    observed: input.mode === 'none'
      ? `无可用通道（配置为 ${input.transport}）`
      : `${input.mode}（配置为 ${input.transport}）`,
    ...(input.mode === 'none' && input.transport !== 'auto'
      ? {
          command: '在插件设置里把「DRS 连接方式」改回 auto',
          why: 'auto 会先试 HTTP、失败自动切进程内只读库；锁定单一通道会放弃另一条腿。',
        }
      : {}),
  })

  // ⑦ 本地索引（标题搜索用；与内容检索是两套，别混）
  steps.push({
    check: '本地索引（标题搜索用）',
    verdict: input.indexed > 0 ? 'ok' : 'warn',
    observed: `${input.indexed} 条会话`,
    ...(input.indexed > 0
      ? {}
      : {
          command: '点面板里的「整理索引」',
          why: '本地索引为空，标题检索也没数据可查。',
        }),
  })

  // ⑧ 历史失败（台账）
  if (input.failures.length > 0) {
    const top = input.failures[0]
    steps.push({
      check: '最近的失败记录',
      verdict: 'warn',
      observed: `${input.failures.length} 种失败 / 最近一次 ${top.code}${top.detail === undefined ? '' : `（${top.detail}）`} × ${top.count}`,
      why: '台账在内存里，重启宿主即清空；要保留就把下面整段报告贴进 issue。',
    })
  }

  return steps
}

/** 报告里的一行失败明细。 */
function renderFailureLine(record: FailureRecord & { count: number }): string {
  const when = new Date(record.at).toISOString().replace('T', ' ').slice(0, 19)
  const detail = record.detail === undefined || record.detail === '' ? '' : ` — ${record.detail}`
  return `- \`${record.op}\` · **${record.code}**${detail} · ×${record.count} · 最近 ${when}`
}

/**
 * 把诊断清单排成一份**可直接粘贴**的 Markdown 报告。
 *
 * 报 issue 的人拿不到宿主日志，所以报告必须自带：环境、结论、每一步的观测值、
 * 以及下一步要跑什么。格式刻意用 Markdown —— 粘进 GitHub issue 就是可读的。
 *
 * @param input - 与 {@link diagnose} 相同。
 * @param platform - 决定命令形态。
 * @returns Markdown 文本。
 */
export function renderDoctorReport(input: DoctorInput, platform: NodeJS.Platform = process.platform): string {
  const steps = diagnose(input, platform)
  const failures = steps.filter((s) => s.verdict === 'fail')
  const warns = steps.filter((s) => s.verdict === 'warn')
  const headline = failures.length > 0
    ? `发现 ${failures.length} 项阻断（${failures.map((s) => s.check).join(' / ')}）`
    : warns.length > 0
      ? `无阻断，${warns.length} 项需注意`
      : '各项检查通过'

  const lines: string[] = []
  lines.push('## dsh-search-index 诊断报告')
  lines.push('')
  lines.push(`**结论**：${headline}`)
  lines.push('')
  lines.push('### 环境')
  lines.push('')
  lines.push(`- 宿主版本：${input.hostVersion ?? '（未提供）'}`)
  lines.push(`- 内容检索通道：${input.mode}（配置 ${input.transport}）`)
  lines.push(`- 本地索引：${input.indexed} 条会话`)
  lines.push(`- 投影库目录：${input.local.dir ?? '（未解析）'}`)
  lines.push('')
  lines.push('### 排查步骤')
  lines.push('')
  steps.forEach((step, i) => {
    const mark = step.verdict === 'ok' ? '✅' : step.verdict === 'warn' ? '⚠️' : step.verdict === 'fail' ? '❌' : '❔'
    lines.push(`${i + 1}. ${mark} **${step.check}** — ${step.observed}`)
    if (step.why !== undefined) lines.push(`   - 为什么：${step.why}`)
    if (step.command !== undefined) lines.push(`   - 下一步：\`${step.command}\``)
  })
  if (input.failures.length > 0) {
    lines.push('')
    lines.push('### 失败台账（内存，重启即清）')
    lines.push('')
    for (const record of input.failures) lines.push(renderFailureLine(record))
  }
  return lines.join('\n')
}
