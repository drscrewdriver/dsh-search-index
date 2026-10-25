import { readFileSync, writeFileSync } from 'node:fs'

const FILE = '_tmp-drive-b.mjs'
let t = readFileSync(FILE, 'utf8')
t = t.replace(
  "const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()",
  "const list = await (await fetch(process.env.CDP_BASE || `http://127.0.0.1:${PORT}/json/list`)).json()",
)
writeFileSync(FILE, t, 'utf8')
console.log('cdp base parameterized')
