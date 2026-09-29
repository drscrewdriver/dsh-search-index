# Changelog

Alle wichtigen Änderungen und Bugfixes werden hier festgehalten. Die Versionen folgen der semantischen Versionierung (Installation via `dsh plugin --profile web add github:drscrewdriver/dsh-search-index`).

## 0.6.0 — Anpassung an DSH 0.2.0-rc.1 (Metadaten-Generationssprung ohne eine einzige Codeänderung)

- **Generationswechsel bei peer/engines**: die 4 dsh-*-Peers (`dsh-client-locale` / `dsh-client-ui-settings` / `dsh-client-ui-settings-general` / `dsh-client-ui-slots`) sowie die beiden `engines.dsh`-Einträge in `package.json` und `dsh.plugin.json` wurden gemeinsam auf `>=0.2.0-rc.1 <0.2.1-0` gesetzt (rc-Fenster festgenagelt, Neubewertung ab 0.2.1).
- **Null Codeänderungen**: Die Konsumfläche des Plugins gegenüber dem Host ist rein Caller-artig (`ctx.get('slots'/'locale'/'configForms')` als weiche Lesezugriffe + lokale strukturelle Schnittstellen); 0.2.0 hat gegenüber 0.1.7 weder die slots/settings-Verträge noch das Sitzplatzregister angetastet.
- **Generationswechsel bei devDependencies**: die devDep `dsh-client-ui-slots` geht von `^0.1.0-rc.6` auf `0.2.0-rc.1` (Angleichung an den neuen optionalen Peer, um Fehlpaarungen im Installationsbaum zu vermeiden); die devDep `@deepseek-ai/cordis` geht von `^4.0.1` auf `^4.0.4` (die 0.2.0-rc.1-Paketfamilie verlangt `~4.0.4`).
- **Abhängigkeitsverwaltung**: Der maßgebliche Paketmanager dieses Repos ist pnpm (`pnpm-workspace.yaml` + pnpm-lock v9); `pnpm-lock.yaml` wurde neu erzeugt, das veraltete `package-lock.json` (auf dem Stand von 0.5.0 stehen geblieben) entfernt.
- **Dokumentation**: Kompatibilitätsmatrix und Hauptlinien-Satz der READMEs (zh/en) auf 0.2.0 aktualisiert; die DSH-0.1.7-Linie wird weiter von 0.5.7 bedient (dist-tag `dsh-0.1.7`, Zweig `compat/0.1.7`).

> Hinweis: Versionen zwischen 0.2.0-beta.5 und 0.5.7 liegen in der Verantwortung der DSH-0.1.x-Linie; siehe Zweig `compat/0.1.7` und npm dist-tag `dsh-0.1.7`.

## 0.2.0-beta.5 — In der schmalen Spalte weicht die „Taste", und die Namen beider Einträge sind ganz lesbar

### Fixes (durch den Realtest von beta.4 offengelegt)
- **Symptom**: Seit beta.4 diese Eingabe nicht mehr die ganze Zeile besetzt, muss die Zeile `sidebar.footer.action` zugleich
  „🔍 Suche Ctrl K“ und „🧭 Sitzungs-Steward“ fassen. Gemessen ergibt die natürliche Breite beider Zeichenketten zusammen **240px**,
  die schmale Spalte (rund 215–225px) trägt das nicht: dieses Plugin steht auf `flex:1`, der Wrapper des Stewards auf `flex:none` (weicht nie),
  sodass **die gesamte Lücke auf die Such-Pastille drückt** — deren Label ist das einzige schrumpfbare Element darin und wurde auf ein einziges „搜“ zusammengepresst.
- **Wer weichen sollte**: Die Taste ist nur ein **Hinweis** (Tooltip des Eintrags und die Fußleiste des Panels wiederholen denselben Akkord),
  das Label ist die **Identität** des Eintrags. Also weicht die Taste: `.dsws_root` deklariert `container-type:inline-size`,
  und unterhalb von 132px eigener Breite klappt es `.dsws_kbd` per `@container` ein (43px Ersparnis).
- **Gemessen (Chrome, eine Sonde rekonstruiert das echte CSS und DOM beider Einträge)**: bei 180–230px Spaltenbreite ist das Label 28/28 vollständig, die Taste blendet sich automatisch aus,
  beide Einträge ohne jeden Überlauf; ab 240px erscheint die Taste wieder. Die Basislinie vor der Änderung zeigte bei 220px nur noch 12/28 des Labels.
- **Die Rail-Form braucht eine Ausnahme**: `container-type` bringt auch inline-size-Größencontainment mit und lässt das `flex:none`-Rail-Wurzelbox
  **auf 0px Breite zusammenfallen** (im Test: root=0, während der Button bei 36px bleibt und aus der Box überläuft). Daher fällt `.dsws_rootRail` ausdrücklich auf `container-type:normal` zurück.
- **Rail-Größe zurück auf 28×28**: Die Inhaltsbox des Rails ist nur 36px hoch (56px Rail − 2×10px Padding); die offizielle 36×36-Kontrollbox
  beruht auf der Annahme **eines einzigen Steuerlements pro Zeile**; sitzen beide Einträge in einer Zeile, überlaufen 36+28=64px um 14px. Gewählt: 28+28=56px,
  eine Spur schmaler als die 32+28=60px vor der Änderung.
- Tasten-Padding `0 5px` → `0 4px` (selbstgetragene 2px).

## 0.2.0-beta.4 — Der Sidebar-Eintrag teilt sich die Zeile selbstständig mit dem „Sitzungs-Steward“

