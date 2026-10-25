import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'src/client/card.tsx'
let t = readFileSync(FILE, 'utf8')
const NL = t.includes('\r\n') ? '\r\n' : '\n'
const line = (s) => s.split('\n').join(NL)

// 1) 轮询条件加 deepSync
const pollOld = line("        const rebuilding = res.rebuild?.state === 'building' || res.rebuild?.state === 'swapping'\n        if (rebuilding) timer = window.setTimeout(refresh, 2000)\n        else setBusy(false)")
if (!t.includes(pollOld)) throw new Error('poll anchor missing')
t = t.replace(pollOld, line([
  "        const rebuilding = res.rebuild?.state === 'building' || res.rebuild?.state === 'swapping'",
  "        const deep = res.deepSync?.state",
  "        if (rebuilding || deep === 'drs-syncing' || deep === 'rebuilding') timer = window.setTimeout(refresh, 2000)",
  '        else setBusy(false)',
].join('\n')))

// 2) 按钮 onClick 用 busy + attempt 重取
const clickOld = line([
  '        onClick: () => {',
  "          void callHostAny('index-deep-sync', {}).then(() => { refresh() })",
  '        },',
].join('\n'))
if (!t.includes(clickOld)) throw new Error('click anchor missing')
t = t.replace(clickOld, line([
  '        onClick: () => {',
  '          setBusy(true)',
  '          setNote(null)',
  "          void callHostAny('index-deep-sync', {}).then((res) => {",
  '            if (!res.ok) {',
  '              setBusy(false)',
  "              setNote(res.error ?? translate(t, 'card.action.failed', { error: 'unknown' }))",
  '              return',
  '            }',
  '            setAttempt(a => a + 1)',
  '          })',
  '        },',
].join('\n')))

writeFileSync(FILE, t, 'utf8')
console.log('card deep sync wiring fixed')
