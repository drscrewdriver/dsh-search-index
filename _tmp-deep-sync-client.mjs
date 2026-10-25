import { readFileSync, writeFileSync } from 'node:fs'

// ── 1. host-api：HostIndexStatus.deepSync + deepSyncIndex() ───────────────
let api = readFileSync('src/client/host-api.ts', 'utf8')
const ANL = api.includes('\r\n') ? '\r\n' : '\n'
const line = (s) => s.split('\n').join(ANL)

if (!api.includes('deepSyncIndex')) {
  const stAnchor = line("  sync?: HostSyncState\n  rebuild?: HostRebuildState\n  error?: string\n}")
  if (!api.includes(stAnchor)) throw new Error('HostIndexStatus anchor missing')
  api = api.replace(stAnchor, line([
    '  sync?: HostSyncState',
    '  rebuild?: HostRebuildState',
    '  /** 深度同步（DRS 慢速重建 → 本地索引重建）的可见状态。 */',
    "  deepSync?: { state: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed'; startedAt?: number; finishedAt?: number; error?: string }",
    '  error?: string',
    '}',
  ].join('\n')))

  const fnAnchor = line('/** Trigger a browser download of the index snapshot from the host route. */')
  if (!api.includes(fnAnchor)) throw new Error('downloadSnapshot anchor missing')
  api = api.replace(fnAnchor, line([
    '/**',
    ' * 深度同步：让 DRS 慢速重扫修好自己的投影库，再把本地索引整理一遍。',
    ' * 后台执行，进度看 index-status 的 deepSync 面。',
    ' */',
    'export async function deepSyncIndex(): Promise<{ ok: boolean; started?: boolean; error?: string }> {',
    "  return await callHostAny<{ started?: boolean }>('index-deep-sync', {}) as { ok: boolean; started?: boolean; error?: string }",
    '}',
    '',
    fnAnchor,
  ].join('\n')))
  writeFileSync('src/client/host-api.ts', api, 'utf8')
  console.log('host-api: deepSyncIndex added')
}

// ── 2. panel：状态面加 deepSync + 页脚按钮 ───────────────────────────────
let panel = readFileSync('src/client/panel.tsx', 'utf8')
const PNL = panel.includes('\r\n') ? '\r\n' : '\n'
const pl = (s) => s.split('\n').join(PNL)

panel = panel.replace(
  pl("import { callHost, callHostAny, callSteward, type HostContentHit, type HostIndexStatus, type HostSessionItem, type HostSortMode, type SwitchSessionsService, type SwitchUiWorkspaceService } from './host-api.ts'"),
  pl("import { callHost, callHostAny, callSteward, deepSyncIndex, type HostContentHit, type HostIndexStatus, type HostSessionItem, type HostSortMode, type SwitchSessionsService, type SwitchUiWorkspaceService } from './host-api.ts'"),
)

const stateOld = pl([
  '  const [searchStatus, setSearchStatus] = useState<{',
  '    available: boolean | null',
  '    reason?: string',
  '    rebuilding: boolean',
  '    done: number',
  '    total: number',
  '    count: number',
  '  }>({ available: null, rebuilding: false, done: 0, total: 0, count: 0 })',
].join('\n'))
if (!panel.includes(stateOld)) throw new Error('searchStatus anchor missing')
panel = panel.replace(stateOld, pl([
  '  const [searchStatus, setSearchStatus] = useState<{',
  '    available: boolean | null',
  '    reason?: string',
  '    rebuilding: boolean',
  '    done: number',
  '    total: number',
  '    count: number',
  "    deepSync?: 'idle' | 'drs-syncing' | 'rebuilding' | 'done' | 'failed'",
  '  }>({ available: null, rebuilding: false, done: 0, total: 0, count: 0 })',
].join('\n')))

panel = panel.replace(
  pl("          setSearchStatus({ available: false, reason: 'unreachable', rebuilding: false, done: 0, total: 0, count: 0 })"),
  pl("          setSearchStatus({ available: false, reason: 'unreachable', rebuilding: false, done: 0, total: 0, count: 0 })"),
)