### Änderungen
- **Platz machen statt besetzen**: `.dsws_root` war ursprünglich `flex:none;width:100%` und besetzte in der Flex-Zeile `sidebar.footer.action` die ganze Zeile,
  schob den angrenzenden Steward-Eintrag ans Zeilenende, und die 42px-Pastille war zudem höhenversetzt zum Symbolknopf des Gegenübers. Neu: `flex:1 1 auto;min-width:0`, Button `flex:1;min-width:0` —
  isomorph zum offiziellen Steuerlement desselben Sitzes (`.trigger{flex:1;min-width:0;height:42px;border-radius:12px;padding:0 10px 0 8px}` von `ui-settings-general`).
  Bei Platzmangel wird zuerst das Label verkürzt (`.dsws_buttonLabel` hat ohnehin ellipsis), ohne Nachbarn weiter zu quetschen.
- **Eingeklappte Rail am offiziellen 36×36 ausgerichtet**: bei `wide=false` wechselt der Button zu `.dsws_buttonRail` (`36×36`, `border-radius:50%`),
  das Wurzelelement bekommt `.dsws_rootRail` und bleibt `flex:none`; ausgerichtet an der Figma-Rail-Spezifikation (56px Rail / 10px Padding / 36×36-Kontrollbox).
- **Inhalt linksbündig**: `justify-content:center` entfernt, das Symbol steht damit in derselben Spalte wie die offizielle „Einstellungen“-Zeile direkt darunter.

### Unangetastet
- Interaktion, Panel, Index, Routen, Einstellungs-Namespace `switch-search`: alles unberührt; ist `enabled` aus, verschwindet der gesamte Eintrag (einschließlich `⌘K` / `Ctrl K`) wie bisher mit einem Schlag.
- Die Kooperation spielt sich ausschließlich im jeweiligen CSS der beiden Plugins ab: Dieses referenziert keinen Wert des Stewards und unterstellt weder seine Präsenz noch seine Abwesenheit.
- Die neuen Selektoren werden alle im Code referenziert; das „null verwaiste Klassen“ von `tests/client-styles.test.mjs` gilt weiterhin.

## 0.2.0-beta.1 — Umbenennung in dsh-search-index, der Sitzungsverlauf zieht zum Sitzungs-Steward aus

### Breaking Changes

- **Pakets-Umbenennung**: `dsh-session-search-toggle` → **`dsh-search-index`** (Client-Registrierungs-id, cordis-Patch-id und Repository-Adresse wurden mit umbenannt). Der Einstellungs-Namespace **bleibt `switch-search`**: Er ist ein Speicherschlüssel; eine Änderung würde die Nutzerkonfiguration verwerfen — bewusst lässt man ihn daher nicht dem Produktnamen folgen. Der alte Name löst über die GitHub-Umleitung weiterhin auf, aber stellen Sie die Profil-Abhängigkeit auf den neuen Namen um, statt beide Namen koexistieren zu lassen.
- **Auszug aus der Domäne Sitzungsverlauf** (Archivansicht + Archivaufräumung, einschließlich des Sidebar-Eintrags „archivierte Sitzungen“ und des „Archiv ansehen“ in der Einstellungskarte) → in den Tab „Aktenkammer“ des neuen Pakets **`dsh-session-steward` (Sitzungs-Steward)**.
- **Dieses Paket schreibt die Archivmenge nicht mehr**: `pruneArchiveFile` samt der beiden Methoden `list-archived` / `archive-prune` sind mit ausgewandert. Es **liest** die offizielle Archivmenge weiterhin (`readArchiveSet`), um archivierte Sitzungen aus dem Index zu halten — die Archivmenge hat genau einen Schreiber: den Steward. Der Dateiformatvertrag ist in `dsh-归档文件格式契约-20260914.md` beschrieben.
- **Expliziter Grabstein für die alten Methodennamen**: `list-archived` / `archive-prune` antworten jetzt mit **HTTP 410** und einem eindeutigen Fehler, der auf `/session-steward/api/session-history-list|prune` zeigt. Ein Browser-Refresh lädt die Host-Hälfte nicht neu; das alte Client-Bundle muss **laut scheitern und gesagt bekommen, wohin**, statt still ein 404 zu bekommen, das als „das Archiv ist kaputt“ gelesen wird.

### Entfernt

- `src/client/archive-panel.tsx` (zum Steward umgezogen), die Schreibfunktion `pruneArchiveFile` aus `src/host/archive-source.ts`, der Archiveinstieg in der Einstellungskarte samt der `openSession`-Injektionsfläche von `IndexBlock` sowie die betroffenen Textschlüssel.
- Der Prune-Testfall ist mit der Implementierung ausgewandert: Die Abdeckung folgt der **Implementierung** und wurde auf Steward-Seite in `tests/history.spec.ts` (8 Fälle) neu aufgebaut, damit keine Lücke entsteht, in der „keines der beiden Pakete testet“.

### Behalten

- Alle Fähigkeiten des unabhängigen Index: inkrementelle Synchronisierung, nicht-destruktive Neuaufbereitung (shadow + atomare Umschaltung + begrenzte Ablage `archiveKeep`), Snapshot-Export/-Import, Wiederanlauf-Inspektion des Index, Explizitmachung fehlgeschlagener Status-Lesezugriffe. `archiveKeep` meint die Anzahl aufbewahrter **Indexdatei**-Kopien und hat mit der Sitzungsarchivierung nichts zu tun; er bleibt daher in diesem Paket.

