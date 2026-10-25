# 兼容矩阵原始记录（dsh-search-index 0.7.7）

农场 cell：`mine-dsh-plugins/_host-farm/cells/<rc>`。每个 cell 改 profile 前备份 `package.json`
（`.bak-matrix-*` / `.bak-probe-*`），测完即还原；启动用 `DSH_HOME=<cell>/sandbox/home`。

| 宿主 rc | index-status | available | settings-describe | writable | ns | 备注 |
|---|---|---|---|---|---|---|
| 0.1.0-rc.8 | 200 | true | 200 | true | switch-search | ok |
| 0.1.1-rc.2 | 200 | true | 200 | true | switch-search | ok |
| 0.1.2-rc.1 | 200 | true | 200 | true | switch-search | drs-unavailable |
| 0.1.5-rc.3 | 200 | true | 200 | true | switch-search | drs-unavailable |
| 0.1.7-rc.2 | 200 | true | 200 | false | switch-search | drs-unavailable |
| 0.2.0-rc.2 | 200 | true | 200 | false | switch-search | 两轮探针 available/writable：false/false → true/false |
| 0.2.1-rc.1 | 200 | true | 200 | false | switch-search | drs-unavailable |
| 0.2.1-rc.2 | 200 | true | 200 | false | switch-search | drs-unavailable |

说明：

- 本文覆盖 8 个农场 cell；第 9 个实测点是桌面宿主的 0.2.1-rc.3（见 README 矩阵）。
- 全部 8 个 cell 的 `index-status` / `settings-describe` 均为 200，命名空间只有 `switch-search`。
- `writable` 的分代：≤0.1.5 走 legacy settings 桥（可写）；≥0.1.7 为只读投影（`writable:false`）。
- 0.2.0-rc.2 首轮 `available:false`：当次 `pnpm install` exit 1（`ERR_PNPM_IGNORED_BUILDS`，来自第三方 `@whiskeysockets/baileys` 的构建脚本），重跑后 `available:true`；两轮均记在表里。
- `reason:drs-unavailable` 是这些 cell 未装 DRS 时的硬依赖语义，不是宿主不兼容。
- UI（真浏览器）只在两端各验一格：0.1.5-rc.3 底栏弹窗、0.2.1-rc.3 桌面主栏整页。
