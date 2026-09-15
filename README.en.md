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

## Predecessor and this release

**Predecessor: `dsh-session-search-toggle`.** That version relied on `defineStore` from `@deepseek-ai/dsh-client-runtime` to provide the settings-row seat. DSH 0.1.2 renamed and restructured the client engine packages (`dsh-client-runtime` → `dsh-client-store`), so the old code could not load on the new host — and no single artifact could serve both releases.

**This release (`dsh-search-index` 0.2.0-beta.1) targets DSH 0.1.2 as its main line**, by making the host-version difference disappear entirely:

- **One artifact, runtime-adaptive**: the same `lib/client.js` loads on both 0.1.1-rc.2 and 0.1.2-rc.1 with **no version-string branching anywhere**. The client bundle only `require`s `react` / `react-dom`, both of which sit in the shared module table of either release.
- **Neither engine package is imported**: it imports neither `dsh-client-runtime` nor `dsh-client-store`, so that rename cannot affect it.
- **The store seat is implemented locally**: the settings row needs a store seat (`StoreHandle` / `StoreInstance`, a contract owned by `@deepseek-ai/dsh-client-ui-slots` and identical in both releases). It used to come from `defineStore`; it is now a ~30-line local implementation that only provides `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` — no release-specific specifier.
- **Every other contract is identical across releases**: the `settings.general.item` slot, `SettingsScope.{getSnapshot,subscribe,set,unset}`, and the three `sessionQuery` faces have the same signatures in both.

> **▼ DSH version support**
> | DSH version | Status | Key difference |
> | --- | --- | --- |
> | 0.1.1-rc.2 | ✅ | the store engine lives in `@deepseek-ai/dsh-client-runtime/client` |
> | 0.1.2-rc.1 | ✅ | the engine was renamed to `@deepseek-ai/dsh-client-store`; this plugin imports neither |

**Upgrading from the old name**: this package was renamed from `dsh-session-search-toggle`; the client registration id, the cordis patch id and the repository URL were renamed with it. GitHub keeps redirects for renamed repositories, so the old name still resolves — but switch the profile dependency to the new name rather than letting both coexist:

```sh
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master
dsh plugin --profile web remove dsh-session-search-toggle
dsh web   # restart
```

The settings namespace stays `switch-search` (**storage key kept stable, no migration**), so existing configuration keeps working under the new name.

## What it does

- **Title ↔ content toggle**: two ways to search from one entry — "Title" filters by session title / working-directory substring live; "Content" searches message bodies through **this plugin's own index**.
- **Content grouped by session**: each content result is one row (session title + strongest snippet + type tag); clicking opens that session — no per-message flood.
- **Content-type filter**: filter chips at the top of content mode — **All / User / Reply / Tool**; `Tool` opens `tool/call` and `tool/result` events into the index, so you can search tool call arguments and results directly.
- **Settings card**: Settings → Plugins gains a **"Search Index"** card — enable toggle, default search mode, sync/retention/index-dir knobs, and the index-lifecycle block (status, non-destructive rebuild, snapshot export/import).
- **Jump to session**: clicking a result opens that session, landing on the context around the hit.

## UI preview

Entry at the sidebar and the setting panel layout:
<img width="287" height="835" alt="image" src="https://github.com/user-attachments/assets/fc714858-aaf9-4b5b-ad83-a3f1537f6116" />
<img width="844" height="813" alt="image" src="https://github.com/user-attachments/assets/d3ed5d20-9737-4b9b-a7bb-74162513f7c7" />

## The independent index: three mechanisms

Content mode **builds its own database**; it does not depend on DSH's `session-query-sqlite` full-text index. The index lives in `src/host/`: `schema.ts` creates the tables (including its own FTS5 table `docs_fts`), `engine.ts` runs queries, and `extract.ts` pulls searchable text out of session events — including `tool/call` (tool name + arguments) and `tool/result` (result text), which is what the tool filter is built on. DSH's `sessionQuery` is used only as a **corpus reader** (`listSessions` / `readSession`), never as the search backend.

### 1. An independent conversation-content index

The index is **this plugin's own SQLite file**, with no effect on the official index. The directory is configurable, the index can be exported/imported as a snapshot and rebuilt wholesale. On host activation it inspects the index directory: a leftover `index.building.sqlite` next to a live active index means "the last rebuild never finished" and is discarded; a leftover with no active index means "the crash hit the rename window", so the newest archive is rolled back as active.

### 2. Archived — i.e. no longer usable — sessions are pruned, on a rolling update