## 0.2.0-beta.3 — Der Archivzähler zeigt nun den Weg, der Aktivierungsschalter wirkt wirklich, 13 verwaiste Selektoren entfernt

### Fix: Der Zähler `archivierte Sitzungen` war eine Zahl ohne Zuständigkeit — jetzt zeigt er den Weg

- **Symptom**: Eine Pastille in der Einstellungskarte meldete „archivierte Sitzungen: 72“, die dieses Plugin **nicht verwalten kann** (Archivansicht und -aufräumung sind zum Steward ausgewandert). Der Nutzer sah eine Zahl und konnte nichts anklicken — wie eine kaputte Funktion zu lesen.
- **Abhilfe**: Der Pastillen-Text wechselt von `archivierte Sitzungen {n}` zu **`{n} archivierte(n) Sitzung(en) aus dem Index ausgeschlossen`** (klärt, dass es die **vom Index Ausgeschlossenen-Menge** ist, keine To-do-Liste), ergänzt um einen Besitz-Hinweis darunter — wer verwaltet was, und wofür dieses Plugin zuständig ist.
- **Nur auf den richtigen Weg zeigen**: Der Host gewinnt `src/host/peers.ts`, das `dsh-session-steward` aus dem **Modulgraphen des Plugins selbst** (also den `node_modules` des Profils) auflöst. Drei Zustände `installed` / `missing` / `unknown`: „derzeit nicht installiert“ erscheint **nur bei sicher misslungener Auflösung** — einem Nutzer zu sagen, er solle ein bereits installiertes Plugin installieren, ist schlimmer als Schweigen; alle übrigen Resolver-Fehler (etwa korruptes Manifest) laufen auf `unknown` und bekommen den neutralen Text.
- Die Auflösungsbasis von `probePeer(name, base?)` ist injizierbar, daher ist der Zweig „vorhanden, aber nicht lesbar“ im Test reproduzierbar (mit einem korrupten `package.json`-Fixture, das über die injizierte Basis adressiert wird).

### Fix: `Sitzungssuche aktivieren` war ein Toter Schalter — jetzt wirkt er wirklich

- **Symptom**: `enabled` hatte einen Typ, einen Default, einen Schalter, einen Text („Zeige den Eintrag „Suche“ am Fuß der Seitenleiste“), aber **nicht einen einzigen zweiten Konsumenten im ganzen Repo**: Der Eintrag registrierte sich bedingungslos, der Schalter steuerte nichts.
- **Abhilfe**: Das Binding des Einstellungs-Namespace wird **genau einmal** aufgelöst (`entryScope`), Eintrag und Einstellungskarte **teilen dasselbe** Binding; der Eintrag abonniert via `useSyncExternalStore` und liest `enabled` — ausgeschaltet verschwindet der ganze Eintrag (einschließlich der Aufruftaste `⌘K` / `Ctrl K`) mit einem Schlag: „ist dieses Plugin an“ hat stets genau eine Antwort.
- Bei unlesbaren Einstellungen (kein `settingsScope`, Zustand unlesbar) **bleibt der Eintrag sichtbar**: den Nutzerentscheid nicht lesen zu können ist keine Aufforderung zum Abschalten; und wer den Eintrag versteckt, versteckt auch den „einzigen Rückweg zum Panel“ mit.

### Aufräumen: 13 verwaiste Selektoren (davon 10 aus dem bereits ausgezogenen Archiv-Panel)

- Beim Umzug des Archiv-Panels zum Steward blieben die Selektoren vor Ort und wurden weiter ausgeliefert: `dsws_archRow` / `dsws_archCheck` / `dsws_uuid` / `dsws_dialogHead` / `dsws_dialogTitle` / `dsws_dangerBtn` / `dsws_editActive` / `dsws_linkBtn` / `dsws_indexLine` / `dsws_setRoot`. Ein Stylesheet voller Stile für „Panels, die es nicht mehr gibt“ liest sich wie „dieses Plugin verwaltet die Ecke noch“ — genau das Missverständnis, das die Abspaltung beerdigen sollte.
- Weitere 3 tote Klassen entfernt: `dsws_switch` / `dsws_switchTrack` / `dsws_switchThumb` — das `Toggle` ist längst auf reine Inline-Styles umgestellt, diese Klassenselektoren wurden nie referenziert.
- Das Stylesheet sinkt von 53 Klassen auf 50, **null Verwaiste**.
- tests: neu `tests/client-styles.test.mjs` — das Stylesheet darf nur einen Besitzer haben; **jede** Klasse muss im Code referenziert sein, sonst Fehler (genau deshalb konnten sich diese 13 Klassen bis heute verstecken). Zusätzlich genagelt: „das Einstellungs-Binding hat genau einen Besitzer“ (`bind()` exakt einmal + mindestens zwei Konsumenten) — die strukturelle Verteidigungslinie gegen den Toten Schalter.
- tests: neu `tests/host-peers.test.mjs` (`node --import tsx`) überdeckt die Drei-Zustands-Klassifikation.
- **Widerlegt (Adversarial)**: eine verwaiste Klasse zurückstecken → `client-styles` bricht sofort mit `exit 1`; den Fallback von `probePeer` auf stetes `missing` umstellen → `host-peers` bricht sofort mit `exit 1`; nach Wiederherstellung beider alles grün.

## 0.2.0-beta.2 — Aufruftaste und plattformgerechte Tastenhinweise; Ergebnissortierung, Echtzeittitel und eine Ladung Fixes an der Suchkette

