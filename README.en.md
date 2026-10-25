# dsh-search-index (Session Search)

A DSH plugin: **title + content full-text search over sessions**, backed by its own FTS5
index. Content search is a **hard dependency** on `dsh-reference-session-collector` (DRS).

- **Title mode** — matches session titles as you type;
- **Content mode** — session-grouped hits (title + anchored snippet) with type filters
  (user / reply / tool), domain (all / active / archived), date range, ordering
  (relevance / time) and "expand hits";
- **Hit locating** — opening a hit lands on the target line (diagnostic badges ⏳/✓/✗);
- **Index lifecycle** — incremental watermark sync, non-destructive rebuild (shadow build +
  atomic swap + bounded archives), deep sync (DRS slow rescan + rebuild), JSON Lines
  snapshot export / import.

> **DRS is a hard dependency**: grouping, type weighting, surface and archive-date filters and
> anchored snippets are all computed inside the `dsh-reference-session-collector` projection DB.
> When DRS is unreachable, content search fails **explicitly** and does **not** fall back to the
> local index (the local engine only keeps session-header metadata); `search-status` answers
> `available:false, reason:'drs-unavailable'`.

## Index self-healing: rebuild vs deep sync

The panel footer and the settings card each carry two buttons; they fix different layers:

| Button | What it does | What it fixes |
|---|---|---|
| **Rebuild index** (`index-rebuild`) | Rebuilds the local FTS index from the host `sessionQuery` (shadow build → atomic swap → bounded archives) | dirty / incomplete local index, stale titles |
| **Deep sync (drsc)** (`index-deep-sync`) | ① `POST {op:'sync'}` makes DRS slowly rescan its projection DB, polling `last_sync.busy=false` (180 s cap); ② then runs a rebuild | **hits that fail to locate** (stale DRS projection: `seq`/`on_surface` no longer match the rendered text) |

Locating never reads the local index: it takes the hit's `seq`, asks DRS `op=session` for that
row and matches `search_text` / `surface_text` against the GUI. So "clicking a hit goes nowhere"
is only cured by deep sync — rebuilds never touch the DRS projection. Progress rides
`index-status.deepSync` (`idle → drs-syncing → rebuilding → done | failed`). Neither button
runs concurrently; pressing deep sync while a rebuild is running fails fast, so wait it out or
press deep sync alone.

## Entry: two forms by host generation

| Host | Form | Registration / interaction |
|---|---|---|
| **≥ 0.1.7** | "Plugins-page style" **full page** | `sidebar.panellist` row (id `dsh-search-index`, order 5 — after Plugins(0), before Session Manager(6)) + a `main` page with the same key; clicking the row or `Ctrl/⌘+K` → `layout.selectPanel('dsh-search-index')`; the page's Close returns to the conversation |
| **< 0.1.7** | **sidebar dialog** (unchanged) | `sidebar.footer.action` entry (order 5) + `SwitchPanel` dialog (backdrop / Esc / `Ctrl/⌘+K`); no panellist/main |

**Generation signal**: the `sidebar.workspaces.session.menu.item` seat plus `main`
(absent on 0.1.5, present from 0.1.7). The two forms are mutually exclusive: decided once when
the seats are ready, and the other form is removed in place if a seat shows up later;
`enabled=false` tears the pair down.

<!-- hosts-sync:begin -->
<!-- Single source: package.json engines.dsh (18-host enumeration, same as hosts.mjs) -->
Supports DSH 0.1.0-rc.2, 0.1.0-rc.3, 0.1.0-rc.6, 0.1.0-rc.7, 0.1.0-rc.8, 0.1.1-rc.1, 0.1.1-rc.2, 0.1.2-rc.1, 0.1.5-rc.1, 0.1.5-rc.2, 0.1.5-rc.3, 0.1.7-rc.1, 0.1.7-rc.2, 0.2.0-rc.1, 0.2.0-rc.2, 0.2.1-rc.1, 0.2.1-rc.2, 0.2.1-rc.3 (enumerated peers; 9 of these rc versions have a farm-cell smoke — matrix below).
<!-- hosts-sync:end -->

## Compatibility matrix (0.7.7 measured)

