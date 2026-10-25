import { readFileSync, writeFileSync } from 'node:fs'

// ── 1. card.tsx：corpusSource / drsBaseUrl 两行 + DRS 状态行 ───────────────
let card = readFileSync('src/client/card.tsx', 'utf8')
const NL = card.includes('\r\n') ? '\r\n' : '\n'
const crlf = (s) => s.split('\n').join(NL)

const rowsAnchor = crlf(`  ]

  const indexBlock = IndexBlock({ t })`)
if (!card.includes(rowsAnchor)) throw new Error('card rows anchor missing')
const rowsNew = crlf(`    createElement(Row, {
      key: 'corpus',
      title: translate(t, 'card.corpusSource'),
      desc: translate(t, 'card.corpusSource.desc'),
      control: createElement('div', { className: 'dsws_seg', role: 'group' },
        (['drs', 'native'] as const).map(source => createElement('button', {
          key: source,
          type: 'button',
          className: \`dsws_segBtn\${(value.corpusSource ?? 'drs') === source ? ' dsws_segBtnActive' : ''}\`,
          'aria-pressed': (value.corpusSource ?? 'drs') === source,
          disabled: !writable,
          onClick: () => { void scope.set('corpusSource', source) },
        }, source === 'drs' ? translate(t, 'card.mode.drs') : translate(t, 'card.mode.native')))),
    }),
    createElement(Row, {
      key: 'drsBaseUrl',
      title: translate(t, 'card.drsBaseUrl'),
      desc: translate(t, 'card.drsBaseUrl.desc'),
      control: createElement('input', {
        type: 'text',
        disabled: !writable,
        defaultValue: value.drsBaseUrl ?? '',
        placeholder: 'http://127.0.0.1:8080',
        style: { width: '220px', boxSizing: 'border-box' },
        className: 'dsws_search',
        onBlur: (e: { target: { value: string } }) => { void scope.set('drsBaseUrl', e.target.value) },
        onKeyDown: (e: { key: string; currentTarget: { blur: () => void } }) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        },
      }),
    }),
  ]

  const indexBlock = IndexBlock({ t })`)
card = card.split(rowsAnchor).join(rowsNew)

const statusAnchor = crlf(`      createElement('span', { key: 'd', className: 'dsws_setDesc' }, statusLine),`)
if (!card.includes(statusAnchor)) throw new Error('card status anchor missing')
const statusNew = crlf(`      createElement('span', { key: 'd', className: 'dsws_setDesc' }, statusLine),
      // DRS 可用性（硬依赖）：内容检索的唯一来源；不可用时给出原因，不让人猜。
      createElement('span', { key: 'drs', className: 'dsws_setDesc' },
        status === null
          ? translate(t, 'card.drsStatus.reading')
          : status.available === true
            ? translate(t, 'card.drsStatus.up')
            : translate(t, 'card.drsStatus.down', { reason: status.reason ?? 'drs-unavailable' })),`)
card = card.split(statusAnchor).join(statusNew)
writeFileSync('src/client/card.tsx', card, 'utf8')
console.log('card.tsx: corpusSource/drsBaseUrl rows + DRS status added')

// ── 2. locales：zh + en 新键 ─────────────────────────────────────────────
let loc = readFileSync('src/client/locales.ts', 'utf8')
const LNL = loc.includes('\r\n') ? '\r\n' : '\n'
const zhAdd = [
  "  'card.corpusSource': '语料源',",
  "  'card.corpusSource.desc': '内容检索的语料来自 DRS 投影库（硬依赖）；native 仅保留标题/头部元数据面。',",
  "  'card.mode.drs': 'DRS 投影库',",
  "  'card.mode.native': '本地会话服务',",
  "  'card.drsBaseUrl': 'DRS 基址',",
  "  'card.drsBaseUrl.desc': '空=自动（首个 trustedHosts 条目，再退 http://127.0.0.1:8080）。',",
  "  'card.drsStatus.up': '内容检索可用（DRS 在线）。',",
  "  'card.drsStatus.down': '内容检索不可用：DRS 未就绪（{reason}）。',",
  "  'card.drsStatus.reading': '正在探测 DRS…',",
].join(LNL)
const enAdd = [
  "  'card.corpusSource': 'Corpus source',",
  "  'card.corpusSource.desc': 'Content search reads the DRS projection DB (hard dependency); native keeps title/header metadata only.',",
  "  'card.mode.drs': 'DRS projection',",
  "  'card.mode.native': 'Local session service',",
  "  'card.drsBaseUrl': 'DRS base URL',",
  "  'card.drsBaseUrl.desc': 'Empty = auto (first trustedHosts entry, then http://127.0.0.1:8080).',",
  "  'card.drsStatus.up': 'Content search available (DRS online).',",
  "  'card.drsStatus.down': 'Content search unavailable: DRS not ready ({reason}).',",
  "  'card.drsStatus.reading': 'Probing DRS…',",
].join(LNL)

if (!loc.includes("'card.corpusSource'")) {
  // zh 与 en 对象各自在 `export const zh = {` / `export const en: Dict = {` 后插入
  const zhAnchor = `export const zh = {${LNL}`
  const enAnchor = `export const en: Dict = {${LNL}`
  if (!loc.includes(zhAnchor) || !loc.includes(enAnchor)) throw new Error('locale dict anchors missing')
  loc = loc.replace(zhAnchor, zhAnchor + zhAdd + LNL)
  loc = loc.replace(enAnchor, enAnchor + enAdd + LNL)
  writeFileSync('src/client/locales.ts', loc, 'utf8')
  console.log('locales: drs keys added (zh/en)')
}