### Neu: Aufruftaste + plattformgerechte Tastenhinweise (Pop-up-Stil angelehnt an `@hyzyn/dsh-search`)

- **Ein Akkord ruft das Panel**: **`⌘K` (macOS) / `Ctrl K` (Windows/Linux)** von jeder Stelle der Seitenleiste öffnet das Suchpanel, gleichwertig zum Klick auf den Eintrag. Die Bindung hängt an der Eingangskomponente, nicht auf Plugin-Ebene — wird der Eintrag geschlossen, verschwindet der Akkord mit: „ist das Plugin an“ hat nur eine Antwort.
- **Tastenhinweise plattformgerecht**: Rechts am Sidebar-Eintrag wie in der neuen Tastenleiste am Panel-Fuß wird die Aufruftasten-Pastille gerendert; die Schließtaste ist gleichermaßen `esc` (macOS) / `Esc` (sonst). Zuvor hatte das Plugin **null Hinweise zu Tastenkürzeln** — der Eintrag war nur per Maus zu entdecken.
- **Plattformerkenner mit dreistufigem Fallback**: `UA-CH (navigator.userAgentData.platform) → navigator.platform → UA-Zeichenkette`. Die bloße `navigator.platform`-Prüfung des Referenz-Plugins kopiert, liefert diese API unter manchen Privatsphäre-Konfigurationen eine leere Zeichenkette und degradierte Mac-Nutzer still zum Windows-Wortschatz; jetzt fragt eine leere Zeichenkette weiter die nächste Stufe, und wenn nichts antwortet, fällt es auf **`Ctrl`/`Esc`** zurück — `Ctrl` versteht jeder, `⌘` nicht.
- **Hinweis und Bindung aus einer Quelle**: Der Akkord auf der Pastille und der vom `keydown`-Handler tatsächlich erkannte Akkord werden am selben Ort erzeugt (`isInvokeChord` in `src/client/platform.ts`), mit gegenseitiger Forderung „der andere Modifier muss fehlen“, um die Plattformen zu unterscheiden. Es kann also nicht vorkommen: „unten steht `⌘K`, aber der Handler kennt nur `Ctrl+K`“ — ein Hinweis, auf den nichts reagiert.
- **Adaptive Taste**: `.dsws_kbd` rendert mit `min-width:18px; width:auto` — `Ctrl K`, `⌘K`, `Esc` zeigen sich vollständig ohne Quetschen; das Textlabel des Sidebar-Eintrags wird schrumpfbar mit Ellipsis, damit die Taste das Label nicht aus dem Button drückt.
- tests: neu `tests/client-platform.test.mjs` (`node --import tsx`, Direktests der reinen Funktionen aus `src/client/platform.ts`: dreistufiger Fallback inkl. leerer Zeichenkette im Privatsphäre-Modus, vier Wortschatz-Tabellen, Akkord-Wahrheitstabelle, sowie die Halb-übergreifende Konsistenz „die jede Plattform ankündigte Taste muss der Handler akzeptieren“; dazu strukturelle Nägel auf das **Artefakt** — die UA-CH-Stufe hat genau einen Besitzer, `isInvokeChord` ist mindestens zweifach referenziert (Definition + Listener), drei Tastenpastillen, Akkordflächen beider Plattformen aus einer Quelle). **Widerlegt**: Ersetzt man `isInvokeChord(...)` im Listener durch einen Literalvergleich, scheitern die Artefakt-Assertionen sofort.

### Verfeinerung: Der Schatten des Panels folgt den offiziellen Token

- Die Panel-Schatten war hart codiert `0 8px 28px rgba(0,0,0,.16)`, jetzt `var(--dsw-shadow-lv3, 0 8px 28px rgba(0,0,0,.16))` — dieselbe Stufe Flutschatten wie die offiziellen `Menu` / `Modal` / `Toast` / `HoverCard`, themenfolgend; der alte Wert bleibt als `var()`-Fallback, alte Hosts degradieren nicht. Der 12px-Radius deckte sich ohnehin mit der offiziellen Dropdown-Karte (`r12` des `Menu`); der Schleier folgt `--dsw-alias-bg-mask-1` + `--dsw-mask-blur`, gleiche Quelle wie das offizielle `Modal`.

### Fix: Inhaltssuche dauerhaft leer — der Anfrage-Schlüssel hatte zwei Besitzer

- **Symptom**: Die Inhaltssuche bekam die richtigen Ergebnisse, doch die Oberfläche verharrte ewig im Ladezustand und zeigte nichts. Host-seitig im Realtest einwandfrei — `content-search` traf sowohl für Chinesisch (`插件`, `适配`) als auch für ASCII (`dsh`); weder Index noch Tokenisierung haken.
- **Wurzel**: Der Anfrage-Schlüssel war **von Hand doppelt geschrieben**. Der anfragende Effekt setzte einen Dreisegment-Schlüssel `query\0type\0sortBy` zusammen, das Rendering für das Urteil „gehört dieses Ergebnis zur aktuellen Eingabe“ einen Zweier-Schlüssel `query\0type`. Die Version mit der Sortierung änderte nur die Schreibseite: Die beiden Schlüssel sind nie gleich, und `activeContent` fiel in jedem Zyklus in den leeren `loading`-Zweig — Ergebnisse kamen, wurden geparst, dann weggeworfen.
- **Abhilfe**: Der Schlüssel konvergiert auf **einen Besitzer** — ein `contentRequestKey(normalized, contentType, sortBy)` für beide Seiten. Nicht gewählt: „das fehlende Segment beim zweiten Exemplar nachtragen“ — es blieben zwei Besitzer, und die nächste Eingabedimension ließe alles erneut driften.
- **Anti-Regress**: neu `tests/client-panel-key.test.mjs`. Der React-Renderpfad gehört nicht zu dieser Abdeckung (`client-store.test.mjs` erklärt zu Beginn, das GUI nicht abzudecken), daher Nagelung struktureller Invarianten — das Artefakt darf **genau ein** Template-Literal mit NUL-Trenner enthalten, und der geteilte Helfer muss mindestens 3-mal referenziert sein (Definition + zwei Aufrufstellen). Die Assertion wurde praktisch geprüft: Schreibt man den zweiten Schlüssel ins Artefakt zurück, scheitert sie; danach zurückgebaut.