Each rc was installed into its farm cell (`_host-farm/cells/<rc>`), booted with `dsh web`, and probed:

| Host rc | `/switch-search/api/index-status` | `settings-describe` | Entry form |
|---|---|---|---|
| 0.1.0-rc.8 | 200 · available:true | 200 · `writable:true` (legacy bridge) | footer dialog |
| 0.1.1-rc.2 | 200 · available:true | 200 · `writable:true` | footer dialog |
| 0.1.2-rc.1 | 200 · available:true | 200 · `writable:true` | footer dialog |
| 0.1.5-rc.3 | 200 · available:true | 200 · `writable:true` | footer dialog (UI verified) |
| 0.1.7-rc.2 | 200 · available:true | 200 · `writable:false` (read-only) | main page |
| 0.2.0-rc.2 | 200 · available:true | 200 · `writable:false` | main page |
| 0.2.1-rc.1 | 200 · available:true | 200 · `writable:false` | main page |
| 0.2.1-rc.2 | 200 · available:true | 200 · `writable:false` | main page |
| 0.2.1-rc.3 | 200 · available:true | 200 · `writable:false` | main page (UI verified, desktop) |

UI was verified in a real browser at both ends: 0.1.5-rc.3 = footer "搜索 Ctrl K" + dialog
(Esc / Ctrl+K); 0.2.1-rc.3 = `sidebar.panellist` row + full page (no backdrop).
**Nine enumerated rc versions still have no farm cell** (0.1.0-rc.2/rc.3/rc.6/rc.7, 0.1.1-rc.1,
0.1.5-rc.1/rc.2, 0.1.7-rc.1, 0.2.0-rc.1): allowed by the declaration only, not smoke-tested.
Narrow the `engines.dsh` enumeration if you want the list to equal the tested set.

## Install

```bash
dsh plugin --profile web add dsh-search-index
```

Restart the host process afterwards. Without DRS, title search still works; content search
reports itself unavailable.

> **Do not install together with the merged `dsh-session-steward` (≤0.5.x, which bundles search)**:
> both register the `/switch-search/api` prefix and a 0.1.5-line host refuses to boot
> (`webserver: duplicate prefix route`). Upgrade path: remove `dsh-session-steward`, then install
> `dsh-manage-session` + this plugin. Verified on the 0.1.5 line: footer entry "搜索 Ctrl K" opens
> the dialog (Esc closes), `settings-describe` goes through the legacy bridge with `writable:true`,
> and without DRS `search-status` answers `available:false, reason:'drs-unavailable'`.

## Routes

Prefix `/switch-search/api`:

| Method | Purpose |
|---|---|
| `list-sessions` | title corpus (id + title + cwd/updatedAt; index first, sessionQuery fallback) |
| `content-search` | content hits via DRS (`archived`/`types`/`sortBy`/`expand`/`from`/`to`) |
| `search-status` | availability decided by the DRS probe, plus index watermark / rebuild progress |
| `index-status` / `index-rebuild` | index lifecycle surface (`index-status` also carries `deepSync`) |
| `index-deep-sync` | deep sync: DRS slow rescan → local rebuild (background, progress via `index-status`) |
| `index-export` / `index-import` | snapshot export (raw JSON Lines) / import (raw body) |
| `settings-describe` / `settings-mutate` | settings: read-only projection on 0.1.7+; writable through the legacy settings bridge on ≤0.1.5 |

## Settings

Namespace `switch-search`: `enabled`, `defaultMode`, `autoSync`, `syncIntervalMs`,
`archiveKeep`, `indexDir`, `corpusSource` (default `drs`), `drsBaseUrl`.

> Since 0.7.0 the namespace returned from the merged package's `manage-sessions-search`;
the old key is no longer read, so after upgrading `enabled` and friends fall back to their
defaults (search on) and need adjusting once more.

## Boundary with dsh-manage-session

- Archive set is **read-only** here; only `dsh-manage-session` writes it.
- The inline Delete button probes
  `POST /manage-session/api/session-health-status` → `switches.directDelete === true`,
  then posts `session-history-purge` there; uninstalled or probe failure hides the button.
- Opening a hit never depends on manage-session.

## Development

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm test
```

## License

MIT