const setOld = pl([
  '        setSearchStatus({',
  '          available: status.available ?? false,',
  '          reason: status.reason,',
  '          rebuilding,',
  '          done: status.rebuild?.done ?? 0,',
  '          total: status.rebuild?.total ?? 0,',
  '          count: status.sync?.indexed ?? 0,',
  '        })',
  '        if (rebuilding) timer = window.setTimeout(probe, 1500)',
].join('\n'))
if (!panel.includes(setOld)) throw new Error('searchStatus set anchor missing')
panel = panel.replace(setOld, pl([
  '        const deepState = status.deepSync?.state',
  '        setSearchStatus({',
  '          available: status.available ?? false,',
  '          reason: status.reason,',
  '          rebuilding,',
  '          done: status.rebuild?.done ?? 0,',
  '          total: status.rebuild?.total ?? 0,',
  '          count: status.sync?.indexed ?? 0,',
  '          deepSync: deepState,',
  '        })',
  "        // 深度同步（DRS 慢扫 → 本地重建）也在跑：继续轮询到它落定。",
  "        if (rebuilding || deepState === 'drs-syncing' || deepState === 'rebuilding') timer = window.setTimeout(probe, 1500)",
].join('\n')))

const buildOld = pl([
  '  const startIndexBuild = (): void => {',
  '    setSearchStatus(prev => ({ ...prev, rebuilding: true }))',
  "    void callHostAny<HostIndexStatus>('index-rebuild', {})",
  '  }',
].join('\n'))
if (!panel.includes(buildOld)) throw new Error('startIndexBuild anchor missing')
panel = panel.replace(buildOld, pl([
  '  const startIndexBuild = (): void => {',
  '    setSearchStatus(prev => ({ ...prev, rebuilding: true }))',
  "    void callHostAny<HostIndexStatus>('index-rebuild', {})",
  '  }',
  '',
  '/**',
  ' * 深度同步：先让 DRS 慢速重扫修好自己的投影库，再把本地索引整理一遍。',
  ' * 用于「有些命中定位不到 / 新会话迟迟搜不到」的自我修复。',
  ' */',
  '  const startDeepSync = (): void => {',
  "    setSearchStatus(prev => ({ ...prev, deepSync: 'drs-syncing' }))",
  '    void deepSyncIndex()',
  '  }',
].join('\n')))

const btnOld = pl([
  "          }, searchStatus.rebuilding ? translate(t, 'card.index.rebuilding.btn') : translate(t, 'card.index.rebuild')),",
  '        ]),',
].join('\n'))
if (!panel.includes(btnOld)) throw new Error('footer rebuild button anchor missing')
panel = panel.replace(btnOld, pl([
  "          }, searchStatus.rebuilding ? translate(t, 'card.index.rebuilding.btn') : translate(t, 'card.index.rebuild')),",
  '          createElement(\'button\', {',
  "            key: 'deepSync',",
  "            type: 'button',",
  "            className: 'dsws_actBtn',",
  "            style: { height: '20px', padding: '0 8px', fontSize: '11px', lineHeight: '18px' },",
  "            disabled: searchStatus.deepSync === 'drs-syncing' || searchStatus.deepSync === 'rebuilding',",
  "            title: translate(t, 'panel.deepSync.hint'),",
  '            onClick: startDeepSync,',
  "          }, searchStatus.deepSync === 'drs-syncing'",
  "            ? translate(t, 'panel.deepSync.drs')",
  "            : searchStatus.deepSync === 'rebuilding'",
  "              ? translate(t, 'panel.deepSync.rebuild')",
  "              : searchStatus.deepSync === 'done'",
  "                ? translate(t, 'panel.deepSync.done')",
  "                : searchStatus.deepSync === 'failed'",
  "                  ? translate(t, 'panel.deepSync.failed')",
  "                  : translate(t, 'panel.deepSync')),",
  '        ]),',
].join('\n')))

writeFileSync('src/client/panel.tsx', panel, 'utf8')
console.log('panel: deep sync button wired')