### Neu: Ergebnissortierung (Relevanz / Zeit) + Titeländerungen in Echtzeit in den Index

- **Sortier-Umschalter**: Über den Inhaltssuchergebnissen ein neuer Umschalter „Relevanz / Zeit“, in derselben Zeile wie der Typfilter, rechtsbündig. „Relevanz“ als Default bewahrt das bisherige Verhalten; „Zeit“ sortiert absteigend nach der **letzten Aktivität der Sitzung**, bei Gleichstand nach Trefferstärke.
- **Zeitfelder mit klarer Rollenverteilung**: Jeder Treffer liefert zugleich `time` (Zeitstempel des am besten passenden **Dokuments**) und `updatedAt` (Uhr auf **Sitzungs**-Ebene). Die Sortierung nutzt letzteres — die Zeit des getroffenen Dokuments sagt nichts darüber, ob die Session kürzlich bewegt wurde. Beide Felder werden geliefert, das Frontend kann selbst nachsortieren.
- **Sortieren vor dem Abschneiden**: Der Host sortiert zuerst und kürzt dann auf `limit`. Erst kürzen, dann sortieren hieße: der „Zeit“-Modus würfelte nur die ohnehin nach Relevanz gekappten Top N um — sortiert praktisch nichts.
- **Auswahl persistiert**: Die Sortierpräferenz lebt im `localStorage` (Schlüssel `dsh-search-index.sortBy`) und übersteht Neuladen; scheitert das Lesen/Schreiben im Privatsphäre-Modus, wird still auf Relevanz zurückgefallen.
- **Verträglich mit alter Host-Hälfte**: Kennt der Host `sortBy` nicht, fällt er auf Relevanz zurück statt zu fehlern; der Client sortiert nur lokal um, wenn jeder Treffer ein numerisches `updatedAt` trägt — um auf alten Daten kein NaN zu berechnen.
- **Die Zeit hält Einzug in die Inhaltszeilen**: Die Kopfzeile der Inhaltsergebnisse zeigte bisher nur das Typ-Tag, Zeit erschien nur in den Titelsuchergebnissen. Nach „Zeit“ sortieren, ohne irgendeine Zeit zu sehen, macht die Sortierung unverifizierbar. Jetzt steht rechts neben dem Typ-Tag die **letzte Aktivität der Sitzung** (`updatedAt`) — dasselbe Feld, das die Sortierung nutzt, und dieselbe Zeit wie in der Kopfzeile.
- **Titel in Echtzeit**: Eine Umbenennung hängt ein log-only-`session/title`-Ereignis an (die Modellfläche bleibt unberührt). Bisher wartete man bis zur nächsten Wasserzeichen-Synchronisierung (Standard 30 s), bis der Index es spiegelt; jetzt abonniert der Host `session/event` und klappt bei Treffer den Titel gezielt nach id ein (`SwitchWatermarkSync.refreshTitles`), ohne den ganzen Scanlauf abzuwarten. Ereignisse werden in 250-ms-Bursts verschmolzen; bei `autoSync: false` greift es nicht ein; **das Wasserzeichen rührt sich nicht** — eine Titelaktualisierung lässt den Index nie behaupten, gelesen zu haben, was er nicht las; der nächste Lauf reingestiert die Session über die gebumpte Version.
- tests: Die Sortierung `sortBy=time` nutzt bewusst verkehrte Stichproben „alt, aber sehr relevant / neu, aber kaum relevant“ (sonst könnte die Assertion nur zufällig bestehen), und deckt Sortieren-vor-Kürzen sowie Fallback bei unbekannter Sortierung ab; `refreshTitles` deckt sofortiges Einklappen, kein Wiederlesen des Logs, unberührtes Wasserzeichen, Idempotenz unbekannter ids, Konvergenz im nächsten Lauf ab. Gesamtsuite 24/24.

### Fix: Inspektion und Bergung von Halbfabrikaten nach abnormal abgebrochenem Rebuild

- Bei Host-Aktivierung (vor dem Öffnen der Engine) wird das Indexverzeichnis automatisch inspiziert: ein unfertiges `index.building.sqlite` — existiert active, gilt „der letzte Rebuild wurde nie fertig“ und es wird verworfen (inklusive -wal/-shm; active war nie in Gefahr); fehlt active, gilt „der Crash traf das Umbenennungsfenster“, das **neueste Archiv wird als active zurückgerollt**, dann wird das Halbfabrikat verworfen; weder active noch Archiv — Neuanfang. Durchgehend Log `[switch-search] index recovery`.
- Fehlgeschlagene Status-Lesezugriffe sind explizit (Fehlerpastille + Wiederholen-Knopf), kein endloses „Lese den Indexstatus…“ mehr.
- tests: 2 Fälle zum Bergungsweg (Verwerfen des Halbfabrikats / Zurückrollen aus dem Umbenennungsfenster), Gesamtsuite 18/18.

