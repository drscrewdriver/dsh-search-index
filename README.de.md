<p align="center">
  <strong>Eine Sitzungssuche mit eigenem Index für die DeepSeek-Harness-Seitenleiste — Umschaltung zwischen Titel und Inhalt per Klick, mit Filtern nach Benutzer / Antwort / Tool</strong>
</p>
<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.fr.md">Français</a> · <strong>Deutsch</strong> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <a href="README.es.md">Español</a>
</p>
<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-263146?style=flat-square"></a>
  <img alt="Public" src="https://img.shields.io/badge/status-public-7da1de?style=flat-square">
</p>

# dsh-search-index

> **Suchindex** für die DSH-Web-Seitenleiste: Ergänzt am Fuß der Seitenleiste einen Eintrag **„Suche"**, dessen schwebendes Panel per Klick zwischen **Titelsuche ↔ Inhaltssuche** umschaltet; der Inhaltsmodus zeigt Titel und Trefferausschnitte **nach Sitzung gruppiert** und filtert nach **Benutzer / Antwort / Tool**. Bringt einen **eigenen Index** mit (unabhängig vom offiziellen Volltextindex von DSH) mit inkrementeller Synchronisierung, nicht-destruktiver Neuaufbereitung sowie Snapshot-Export/-Import.

> **Dieses Paket kümmert sich nur um Suche und Index.** Das Ansehen und Aufräumen des Sitzungsverlaufs (das frühere Panel „Archivierte Sitzungen") ist in den Tab „Aktenraum" von **`dsh-session-steward`** umgezogen; dieses Paket **liest** die offizielle Archivmenge weiterhin, um archivierte Sitzungen aus dem Index auszuschließen, schreibt sie aber **nicht mehr** — die Archivmenge hat genau einen Schreiber: den Steward. Der Vertrag ist in `dsh-归档文件格式契约-20260914.md` beschrieben.

Keine Änderungen am dsh-Quellcode, keine PR: ein cordis-Client plus Plugin-Host-Hälfte, zusammengesetzt über den Befehl `dsh plugin` und einen Bundle-Patch.

## Vorgänger und diese Version

**Vorgänger: `dsh-session-search-toggle`.** Jene Version verließ sich auf `defineStore` aus `@deepseek-ai/dsh-client-runtime`, um den Sitzplatz der Einstellungszeile bereitzustellen. DSH 0.1.2 hat die Client-Engine-Pakete umbenannt/umstrukturiert (`dsh-client-runtime` → `dsh-client-store`); der alte Code ließ sich auf dem neuen Host nicht mehr laden — ein einziges Plugin konnte mit einem einzigen Artefakt nicht beide Versionen abdecken.

**Diese Version (`dsh-search-index` 0.6.0) nimmt DSH 0.2.0 als Hauptlinie** (peer `>=0.2.0-rc.1 <0.2.1-0`). Historische Host-Linien werden von eigenen Versionslinien bedient: DSH 0.1.7 wird von 0.5.7 versorgt (npm dist-tag `dsh-0.1.7`, Zweig `compat/0.1.7`), ältere 0.1.1/0.1.2-Hosts nutzen das Legacy-Artefakt, das mit dieser Version nicht weiterentwickelt wird. Historischer Hintergrund:

- **Ein Artefakt, zur Laufzeit adaptiv**: dasselbe `lib/client.js` lädt sowohl auf 0.1.1-rc.2 als auch auf 0.1.2-rc.1, **ohne jede Verzweigung auf Versionszeichenketten**. Das Client-Bundle `require`t nur `react` / `react-dom`, die in der gemeinsamen Modultabelle beider Versionen liegen.
- **Keine der beiden Engine-Pakete wird importiert**: weder `dsh-client-runtime` noch `dsh-client-store` — die Umbenennung kann es also **nicht treffen**.
- **Store-Sitz lokal implementiert**: Die Einstellungszeile braucht einen Store-Sitz (`StoreHandle` / `StoreInstance`, ein Vertrag, der `@deepseek-ai/dsh-client-ui-slots` gehört und in beiden Versionen identisch ist). Dieses Plugin ersetzt `defineStore` durch eine lokale Implementierung von rund 30 Zeilen — sie hängt nur von `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` ab, ohne jeden versionsspezifischen Specifier.
- **Alle übrigen Verträge stimmen in beiden Versionen überein**: der Slot `settings.general.item`, `SettingsScope.{getSnapshot,subscribe,set,unset}` und die drei Abfrageflächen von `sessionQuery` haben in beiden dieselben Signaturen.

> **▼ DSH-Versionsunterstützung**
> | DSH-Version | Status | Träger und entscheidender Unterschied |
> | --- | --- | --- |
> | 0.2.0-rc.1 | ✅ | **diese Version 0.6.0**; peer/engines = `>=0.2.0-rc.1 <0.2.1-0`, null Codeänderungen (rein Caller-artige Nutzung der Sitzplätze slots/locale/configForms) |
> | 0.1.7-rc.1+ | ✅ | 0.5.7 (dist-tag `dsh-0.1.7`); configForms löst das Handle über die entry id auf, ältere Hosts fallen auf einen per Namespace gebundenen settingsScope zurück |
> | 0.1.1-rc.2 | ✅ (Legacy-Artefakt, eingefroren) | die Store-Engine liegt in `@deepseek-ai/dsh-client-runtime/client` |
> | 0.1.2-rc.1 | ✅ (Legacy-Artefakt, eingefroren) | die Engine wurde in `@deepseek-ai/dsh-client-store` umbenannt; dieses Plugin importiert keine von beiden |

**Upgrade vom alten Namen**: Dieses Paket ist eine Umbenennung von `dsh-session-search-toggle`; die Client-Registrierungs-id, die cordis-Patch-id und die Repository-URL wurden mit umbenannt. GitHub hält für umbenannte Repositories Umleitungen bereit, der alte Name bleibt also auflösbar — stellen Sie die Profil-Abhängigkeit aber auf den neuen Namen um, statt beide dauerhaft koexistieren zu lassen:

```sh
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master
dsh plugin --profile web remove dsh-session-search-toggle
dsh web   # neu starten
```

Der Einstellungs-Namespace bleibt `switch-search` (**Speicherschlüssel bleibt stabil, keine Migration**), die bestehende Konfiguration funktioniert also unter dem neuen Paket unverändert weiter.

## Was es kann

- **Doppelmodus Titel ↔ Inhalt**: ein Eintrag, zwei Sucharten — „Titel" filtert live nach Teilzeichenfolge des Sitzungstitels / Arbeitsverzeichnisses; „Inhalt" durchsucht den **eigenen Index dieses Plugins** nach den Sitzungsnachrichten.
- **Inhalt nach Sitzung gruppiert**: jedes Ergebnis der Inhaltssuche ist eine Zeile pro Sitzung (Sitzungstitel + stärkster Trefferausschnitt + Typ-Tag); ein Klick öffnet die Sitzung — kein flutendes Aufstapeln einzelner Nachrichten.
- **Inhaltstyp-Filter**: Filter-Chips am Kopf des Inhaltsmodus — **Alle / Benutzer / Antwort / Tool**; `Tool` öffnet die Ereignisse `tool/call` und `tool/result` für die Ergebnisse, sodass Tool-Argumente und -Rückgabewerte direkt durchsuchbar sind.
- **Ergebnissortierung**: **Relevanz / Zeit** rechts in derselben Zeile — „Zeit" sortiert nach der **letzten Aktivität der Sitzung**, zuletzt berührte zuerst; die Präferenz wird lokal gemerkt und übersteht Neuladen. Jeder Treffer liefert sowohl den Dokument-Zeitstempel als auch die Sitzungs-Uhr mit, das Frontend kann daher selbst nachsortieren.
- **Titel in Echtzeit**: Der Host abonniert `session/event`; eine Umbenennung (`session/title`) wird sofort in den Index eingefaltet, ohne auf den nächsten Synchronisierungslauf zu warten (Standard 30 s).
- **Einstellungskarte**: Einstellungen → Plugins erhält eine Karte **„Suchindex"** — Aktivierungsschalter, Standard-Suchmodus, Regler für Synchronisierung / Aufbewahrung / Indexverzeichnis des eigenen Index sowie der Block zum Index-Lebenszyklus (Status, nicht-destruktive Neuaufbereitung, Snapshot-Export/-Import). Meldet die Karte „N archivierte Sitzung(en) ausgeschlossen", **zeigt sie gleich auf den Verantwortlichen**: Das Durchsehen und Entsorgen archivierter Sitzungen obliegt dem **„Sitzungs-Steward"** (`dsh-session-steward`), dieses Plugin liest nur die Archivmenge; fehlt jenes Plugin, sagt der Hinweis das ausdrücklich („derzeit nicht installiert") — die Feststellung trifft der Host, indem er es aus dem **Modulgraphen des Plugins selbst** auflöst, und bei unbestimmtem Ergebnis gilt der neutrale Wortlaut: **„nicht lesbar" wird niemals als „nicht installiert" gemeldet**.
- **Aufruftaste und plattformgerechte Tastenhinweise**: Sowohl der Seitenleisten-Eintrag als auch die Tastenleiste am Panel-Fuß zeigen die Aufrufkombination — `⌘K` auf macOS, `Ctrl K` unter Windows/Linux, je nach laufendem System; die Schließen-Taste des Panels folgt ebenfalls der Plattform (`esc` auf macOS, sonst `Esc`). Die Erkennung stuft ab über **UA-CH → `navigator.platform` → UA-Zeichenkette**, ein Privatsphäre-Modus degradiert einen Mac-Nutzer also nie zu den Windows-Symbolen. **Hinweis und Bindung stammen aus einer Quelle**: Die auf dem Kappen-Label stehende Kombination ist exakt die, die der `keydown`-Handler erkennt — niemals „eine Taste versprochen, eine andere bedient".
- **Direktsprung per Klick**: Ein Klick auf ein Ergebnis öffnet die zugehörige Sitzung und positioniert auf den Kontext des Treffers.

