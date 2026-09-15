<p align="center">
  <strong>Session search with its own index for the DeepSeek Harness sidebar — one-click toggle between title and content, with user / reply / tool filters</strong>
</p>
<p align="center">
  <a href="README.md">中文</a> · <strong>English</strong>
</p>
<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-263146?style=flat-square"></a>
  <img alt="Public" src="https://img.shields.io/badge/status-public-7da1de?style=flat-square">
</p>

# dsh-search-index

> Sidebar **search index** for DSH web: adds a **"Search"** entry at the sidebar footer whose floating panel toggles between **title search ↔ content search**; content mode groups results **by session** (title + snippet) and filters by **user / reply / tool**. Ships its **own index** (independent of DSH's built-in full-text index) with incremental sync, a non-destructive rebuild, and snapshot export/import.

> **This package owns search and the index only.** The session-history viewer (the old "archived sessions" panel) moved to **`dsh-session-steward`**. This package still **reads** the official archive set to keep archived sessions out of the index, but no longer **writes** it — the archive set has exactly one writer: the steward.

A cordis client + host plugin assembled via the `dsh plugin` command and a bundle patch — no dsh source changes, no PR required.

> **▼ DSH version support**
> | DSH version | Settings row / host route | Key difference |
> | --- | --- | --- |
> | 0.1.1-rc.2 | ✅ | the store engine lives in `@deepseek-ai/dsh-client-runtime/client` |
> | 0.1.2-rc.1 | ✅ | the engine was renamed to `@deepseek-ai/dsh-client-store`; this plugin imports neither |
>
> - **One artifact, runtime-adaptive**: the same `lib/client.js` loads on both releases with no version-string branching. The client bundle only `require`s `react` / `react-dom`, both of which sit in the shared module table of either release.
> - **The store seat is implemented locally**: the settings row needs a store seat (`StoreHandle` / `StoreInstance`, a contract owned by `@deepseek-ai/dsh-client-ui-slots` and identical in both releases). It used to come from the runtime's `defineStore`, but that engine package was renamed between releases, so it is now a ~30-line local implementation that only provides `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` — no release-specific specifier.
> - **Every other contract is identical across releases**: the `settings.general.item` slot, `SettingsScope.{getSnapshot,subscribe,set,unset}`, and the three `sessionQuery` faces have the same signatures in both.
> - The sidebar entry is enabled: this package registers one `sidebar.footer.action` entry ("Search"). It no longer registers a second entry — the archive entry moved to the steward.

## What it does

- **Title ↔ content toggle**: two ways to search from one entry — "Title" filters by session title / working-directory substring live; "Content" searches message bodies through DSH's built-in FTS5 full-text index.
- **Content grouped by session**: each content result is one row (session title + strongest snippet + type tag); clicking opens that session — no per-message flood.
- **Content-type filter**: filter chips at the top of content mode — **All / User / Reply / Tool**; `Tool` opens `tool/call` and `tool/result` events into the index, so you can search tool call arguments and results directly.
- **Index availability probe**: the host `search-status` endpoint checks whether the `sessionQuery` full-text index is enabled; when it is not, content mode shows one concrete setup instruction instead of a bare "content search unavailable".
- **Settings card**: Settings → Plugins gains a **"Search Index"** card — enable toggle, default search mode, sync/retention/index-dir knobs, and the index-lifecycle block (status, non-destructive rebuild, snapshot export/import).
- **Jump to session**: clicking a result opens that session, landing on the context around the hit.

## UI preview

Entry at the sidebar  and the setting panel layout:

侧边栏搜索入口与设置面板布局示意：
<img width="287" height="835" alt="image" src="https://github.com/user-attachments/assets/fc714858-aaf9-4b5b-ad83-a3f1537f6116" />
<img width="844" height="813" alt="image" src="https://github.com/user-attachments/assets/d3ed5d20-9737-4b9b-a7bb-74162513f7c7" />


## Underlying content search: the DSH FTS5 derived index

Content mode does not build its own database — it reuses DSH's **SQLite FTS5 derived index** (`session-query-sqlite`):

| Table | Description |
|---|---|
| `persisted_docs` (FTS5) | Full-text docs of persisted sessions (`text` searchable; `type/session_id/seq/...` as filter columns) |
| `temp.live_docs` (FTS5) | Full-text docs of the current process's live sessions |
| `persisted_sessions` / `live_sessions` | Session headers + `revision`/`fingerprint` (incremental rebuild keys) |
| `search_state` | Generation counter driving pagination-cursor invalidation |

- **Lazy index**: with `openAt: first-search` the index builds on the first search; each search does an **incremental reconcile** (rebuilds only changed sessions) — the first search on a large corpus is slower, later ones are fast.
- **Tool content is searchable**: `extraction.ts` explicitly feeds `tool/call` (name + arguments) and `tool/result` (result text) into the index — this is the data basis for the plugin's tool filter.

### ⚠️ Prerequisite: enable the full-text index

**The official DSH bundle ships with the full-text index disabled** (`session-query-sqlite` has `openAt: never`; see `deepseek-harness/packages/bundle/web-app/cordis.patch.yml`). To make content search work, override it in your profile's `cordis.patch.yml` or an overlay:

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'               # or a durable absolute path (survives restarts)
    openAt: first-search           # or startup
```

Then restart DSH web. If you do not enable it, the plugin's content mode shows setup guidance; title mode is unaffected.

## Installation

```sh
# Option 1: install directly from GitHub (recommended) — lib/ is committed, no local build
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#release-v0.1.0   # stable
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master          # baseline
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#feat/type-filter-search  # latest dev

# Option 2: assemble from a local path / source (see Development)

# Restart dsh web — required! A running instance does not hot-load the bundle layer
dsh web
# or use the bundled script
bash ~/.dsh/profiles/web/node_modules/dsh-search-index/restart-dsh-web.sh
```

After install a **"Search"** button appears at the sidebar footer; Settings → Plugins gains the **"Search Index"** card.

> **Upgrading from the old name**: this package was renamed from `dsh-session-search-toggle` (0.2.0-beta.1). GitHub keeps redirects for renamed repositories, so the old name still resolves — but switch the profile dependency to the new name rather than letting both names coexist:
> ```sh
> dsh plugin --profile web add github:drscrewdriver/dsh-search-index#<branch>
> dsh plugin --profile web remove dsh-session-search-toggle
> dsh web   # restart
> ```
> The settings namespace stays `switch-search` (**storage key kept stable, no migration**), so existing configuration keeps working under the new name.

> ⚠️ **GitHub reachability**: installing via github: requires access to github.com; if your network is restricted, set up a working proxy or mirror first, otherwise add may stall while fetching.

## Development

```sh
pnpm install            # includes the @deepseek-ai client chain + tsdown/tsc
pnpm typecheck          # tsc --noEmit
pnpm build              # tsc (lib/types) + tsdown (lib/index.mjs + lib/client.js)
```

### Layout

```
src/
├── index.ts            # host half (node): Config schema + installSettingsSection + routes
├── config.ts           # pure shared config (enabled/defaultMode + namespace constant, schemastery-free for client)
└── client/
    └── index.ts        # browser half: sidebar.footer.action entry + floating panel + settings.general.item row
```

- **Host half**: registers the fenced HTTP route `/switch-search/api` (`list-sessions` / `content-search` / `search-status`), with a browser-trust fence identical to the DSH `/api` gateway (loopback Host or trustedHosts; cross-site refused).
- **Config pattern**: modeled on dsh-thinking-levels — the host registers the `switch-search` namespace through the `settings` service with a schemastery `Config`; the client mirrors/edits it with `defineStore` + `settingsScope.bind`; the shared pure module `src/config.ts` keeps schemastery out of the client bundle.
- **Build chain**: tsdown mirrors the harness `packages/client/tsdown.client.ts` semantics (`__ModuleLoader__.load` banner, platform externals table, bundle purity gate).
- **lib/ committed**: GitHub installs run off the committed build output (dsh does not run `prepare` on a git install); `.gitignore` does not exclude `lib/`.

## Branch map

| Branch | Purpose |
|---|---|
| `master` | Stable baseline (title ↔ content toggle, session grouping) |
| `feat/type-filter-search` | Development (content-type filter + settings index entry + availability probe) |
| `release-v0.1.0` | Stable installable version derived from the validated dev state, ships `lib/` |

## Relation to the official sidebar search

- The official sidebar search box lives in `sidebar.workspaces` (a single slot); an external plugin **cannot replace it**. This plugin adds a **separate entry** at the sidebar footer via `sidebar.footer.action`; the two coexist.
- The official content search hard-codes `user/message` + `assistant/message` in apiproxy; this plugin relaxes the filter through a `types` parameter to include `tool/call` + `tool/result`, enabling tool-level search.

## Compatibility and privacy

- Requires DeepSeek Harness with the web profile; all data goes through the built-in `sessionQuery` service (live-preferred corpus) — **no official source changes, no derived database**.
- Configuration lives only in the DSH settings namespace and browser panel state; it reads/upload nothing beyond session-search data.
- Host/client contract types are declared structurally in `src/*.ts` (the npm dsh client chain is incomplete) and mirror the harness sources at build-verification time.

## drscrewdriver DSH Plugin Family

This project is one of the DSH plugins maintained by [drscrewdriver](https://github.com/drscrewdriver). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | Busy-time input queue: three-tier traffic control, drag-to-reorder, session freeze |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | Per-round reasoning_effort control: Auto scheduling or manual wire level |
| [dsh-seatbelt-sandbox](https://github.com/drscrewdriver/dsh-seatbelt-sandbox) | macOS Seatbelt sandbox adapter: native libsandbox loader replacing deprecated sandbox-exec |
| **[dsh-search-index](https://github.com/drscrewdriver/dsh-search-index)** | Session content search sidebar: title/content toggle, type-filter by user/reply/tool |

## License

MIT