### Interaktion: Archiv-Aufräumung läuft über einen Bearbeitungsmodus

- Das Archiv-Panel ist standardmäßig schreibgeschützt; ein „Bearbeiten“-Knopf im Kopf schaltet in den Bearbeitungszustand — Checkboxen, Alles-Auswählen und das rote „Auswahl löschen (N)“ erscheinen nur dort; „Fertig“ verlässt ihn und leert die Auswahl.
- Der Löschen-Knopf läuft weiterhin durch den vollständigen Bestätigungsablauf (JS confirm: id-Zusammenfassung + Warnungen zu Backup/Neustart/Nicht-Widerrufbarkeit) → `archive-prune` → sofortige Aufhebung der Soft-Delete-Markierung im Index → Liste aktualisieren und im Bearbeitungszustand bleiben, um weiter aufzuräumen.

### Neu: Massenaufräumung des Archivs (Verwaltungspanel)

- Das Archiv-Panel gewinnt einen Massenverwaltungsmodus: alles wählen/Archivsitzungen anhaken → **JS-confirm-Bestätigung** (listet die Zusammenfassung der zu entfernenden ids auf) → die `archive-prune`-API entfernt die ids massenweise aus dem `global.archivedSessionIds`-Array des kanonischen Speichers `~/.dsh/storages/workspace.json`.
- Das Schreiben folgt dem offiziellen storage-json-Protokoll: **erst Backup (workspace.json.bak-<ts>), dann atomarer Ersatz** (Temp-Datei im selben Verzeichnis + rename), Serialisierung identisch zur offiziellen (2 Leerzeichen + Zeilenende am Schluss); Obergrenze 5000 ids pro Durchgang.
- Nach dem Entfernen hebt der Plugin-Index die **Soft-Delete-Markierung sofort auf** (version=-1; der nächste Wasserzeichen-Lauf lädt die noch existierenden Sitzungen nach); der Speicherzustand eines laufenden DSH lädt das neue Array erst **nach dem Neustart** — Panel und Log weisen deutlich darauf hin.
- tests: prune-Backup / atomares Schreiben / keine Rückstände / Idempotenz unbekannter ids, Gesamtsuite 17/17.

### Verfeinerung: Rebuild-Beobachtbarkeit + Beschleunigung über Batch-Transaktionen + optionaler better-sqlite3-Treiber

- **Fortschrittsführung gefixt**: Der Rebuild-Fortschritt wurde bisher erst nach Abschluss gemeldet (das Panel blieb auf „0/?“), jetzt ein Status-Sink — index-status spiegelt done/total/Phase laufend.
- **Entwicklerlog** (Präfix `[switch-search]`, über den cordis-Logger): Treiberkennung, Taktzeilen je 50 Rebuild-Sitzungen (sess/s / eta / chunk-Dauer), Phasenübergänge, Laufzusammenfassung der Synchronisierung (scanned/updated/skipped-archived/failures/duration) — Daten für den Vorher-Nachher-Geschwindigkeitsvergleich.
- **Batch-Transaktions-Checkpoints**: Der Rebuild committet je 50 Sitzungen eine Transaktion (fsync amortisiert), fehlgeschlagene Chunks werden einzeln isoliert wiederaufgesetzt; PRAGMA-Tuning (synchronous=NORMAL / temp_store=MEMORY / cache_size=64MB).
- **Doppeltreiber**: `better-sqlite3` kommt als optionalDependencies herein (scheitert die native Kompilierung, blockiert es die Installation nicht), wird zur Laufzeit dynamisch geladen, bei Fehlen Fallback auf node:sqlite; Engine und index-status vermerken den aktuellen Treiber (Feld `driver`) — installiert oder nicht wirkt nur auf die Geschwindigkeit, nie auf Funktionen.
- **Text des Sucheinstiegs**: Der Fußknopf „Titel“ → „Sitzungssuche“.
- tests: neu Tests zur Batch-Transaktions-Verschachtelungssicherheit + Treiberkennung, Gesamtsuite 16/16.

### Neu: Soft-Delete-Synchronisierung fürs Archiv + Archiv-Ansichts-Panel + Ausrichtung am DSH-Stil

- **Archiv-Soft-Delete (schema v4)**: Jeder Wasserzeichen-Lauf liest das offizielle `workspaceRegistry.archivedSessionIds` (träge aufgelöst, automatischer Fallback bei fehlendem Dienst); archivierte Sitzungen tragen eine `archived`-Markierung im Index — aus Suche und Sitzungsliste ausgeschlossen, der Dokumentinhalt entfernt, der header (Titel-Cache) bleibt; **Archivierung zurücknehmen lädt den Volltext automatisch nach** (version=-1 löst das erneute Lesen im nächsten Lauf aus).
- **Die Neuaufbereitung kopiert Archivinhalte nicht mehr**: Rebuild / Snapshot-Export/-Import schreiben bei archivierten Sitzungen nur die header-Zeile, null Kopien in docs/fts.
- **Archiv-Ansichts-Panel**: Ein schreibgeschütztes, zentriertes schwebendes Fenster listet die offizielle Archivmenge (Titel/Zeit/cwd), Klick öffnet die Sitzung; zwei Einstiege — „archivierte Sitzungen“ am Fuß des Suchpanels und „Archiv ansehen“ in der Einstellungskarte (neue `list-archived`-API, fence unverändert). Es gibt keinen offiziellen unarchive-Endpunkt, das Panel bietet keine Wiederherstellung an.
- **Ausrichtung am DSH-Stil** (an den Quellmetriken und Token der offiziellen `SettingsRoot` / `ConnectionIndicator`): Der Fußknopf folgt der offiziellen Trigger-Spezifikation (42px / 12px radius / hover-Token); der Indexstatus spricht die offizielle Pastillensprache (`--dsw-alias-state-warn/success/error-*` Semantikfarben, Punktanimation bei laufender Synchronisierung + Abschaltung unter `prefers-reduced-motion`); der Schleier des schwebenden Fensters wechselt auf die Modal-Mask-Token (`--dsw-alias-bg-mask-1` + blur).
- tests: neu `tests/index-archive.test.mjs` (5 Fälle: Soft-Delete / Wiederherstellung mit Nachladen / header-Zeile / Rebuild-Umgehung / Snapshot-Regeln), Gesamtsuite 15/15.