## Vorschau der Oberfläche

Layout des Sucheinstiegs in der Seitenleiste und des Suchpanels:

![Sucheinstieg in der Seitenleiste](assets/content-search-example.png)
![Suchpanel](assets/new-index.png)

## Der eigene Index: drei Mechanismen

Der Inhaltsmodus **baut seine eigene Datenbank**, ohne vom offiziellen Volltextindex `session-query-sqlite` von DSH abzuhängen. Der Index lebt in `src/host/`: `schema.ts` legt die Tabellen an (einschließlich der eigenen FTS5-Tabelle `docs_fts`), `engine.ts` führt die Abfragen aus, `extract.ts` zieht den durchsuchbaren Text aus den Sitzungsereignissen (einschließlich Tool-Name und Argumente bei `tool/call` sowie Ergebnistext bei `tool/result` — die Datenbasis des „Tool-Filters"). Das `sessionQuery` von DSH dient nur als **Korpusleser** (`listSessions` / `readSession`), nie als Suchbackend.

### 1. Ein unabhängiger Index des Sitzungsinhalts

Der Index ist die **eigene SQLite-Datei dieses Plugins** und berührt den offiziellen Index nicht. Das persistente Verzeichnis ist wählbar, Snapshot-Export/-Import möglich, Gesamtaufbau möglich. Bei Aktivierung des Hosts wird das Indexverzeichnis inspiziert: Ein unvollendetes `index.building.sqlite` neben einem existierenden aktiven Index gilt als „der letzte Neuaufbau wurde nie fertig" und wird verworfen; fehlt der aktive Index, gilt „der Absturz traf das Umbenennungsfenster", und das neueste Archiv wird als aktiv zurückgerollt.

### 2. Abgeschriebene Sitzungen werden nach Archivstand ausgemistet, fortlaufend aktualisiert

`archive-source.ts` liest `global.archivedSessionIds` aus dem offiziellen Speicher-Hub `~/.dsh/storages/workspace.json` und hält **archivierte (also unbrauchbare) Sitzungen aus dem Index heraus**. Die Archivmenge hat genau einen Schreiber — den Steward; dieses Paket liest sie nur.

Die Synchronisierung ist **rollierend**: `SwitchWatermarkSync` in `sync.ts` führt je Sitzung ein `version`-Wasserzeichen und vergleicht bei jedem Durchgang nur Differenzen und lädt nur veränderte Sitzungen nach — nie ein Voll-Neuaufbau. Die Indexdateien selbst werden in begrenzter Stückzahl gemäß `archiveKeep` vorgehalten, ältere fallen automatisch weg.

### 3. Die Aufräumaktion behindert den arbeitenden Index nie

Das Aufräumen läuft über einen **Schattenindex**: `rebuild.ts` baut `index.building.sqlite` von Grund auf neben dem aktiven Index, und während der gesamten Bauzeit **bedient der aktive Index die Suchen weiter** — Abfragen werden nie blockiert. Nach Fertigstellung besteht die Umschaltung aus drei synchronen `rename`-Aufrufen (active → archive, shadow → active), also einem einzigen atomaren Fenster.

Daraus ergibt sich die Fehlersemantik: **Schatten vorhanden + aktiver Index vorhanden = Bau nicht fertig**; der Schatten ist dann Abfall und wird einfach verworfen — der aktive Index war zu keinem Zeitpunkt in Gefahr.

## Installation

```sh
# Variante 1: direkt aus GitHub installieren (empfohlen) — lib/ ist committet, kein lokaler Build nötig
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master

# Variante 2: aus lokalem Pfad / Quellcode zusammensetzen (siehe „Entwicklung")

# dsh web neu starten — Pflicht! Eine laufende Instanz lädt die Bundle-Ebene nicht nach
dsh web
```

Nach der Installation erscheint am Fuß der Seitenleiste ein Knopf **„Suche"**; Einstellungen → Plugins erhält die Karte **„Suchindex"**.

> ⚠️ **GitHub-Erreichbarkeit**: Die Installation über github: setzt voraus, dass github.com erreichbar ist; in eingeschränkten Netzen richten Sie zuerst einen funktionierenden Proxy oder Mirror ein, sonst bleibt `add` beim Holen hängen.

## Entwicklung

```sh
pnpm install            # enthält die @deepseek-ai-Client-Kette + tsdown/tsc
pnpm typecheck          # tsc --noEmit
pnpm build              # tsc(lib/types) + tsdown(lib/index.mjs + lib/client.js)
```

### Aufbau der Quellen

```
src/
├── index.ts            # Host-Hälfte (node): Config-Schema + installSettingsSection + Routen
├── config.ts           # reine geteilte Konfiguration (enabled/defaultMode + Namespace-Konstante, ohne schemastery für den Client)
├── host/               # der eigene Index (Host-Seite)
│   ├── schema.ts       # Tabellen: docs / docs_fts(FTS5) / sessions / Wasserzeichen
│   ├── engine.ts       # Abfragen
│   ├── extract.ts      # zieht durchsuchbaren Text aus Sitzungsereignissen (tool/call und tool/result inklusive)
│   ├── sync.ts         # SwitchWatermarkSync: rollierende inkrementelle Synchronisierung nach version-Wasserzeichen
│   ├── rebuild.ts      # Schattenbau + atomare Umschaltung + Absturz-Inspect
│   ├── archive-source.ts  # liest die Archivmenge, um archivierte Sitzungen aus dem Index zu halten
│   └── snapshot.ts     # Snapshot-Export/-Import
└── client/
    └── index.ts        # Browser-Hälfte: Eintritt sidebar.footer.action + schwebendes Panel + Zeile settings.general.item
```

- **Host-Hälfte**: registriert die abgeschirmte HTTP-Route `/switch-search/api` (`list-sessions` / `content-search` / `search-status`), mit einer Browser-Vertrauensschranke identisch zum DSH-`/api`-Gateway (loopback Host oder trustedHosts; cross-site abgewiesen).
- **Konfigurationsmuster**: Der Host registriert den Namespace `switch-search` über den `settings`-Dienst + schemastery-`Config`; die Client-Hälfte spiegelt ihn mit lokalem Store-Sitz + `settingsScope.bind`; das reine geteilte Modul `src/config.ts` hält das Client-Bundle schemastery-frei.
- **Build-Kette**: tsdown spiegelt die Semantik des harness `packages/client/tsdown.client.ts` (`__ModuleLoader__.load`-Banner, Externals-Tabelle pro Plattform, Reinheits-Schranke fürs Bundle).
- **lib/ eingecheckt**: GitHub-Installationen laufen mit dem committeten Build-Artefakt (dsh führt bei einer Git-Installation kein `prepare` aus); `.gitignore` schließt `lib/` nicht aus.

## Verhältnis zur offiziellen Seitenleisten-Suche

- Das offizielle Suchfeld der Seitenleiste lebt in `sidebar.workspaces` (einzelner Slot), den ein externes Plugin **nicht ersetzen kann**; dieses Plugin ergänzt am Fuß der Seitenleiste einen **eigenständigen Eintritt** über `sidebar.footer.action` — beide existieren nebeneinander, ohne sich zu stören.
- Die offizielle Inhaltssuche ist im apiproxy fest verdrahtet und durchsucht nur `user/message` + `assistant/message`; dieses Plugin durchsucht seinen eigenen Index und öffnet `tool/call` + `tool/result`, für eine Suche auf Tool-Ebene.

## Kompatibilität und Datenschutz

- Setzt ein installiertes DeepSeek Harness mit Web-Profil voraus; **kein offizieller Quellcode wird geändert**. Der Index ist die Datei dieses Plugins selbst — ob der offizielle `session-query-sqlite` eingeschaltet ist, bleibt ohne Wirkung.
- Die Konfiguration lebt nur im DSH-settings-Namespace und im Browser-Panel-Zustand; nichts wird gelesen oder hochgeladen, was über die Sitzungssuch-Daten hinausgeht.
- Host-/Client-Vertragstypen sind strukturell in `src/*.ts` deklariert (die dsh-Client-Paketkette auf npm ist unvollständig) und werden zur Bauzeit gegen die harness-Quellen verifiziert.

## Die DSH-Plugin-Familie von drscrewdriver

Dieses Projekt gehört zur Reihe der DSH-Plugins von [drscrewdriver](https://github.com/drscrewdriver). Wenn dieses Ihnen nützt, werden die anderen es vermutlich auch:

| Plugin | In einem Satz |
|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | Eingabewarteschlange für Spitzenlasten im DSH Web GUI: dreistufige Verkehrsregelung, Drag-&-Drop-Umsortierung, Sitzungseinfrieren |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | reasoning_effort-Steuerung Runde für Runde: intelligente Auto-Planung oder manuell fixierte Stufe |
| [dsh-seatbelt-sandbox](https://github.com/drscrewdriver/dsh-seatbelt-sandbox) | macOS-Seatbelt-Sandbox-Adapter: nativer libsandbox-Loader, Nachfolger des veralteten sandbox-exec |
| [dsh-prime-memory](https://github.com/drscrewdriver/dsh-prime-memory) | Geschichteter Destillierspeicher: automatische L0~L3-Destillation, Rückruf-Einspeisung vor jedem Modellschritt |
| **[dsh-search-index](https://github.com/drscrewdriver/dsh-search-index)** | Sitzungssuche in der Seitenleiste: Titel-/Inhaltsumschaltung, Filter nach Benutzer/Antwort/Tool |

## License

MIT
