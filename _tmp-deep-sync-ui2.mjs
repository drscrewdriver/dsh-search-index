import { readFileSync, writeFileSync } from 'node:fs'

// locales：深度同步文案（zh 基准 + en 完整；其余语种 Partial 留缺省回退 zh）
let loc = readFileSync('src/client/locales.ts', 'utf8')
const NL = loc.includes('\r\n') ? '\r\n' : '\n'
if (!loc.includes("'panel.deepSync'")) {
  const zhAdd = [
    "  'panel.deepSync': '深度同步',",
    "  'panel.deepSync.hint': '先让 drsc 慢速重扫修好投影库，再把本地索引整理一遍（用于定位不到 / 新会话搜不到）。',",
    "  'panel.deepSync.drs': 'drsc 同步中…',",
    "  'panel.deepSync.rebuild': '索引整理中…',",
    "  'panel.deepSync.done': '同步完成',",
    "  'panel.deepSync.failed': '同步失败',",
  ].join(NL)
  const enAdd = [
    "  'panel.deepSync': 'Deep sync',",
    "  'panel.deepSync.hint': 'Ask drsc to re-scan slowly, then rebuild the local index (for failed locating or missing new sessions).',",
    "  'panel.deepSync.drs': 'drsc syncing…',",
    "  'panel.deepSync.rebuild': 'Rebuilding index…',",
    "  'panel.deepSync.done': 'Sync done',",
    "  'panel.deepSync.failed': 'Sync failed',",
  ].join(NL)
  const zhAnchor = 'export const zh = {' + NL
  const enAnchor = 'export const en: Dict = {' + NL
  if (!loc.includes(zhAnchor) || !loc.includes(enAnchor)) throw new Error('locale anchors missing')
  loc = loc.replace(zhAnchor, zhAnchor + zhAdd + NL)
  loc = loc.replace(enAnchor, enAnchor + enAdd + NL)
  writeFileSync('src/client/locales.ts', loc, 'utf8')
  console.log('locales: deep sync keys added')
}

// card：加一个「深度同步」按钮（与 整理/导出/导入 同排）
let card = readFileSync('src/client/card.tsx', 'utf8')
const CNL = card.includes('\r\n') ? '\r\n' : '\n'
if (!card.includes("'card.deepSync.btn'")) {
  const btnAnchor = "      }, rebuilding ? translate(t, 'card.index.rebuilding.btn') : translate(t, 'card.index.rebuild')),"
  if (!card.includes(btnAnchor)) throw new Error('card rebuild btn anchor missing')
  const add = [
    btnAnchor,
    "      createElement('button', {",
    "        key: 'deepSync',",
    "        type: 'button',",
    "        className: 'dsws_actBtn',",
    "        disabled: blocking || status?.deepSync?.state === 'drs-syncing' || status?.deepSync?.state === 'rebuilding',",
    "        title: translate(t, 'card.deepSync.hint'),",
    "        onClick: () => {",
    "          void callHostAny('index-deep-sync', {}).then(() => { reloadStatus() })",
    '        },',
    "      }, status?.deepSync?.state === 'drs-syncing'",
    "        ? translate(t, 'card.deepSync.drs')",
    "        : status?.deepSync?.state === 'rebuilding'",
    "          ? translate(t, 'card.deepSync.rebuilding')",
    "          : translate(t, 'card.deepSync.btn')),",
  ].join(CNL)
  card = card.replace(btnAnchor, add)

  const zhAdd = [
    "  'card.deepSync.btn': '深度同步（drsc）',",
    "  'card.deepSync.hint': '先让 drsc 慢速重扫修好投影库，再把本地索引整理一遍。',",
    "  'card.deepSync.drs': 'drsc 同步中…',",
    "  'card.deepSync.rebuilding': '索引整理中…',",
  ].join(NL)
  const enAdd = [
    "  'card.deepSync.btn': 'Deep sync (drsc)',",
    "  'card.deepSync.hint': 'Re-scan through drsc first, then rebuild the local index.',",
    "  'card.deepSync.drs': 'drsc syncing…',",
    "  'card.deepSync.rebuilding': 'Rebuilding index…',",
  ].join(NL)
  loc = readFileSync('src/client/locales.ts', 'utf8')
  const zhAnchor = 'export const zh = {' + NL
  const enAnchor = 'export const en: Dict = {' + NL
  loc = loc.replace(zhAnchor, zhAnchor + zhAdd + NL)
  loc = loc.replace(enAnchor, enAnchor + enAdd + NL)
  writeFileSync('src/client/locales.ts', loc, 'utf8')
  writeFileSync('src/client/card.tsx', card, 'utf8')
  console.log('card: deep sync button + keys added')
}