### Verfeinerung: Umbau der Suchpipeline (Tokenisierung / Speicherung / Abfrageweg)

- **Wortebene-Tokenisierung via Intl.Segmenter statt Trigram**: Der extrahierte Text wird an ICU-Wortgrenzen getrennt und geht in FTS5 unicode61 ein; die Abfrageseite nutzt dieselbe Tokenisierung. Das Indexvolumen sinkt von den vollen 3-Zeichen-Fenstern des Trigrams auf Wortebenen-Token (Größenordnung 1/4 erwartet); 2-Zeichen-Kurzabfragen kehren vom „LIKE-Volltabellenscan“ zu normalen Indexabfragen zurück; Teileingaben treffen über das Suffix-`*`-Präfix des letzten Worts („正在搜“ → 正在搜索); wortübergreifende Fragmente treffen nicht mehr irrtümlich (Präzision steigt).
- **FTS5 external content**: Die FTS-Virtuelltabelle wechselt in den external-content-Modus `content='docs'` (tokenisierte Spalte `index_text` + Originalspalte `text`); der invertierte Index dupliziert den Volltext nicht mehr, erneut rund die Hälfte Speicher gespart; Einfügen/Löschen halten die Konsistenz über den `docs_fts 'delete'`-Befehl.
- **Abfrageweg entlastet**: Die rowids der rank-limitierten MATCH-Unterabfrage passen direkt auf `docs.doc_id`; eine einzige Anweisung erledigt Suche + Typ/Flächen-Filter, und die `IN (...)`-Zweitabfrage mit 5000 Parametern pro Tastenanschlag entfällt.
- Index schema v3: Der alte Index wird beim Öffnen automatisch zurückgesetzt; die Wasserzeichen-Synchronisierung lädt ihn beim nächsten Abtasten automatisch nach — keine manuelle Neuaufbereitung nötig.
- tests: neue Tokenisierungs-Semantikregressionen (Kurzabfrage / Präfix / Präzision), 7/7.

### Refactoring: eigenständige Einstellungskarte (nach dem thinking-levels-Muster)

- **Eigenständige Karte `settings.plugin.item`**: Das Plugin bekommt seine eigene Einstellungskarte (doppelte Registrierung mit `id`+`key`, verträglich sowohl mit dem Keyed-Slot des dsh-CLI als auch mit dem list-Slot des DSH Desktop) und ersetzt damit die bisherige generische Zeile `settings.general.item` samt ihrem lokalen Store-Sitz. Die Karte bindet den Einstellungs-Namespace `switch-search`, abonniert via `useSyncExternalStore` und committet sofort über `scope.set` (ohne Staging-Formular).
- **Vereinheitlichtes Untereinstellungs-Panel**: Aktivierungsschalter, Standardsuchmodus, Auto-Sync-Schalter, Sync-Intervall, Anzahl aufbewahrter Archive sowie der Verwaltungsbereich des Inhaltssuch-Index (Status, Index aufräumen, Snapshot-Export/-Import) — alles läuft in derselben Karte zusammen.
- **Locale-Wörterbücher**: neue `switch-search`-Wörterbücher zh/en (`src/client/locales.ts`); fehlt der locale-Dienst in alten DSH-Versionen, fällt es auf die eingebauten zh-Texte zurück, und ohne settingsScope degradiert die Karte lesend auf DEFAULT_CONFIG, ohne zu crashen.
- **Client-Aufteilung**: die von Panel/Karte geteilten Host-Aufrufe und Typen laufen in `src/client/host-api.ts` zusammen; das `dsh.client.inject` in `package.json` gewinnt `@deepseek-ai/dsh-client-locale` und `@deepseek-ai/dsh-client-ui-settings`.
- **Tests**: `tests/client-store.test.mjs` neu geschrieben als Nachweis des neuen Kartensitzes (Namespace-Binding, kein Store-Sitz, Degrade ohne settingsScope), 3/3.

### Neu: eigenständige Volltext-Index-Engine (keine Abhängigkeit mehr vom offiziellen FTS5-Index von DSH)