`archive-source.ts` reads `global.archivedSessionIds` from the official storage hub (`~/.dsh/storages/workspace.json`) and keeps **archived sessions out of the index**. The archive set has exactly one writer — the steward; this package only reads it.

Sync is **rolling**: `SwitchWatermarkSync` in `sync.ts` keeps a `version` watermark per session and, on each pass, only diffs and re-ingests sessions that changed — never a full rebuild. The index files themselves are retained in a bounded number of copies under `archiveKeep`, with older ones aged out.

### 3. Housekeeping never blocks the working index

Housekeeping goes through a **shadow index**: `rebuild.ts` builds `index.building.sqlite` from scratch beside the active one, and **the active index keeps serving searches the whole time** — queries are never blocked. Once the build completes, the swap is three synchronous `rename` calls (active → archive, shadow → active), i.e. a single atomic window.

That also fixes the failure semantics: **shadow present + active present = the build never finished**, so the shadow is garbage and is discarded — the active index was never at risk.

## Installation

```sh
# Option 1: install directly from GitHub (recommended) — lib/ is committed, no local build
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master

# Option 2: assemble from a local path / source (see Development)

# Restart dsh web — required! A running instance does not hot-load the bundle layer
dsh web
```

After install a **"Search"** button appears at the sidebar footer; Settings → Plugins gains the **"Search Index"** card.

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
├── host/               # the independent index (host side)
│   ├── schema.ts       # tables: docs / docs_fts(FTS5) / sessions / watermarks
│   ├── engine.ts       # queries
│   ├── extract.ts      # pulls searchable text from session events (incl. tool/call, tool/result)
│   ├── sync.ts         # SwitchWatermarkSync: rolling incremental sync by version watermark
│   ├── rebuild.ts      # shadow build + atomic swap + crash-recovery inspection
│   ├── archive-source.ts  # reads the archive set to keep archived sessions out of the index
│   └── snapshot.ts     # snapshot export/import
└── client/
    └── index.ts        # browser half: sidebar.footer.action entry + floating panel + settings.general.item row
```

- **Host half**: registers the fenced HTTP route `/switch-search/api` (`list-sessions` / `content-search` / `search-status`), with a browser-trust fence identical to the DSH `/api` gateway (loopback Host or trustedHosts; cross-site refused).
- **Config pattern**: the host registers the `switch-search` namespace through the `settings` service with a schemastery `Config`; the client mirrors/edits it with a local store seat + `settingsScope.bind`; the shared pure module `src/config.ts` keeps schemastery out of the client bundle.
- **Build chain**: tsdown mirrors the harness `packages/client/tsdown.client.ts` semantics (`__ModuleLoader__.load` banner, platform externals table, bundle purity gate).
- **lib/ committed**: GitHub installs run off the committed build output (dsh does not run `prepare` on a git install); `.gitignore` does not exclude `lib/`.

## Relation to the official sidebar search

- The official sidebar search box lives in `sidebar.workspaces` (a single slot); an external plugin **cannot replace it**. This plugin adds a **separate entry** at the sidebar footer via `sidebar.footer.action`; the two coexist.
- The official content search hard-codes `user/message` + `assistant/message` in apiproxy; this plugin searches its own index and opens up `tool/call` + `tool/result`, enabling tool-level search.

## Compatibility and privacy

- Requires DeepSeek Harness with the web profile; **no official source is modified**. The index is this plugin's own file, so whether the official `session-query-sqlite` is enabled makes no difference to this plugin.
- Configuration lives only in the DSH settings namespace and browser panel state; it reads/upload nothing beyond session-search data.
- Host/client contract types are declared structurally in `src/*.ts` (the npm dsh client chain is incomplete) and mirror the harness sources at build-verification time.

## drscrewdriver DSH Plugin Family

This project is one of the DSH plugins maintained by [drscrewdriver](https://github.com/drscrewdriver). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | Busy-time input queue: three-tier traffic control, drag-to-reorder, session freeze |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | Per-round reasoning_effort control: Auto scheduling or manual wire level |
| [dsh-seatbelt-sandbox](https://github.com/drscrewdriver/dsh-seatbelt-sandbox) | macOS Seatbelt sandbox adapter: native libsandbox loader replacing deprecated sandbox-exec |
| [dsh-prime-memory](https://github.com/drscrewdriver/dsh-prime-memory) | Layered distilled memory: automatic L0–L3 distillation, recall injected before each step |
| **[dsh-search-index](https://github.com/drscrewdriver/dsh-search-index)** | Session content search sidebar: title/content toggle, type-filter by user/reply/tool |

## License

MIT