- **Eigene Indexdatei**: Die Inhaltssuche geht auf den vom Plugin selbst gebauten Index über (node:sqlite FTS5 + Trigram-Tokenisierung, eigene application id `0x53574954`), abgelegt in `~/.dsh-switch-search/` (über `indexDir` in der Konfiguration oder die Umgebungsvariable `DSH_SWITCH_SEARCH_DIR` überschreibbar). Läuft der offizielle `session-query-sqlite` auf seinem Default `openAt: never`, bleibt die Inhaltssuche voll verfügbar; die offizielle Indexdatei wird nie geöffnet, keiner stört den anderen.
- **Wasserzeichen-Inkrementalsync**: Im Hintergrund werden die `version`-Wasserzeichen der Sitzungen alle `syncIntervalMs` (Standard 30 s) verglichen, und nur für neue/veränderte Sitzungen lädt `readSession` inkrementell nach; die Textextraktions-Semantik ist am offiziellen `extractSessionEventText` ausgerichtet (user/reply/tool/todo/turn-end), samt Nachbau der Oberflächen-Faltung (durch Bearbeitung ersetzte alte Nachrichten werden als shadowed markiert und nicht durchsucht).
- **Nicht-destruktive Neuaufbereitung (Rebuild)**: Panel/Einstellungen können „Index aufräumen“ auslösen — der shadow-Datei wird vollständig gebaut, während der alte Index weiter durchsuchbar bleibt; danach Umschaltung per drei atomaren `rename`, der alte Index wird als `index.archive-<ts>.sqlite` archiviert (`archiveKeep` Kopien, Standard 2).
- **JSON-Snapshot-Migration**: `index-export` exportiert einen JSON-Lines-Snapshot (eine Zeile je Sitzung, inklusive der extrahierten Dokumente), `index-import` importiert den Snapshot und wechselt ihn über denselben Neuaufbereitungsweg atomar ein — nach der Synchronisierung dient der Snapshot direkt als Index; Maschinenumzug und Kaltbackup werden so möglich.
- **HTTP-API**: `/switch-search/api` gewinnt `index-status` / `index-rebuild` / `index-export` / `index-import`; `list-sessions` fällt bei un verfügbarer sessionQuery auf das Lesen aus dem Index zurück; überall gilt der ursprüngliche fence.
- **Client**: Das Inhaltspanel bietet einen Einstieg „Index aufbauen“, wenn der Index fehlt, und zeigt während der Neuaufbereitung den Fortschritt; die Einstellungszeile gewinnt den Verwaltungsbereich „Inhaltssuch-Index“ (Status-Badge, Aufräumen-Knopf, Snapshot-Export/-Import).
- **Konfiguration**: `autoSync` / `syncIntervalMs` / `archiveKeep` / `indexDir` alle optional mit Defaults, abwärtskompatibel.

### Verifikation

- `node tests/index-engine.test.mjs`: 6/6 (Ingestion und gruppierte Suche, Typfilter, FTS-Syntaxbereinigung, alter Index während der Neuaufbereitung abfragbar, Isolation korrupter Sitzungen, Snapshot-Export→Import-Roundtrip, Überspringen defekter Zeilen).
- `npm test` (`tests/client-store.test.mjs`): 9/9.

### Neu: Zwei-DSH-Versionen-Kompatibilität (0.1.1-rc.2 / 0.1.2-rc.1)

- **Ein Artefakt, zur Laufzeit adaptiv**: Dasselbe `lib/client.js` lädt in beiden Versionen, ohne Versionszeichenketten-Verzweigung. Das Client-Bundle `require`t nur `react` / `react-dom`, beide liegen in der geteilten Modultabelle beider Versionen.
- **Der einzige versionsspezifische Wertimport entfällt**: Die Einstellungszeile baute ihren Store bisher über `defineStore` aus `@deepseek-ai/dsh-client-runtime/client`; dieses Engine-Paket wurde in 0.1.2 in `@deepseek-ai/dsh-client-store` umbenannt, jeder Wertimport hätte eine einzelne Version festgenagelt (unter 0.1.2 warf die Materialisierung sofort `require(...) missed the module table` und die gesamte Client-Hälfte lud nicht).
- **Der Store-Sitz wird lokal implementiert**: Der Sitzvertrag (`StoreHandle` / `StoreInstance`) gehört `@deepseek-ai/dsh-client-ui-slots` und ist in beiden Versionen identisch; die Renderfläche konsumiert nur `getSnapshot` / `subscribe` / `actions`. Die lokale Implementierung umfasst rund 30 Zeilen, deckt `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` ab und bewahrt die Revision-Sperre samt Abonnement-Benachrichtigungssemantik; das Verhalten wird von `tests/client-store.test.mjs` abgedeckt (9 Fälle).
- **Snapshot-Typ lokal gespiegelt**: `SettingsScopeSnapshot<T>` hat in beiden Versionen dieselben Felder (status / value / base / user / revision / writable / mode); Umstellung auf eine lokale strukturelle Spiegelung, damit ein Typimport nie auf eine einzelne Version zeigt.
- **Metadaten**: `engines.dsh` auf `>=0.1.0-rc.7 <0.2.0-0` verengt; `peerDependencies` / `devDependencies` werfen `@deepseek-ai/dsh-client-runtime` raus; `dsh.client.inject` zeigt auf das Paket, dem der tatsächlich gefüllte Slot gehört (`@deepseek-ai/dsh-client-ui-settings-general`); die Client-Externals in `tsdown` verlieren das runtime im selben Zug.

### Verifikation

- `npm test` (`tests/client-store.test.mjs`): 9/9.
- `_smoke/smoke-batch-c.mjs`: Host-Hälften-Routen + Einstellungs-Namespace; die Client-Hälfte materialisiert je einmal auf beiden echten Modultabellen (0.1.1-rc.2 mit vorab geladenem `dsh-client-runtime/client` / 0.1.2-rc.1 mit `dsh-client-store`); ein `require` über den Tisch hinaus scheitert, und beide Registrierungsregister stimmen überein.
