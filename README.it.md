<p align="center">
  <strong>Una ricerca delle sessioni con indice proprio per la barra laterale di DeepSeek Harness — commutazione con un clic tra titolo e contenuto, con filtri per utente / risposta / tool</strong>
</p>
<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <strong>Italiano</strong> · <a href="README.ru.md">Русский</a> · <a href="README.es.md">Español</a>
</p>
<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-263146?style=flat-square"></a>
  <img alt="Public" src="https://img.shields.io/badge/status-public-7da1de?style=flat-square">
</p>

# dsh-search-index

> **Indice di ricerca** per la barra laterale del web DSH: aggiunge in fondo alla barra laterale una voce **«Ricerca»** il cui pannello flottante commuta con un clic tra **ricerca per titolo ↔ ricerca per contenuto**; la modalità contenuto mostra titoli e frammenti trovati **aggregati per sessione**, con filtro per categoria **utente / risposta / tool**. Porta con sé un **indice indipendente** (senza dipendere dall'indice full-text ufficiale di DSH), con sincronizzazione incrementale, riorganizzazione non distruttiva ed export/import di snapshot.

> **Questo pacchetto si occupa solo di ricerca e indice.** La consultazione e la pulizia della cronologia delle sessioni (il vecchio pannello «sessioni archiviate») sono migrate alla scheda «Sala d'archivio» di **`dsh-session-steward`**; questo pacchetto **legge** ancora l'insieme di archivio ufficiale per escludere dall'indice le sessioni archiviate, ma non vi **scrive** più — l'insieme di archivio ha un solo scrittore: lo steward. Il contratto è descritto in `dsh-归档文件格式契约-20260914.md`.

Nessuna modifica al codice sorgente di dsh, nessuna PR da aprire: un client cordis più una metà host del plugin, assemblati tramite il comando `dsh plugin` e una patch del bundle.

## Predecessore e versione attuale

**Predecessore: `dsh-session-search-toggle`.** Quella versione si affidava al `defineStore` di `@deepseek-ai/dsh-client-runtime` per fornire il posto della riga delle impostazioni. DSH 0.1.2 ha rinominato/ristrutturato i pacchetti motore del client (`dsh-client-runtime` → `dsh-client-store`); il vecchio codice non poteva più caricarsi sul nuovo host — e un solo plugin non poteva coprire entrambe le versioni con un unico artefatto.

**La versione attuale (`dsh-search-index` 0.6.0) ha come linea principale DSH 0.2.0** (peer `>=0.2.0-rc.1 <0.2.1-0`). Le linee di host storiche sono servite da linee di versioni distinte: DSH 0.1.7 è servito da 0.5.7 (dist-tag npm `dsh-0.1.7`, ramo `compat/0.1.7`); gli host 0.1.1/0.1.2 più vecchi usano l'artefatto storico, che non evolve più con questa versione. Contesto storico:

- **Un solo artefatto, adattivo a runtime**: lo stesso `lib/client.js` si carica sia su 0.1.1-rc.2 sia su 0.1.2-rc.1, **senza alcun ramo su stringhe di versione**. Il bundle client fa `require` solo di `react` / `react-dom`, entrambi presenti nella tabella di moduli condivisa delle due versioni.
- **Nessuno dei due pacchetti motore viene importato**: né `dsh-client-runtime` né `dsh-client-store` — la rinomina quindi **non può colpirlo**.
- **Posto store implementato localmente**: la riga delle impostazioni ha bisogno di un posto store (`StoreHandle` / `StoreInstance`, contratto posseduto da `@deepseek-ai/dsh-client-ui-slots` e identico in entrambe le versioni). Questo plugin sostituisce `defineStore` con un'implementazione locale di una trentina di righe — dipende solo da `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`, senza alcun specifier legato a una versione.
- **Tutti gli altri contratti coincidono nelle due versioni**: lo slot `settings.general.item`, `SettingsScope.{getSnapshot,subscribe,set,unset}` e le tre facce di query di `sessionQuery` hanno le stesse firme in entrambe.

> **▼ Supporto delle versioni di DSH**
> | Versione DSH | Stato | Vettore e differenza chiave |
> | --- | --- | --- |
> | 0.2.0-rc.1 | ✅ | **versione attuale 0.6.0**; peer/engines = `>=0.2.0-rc.1 <0.2.1-0`, zero modifiche al codice (consumo puramente caller dei posti slots/locale/configForms) |
> | 0.1.7-rc.1+ | ✅ | 0.5.7 (dist-tag `dsh-0.1.7`); configForms risolve l'handle tramite entry id, gli host più vecchi ricadono su settingsScope vincolato per namespace |
> | 0.1.1-rc.2 | ✅ (artefatto storico, congelato) | il motore store si trova in `@deepseek-ai/dsh-client-runtime/client` |
> | 0.1.2-rc.1 | ✅ (artefatto storico, congelato) | il motore è stato rinominato `@deepseek-ai/dsh-client-store`; questo plugin non importa nessuno dei due |

**Aggiornamento dal vecchio nome**: questo pacchetto nasce dalla rinomina di `dsh-session-search-toggle`; l'id di registrazione client, l'id di patch cordis e l'URL del repository sono stati rinominati con esso. GitHub conserva i redirect per i repository rinominati, quindi il vecchio nome resta risolvibile — ma spostare la dipendenza del profilo al nuovo nome, invece di lasciare i due nomi coesistere a lungo:

```sh
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master
dsh plugin --profile web remove dsh-session-search-toggle
dsh web   # riavvio
```

Il namespace delle impostazioni resta `switch-search` (**chiave di memorizzazione stabile, nessuna migrazione**), quindi la configurazione esistente continua a funzionare con il nuovo pacchetto.

## Cosa sa fare

- **Doppia modalità titolo ↔ contenuto**: una voce, due modi di cercare — «Titolo» filtra in tempo reale per sottostringa del titolo di sessione / directory di lavoro; «Contenuto» interroga **l'indice indipendente costruito da questo plugin** nel corpo dei messaggi di sessione.
- **Contenuto aggregato per sessione**: ogni risultato della ricerca per contenuto occupa una riga per sessione (titolo di sessione + frammento più rilevante + etichetta di tipo); un clic apre la sessione, senza intasare lo schermo messaggio per messaggio.
- **Filtro per tipo di contenuto**: chip di filtro in cima alla modalità contenuto — **Tutto / Utente / Risposta / Tool**; `Tool` apre agli risultati gli eventi `tool/call` e `tool/result`, per cercare direttamente argomenti e valori di ritorno delle chiamate ai tool.
- **Ordinamento dei risultati**: **Rilevanza / Data** a destra della stessa riga — «Data» ordina per **ultima attività della sessione**, le sessioni toccate più di recente prima; la preferenza è memorizzata localmente e sopravvive ai ricaricamenti. Ogni risultato trasmette insieme l'ora del documento e quella della sessione, quindi il front-end può riordinare da sé.
- **Titoli in tempo reale**: l'host si iscrive a `session/event`; una rinomina (`session/title`) si ripiega nell'indice all'istante, senza aspettare il prossimo giro di sincronizzazione (30 s per impostazione predefinita).
- **Scheda delle impostazioni**: Impostazioni → Plugins guadagna una scheda **«Indice di ricerca»** — interruttore di attivazione, modalità di ricerca predefinita, regolazioni di sincronizzazione / ritenzione / directory dell'indice indipendente, e il blocco del ciclo di vita dell'indice (stato, riorganizzazione non distruttiva, export/import di snapshot). Quando segnala «N sessioni archiviate escluse», **indica sul posto chi ne risponde**: la consultazione e la pulizia delle sessioni archiviate spettano allo **«steward delle sessioni»** (`dsh-session-steward`), mentre questo plugin si limita a leggere l'insieme di archivio; se non è installato, il messaggio lo dice esplicitamente («attualmente non installato») — il giudizio spetta all'host, che lo risolve dal **grafo di moduli del plugin stesso**, e se non se ne ricava un risultato vale il testo neutro: **mai riportare «non leggibile» come «non installato»**.
- **Tasto di invocazione e suggerimenti tastiera per piattaforma**: sia la voce della barra laterale sia la barra dei tasti in fondo al pannello mostrano il tasto di invocazione — `⌘K` su macOS, `Ctrl K` su Windows/Linux, deciso in base al sistema in esecuzione; anche il tasto di chiusura del pannello segue la piattaforma (`esc` su macOS, `Esc` altrove). Il rilevamento scende a cascata **UA-CH → `navigator.platform` → stringa UA**, quindi una modalità privata non degrada mai un utente Mac ai simboli Windows. **Suggerimento e binding dalla stessa sorgente**: l'accordo scritto sulla pastiglia è esattamente quello che il gestore `keydown` riconosce — mai «un tasto promesso, un altro intercettato».
- **Salto diretto al clic**: fare clic su un risultato apre la sessione corrispondente, posizionandosi sul contesto in cui si trova l'occorrenza.

## Anteprima dell'interfaccia

Disposizione della voce di ricerca nella barra laterale e del pannello di ricerca:

![Voce di ricerca nella barra laterale](assets/content-search-example.png)
![Pannello di ricerca](assets/new-index.png)

## L'indice indipendente: tre meccanismi

La modalità contenuto **costruisce il proprio database**, senza dipendere dall'indice full-text ufficiale `session-query-sqlite` di DSH. L'indice vive in `src/host/`: `schema.ts` crea le tabelle (comprese la tabella FTS5 propria `docs_fts`), `engine.ts` esegue le query e `extract.ts` estrae il testo ricercabile dagli eventi di sessione (compresi nome e argomenti del tool per `tool/call`, e il testo del risultato per `tool/result` — la base di dati del «filtro per tool»). Il `sessionQuery` di DSH serve solo da **lettore di corpus** (`listSessions` / `readSession`), mai come motore di ricerca.

### 1. Un indice indipendente del contenuto delle sessioni

L'indice è il **file SQLite di questo plugin**, senza alcuna interferenza con l'indice ufficiale. Directory di persistenza configurabile, export/import via snapshot, ricostruzione completa possibile. All'attivazione dell'host la directory dell'indice viene ispezionata: un `index.building.sqlite` incompleto quando esiste un indice attivo viene giudicato «la precedente ricostruzione non è mai finita» e semplicemente scartato; se manca l'indice attivo, il verdetto è «il crash è caduto nella finestra di rinomina» e l'archivio più recente viene ripristinato come attivo.

### 2. Le sessioni fuori uso vengono ripulite secondo l'archivio, con aggiornamento continuo

`archive-source.ts` legge `global.archivedSessionIds` dall'hub di archiviazione ufficiale `~/.dsh/storages/workspace.json` e tiene **le sessioni archiviate (quindi inutilizzabili) fuori dall'indice**. L'insieme di archivio ha un solo scrittore — lo steward; questo pacchetto si limita a leggerlo.

La sincronizzazione è **a rotazione**: `SwitchWatermarkSync` in `sync.ts` mantiene un filigrana `version` per sessione e ad ogni giro confronta solo le differenze e reingloba solo le sessioni cambiate — mai una ricostruzione totale. I file dell'indice stessi sono conservati in numero limitato secondo `archiveKeep`, i più vecchi eliminati automaticamente.

### 3. La riorganizzazione non disturba mai l'indice in servizio

La riorganizzazione passa per un **indice ombra**: `rebuild.ts` costruisce `index.building.sqlite` da zero accanto all'indice attivo e per tutta la costruzione **l'indice attivo continua a servire le ricerche** — le query non vengono mai bloccate. A fine lavori la commutazione sono tre `rename` sincroni (active → archive, shadow → active): un'unica finestra atomica.

Da qui la semantica dei guasti: **ombra presente + attivo presente = costruzione non finita**; l'ombra allora è un rifiuto, scartata senza cerimonia — l'indice attivo non è mai stato a rischio.

## Installazione

```sh
# Opzione 1: installazione diretta da GitHub (consigliata) — lib/ è committato, niente build locale necessaria
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master

# Opzione 2: assemblaggio da percorso locale / sorgenti (vedi la sezione «Sviluppo»)

# Riavviare dsh web — obbligatorio! Un'istanza in esecuzione non ricarica a caldo il livello bundle
dsh web
```

Dopo l'installazione compare in fondo alla barra laterale un pulsante **«Ricerca»**; Impostazioni → Plugins guadagna la scheda **«Indice di ricerca»**.

> ⚠️ **Raggiungibilità di GitHub**: l'installazione via github: presuppone che github.com sia raggiungibile; su una rete con restrizioni, configurare prima un proxy o un mirror funzionante, altrimenti `add` resterà bloccato in fase di recupero.

## Sviluppo

```sh
pnpm install            # include la catena di pacchetti client @deepseek-ai + tsdown/tsc
pnpm typecheck          # tsc --noEmit
pnpm build              # tsc(lib/types) + tsdown(lib/index.mjs + lib/client.js)
```

### Struttura dei sorgenti

```
src/
├── index.ts            # metà host (node): schema Config + installSettingsSection + rotte
├── config.ts           # configurazione pura condivisa (enabled/defaultMode + costante di namespace, niente schemastery per il client)
├── host/               # l'indice indipendente (lato host)
│   ├── schema.ts       # tabelle: docs / docs_fts(FTS5) / sessions / filigrane
│   ├── engine.ts       # query
│   ├── extract.ts      # estrae il testo ricercabile dagli eventi di sessione (tool/call e tool/result inclusi)
│   ├── sync.ts         # SwitchWatermarkSync: sincronizzazione incrementale a rotazione per filigrana di version
│   ├── rebuild.ts      # costruzione ombra + commutazione atomica + ispezione di ripresa dopo crash
│   ├── archive-source.ts  # legge l'insieme di archivio per escludere dall'indice le sessioni archiviate
│   └── snapshot.ts     # export/import di snapshot
└── client/
    └── index.ts        # metà browser: voce sidebar.footer.action + pannello flottante + riga settings.general.item
```

- **Metà host**: registra la rotta HTTP recintata `/switch-search/api` (`list-sessions` / `content-search` / `search-status`), con una barriera di fiducia del browser identica al gateway `/api` di DSH (Host in loopback o trustedHosts; cross-site rifiutato).
- **Schema di configurazione**: l'host registra il namespace `switch-search` tramite il servizio `settings` + un `Config` schemastery; la metà client lo legge e lo scrive in mirror con un posto store locale + `settingsScope.bind`; il modulo puro condiviso `src/config.ts` tiene il bundle client esente da schemastery.
- **Catena di build**: tsdown riproduce la semantica di `packages/client/tsdown.client.ts` del harness (banner `__ModuleLoader__.load`, tabella di externals per piattaforma, guardia di purezza del bundle).
- **lib/ committato nel repository**: le installazioni da GitHub girano con l'artefatto di build già committato (dsh non esegue `prepare` per un'installazione da git); `.gitignore` non esclude `lib/`.

## Rapporto con la ricerca ufficiale della barra laterale

- La casella di ricerca ufficiale vive in `sidebar.workspaces` (slot unico), che un plugin esterno **non può sostituire**; questo plugin **aggiunge una voce distinta** in fondo alla barra laterale via `sidebar.footer.action` — le due coesistono senza disturbarsi.
- La ricerca per contenuto ufficiale è cablata nell'apiproxy e copre solo `user/message` + `assistant/message`; questo plugin interroga il proprio indice e apre `tool/call` + `tool/result`, per una ricerca a livello di tool.

## Compatibilità e riservatezza

- Presuppone DeepSeek Harness installato con il profilo web; **nessun codice ufficiale viene modificato**. L'indice è il file proprio di questo plugin: che il `session-query-sqlite` ufficiale sia attivo o no non ha alcuna conseguenza.
- La configurazione vive solo nel namespace settings di DSH e nello stato del pannello nel browser; nulla viene letto o caricato oltre i dati di ricerca delle sessioni.
- I tipi di contratto host/client sono dichiarati strutturalmente in `src/*.ts` (la catena dei pacchetti client dsh su npm è incompleta) e verificati contro i sorgenti del harness al momento della build.

## La famiglia di plugin DSH di drscrewdriver

Questo progetto fa parte della serie di plugin DSH mantenuta da [drscrewdriver](https://github.com/drscrewdriver). Se questo ti è utile, probabilmente lo saranno anche gli altri:

| Plugin | In una riga |
|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | Coda di input nei picchi di carico del DSH Web GUI: regolazione del traffico a tre livelli, riordino con trascinamento, congelamento delle sessioni |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | Controllo del reasoning_effort turno per turno: pianificazione Auto intelligente o livello fisso manuale |
| [dsh-seatbelt-sandbox](https://github.com/drscrewdriver/dsh-seatbelt-sandbox) | Adattatore sandbox macOS Seatbelt: loader nativo libsandbox, successore del deprecato sandbox-exec |
| [dsh-prime-memory](https://github.com/drscrewdriver/dsh-prime-memory) | Memoria distillata a strati: distillazione automatica L0~L3, iniezione del richiamo prima di ogni passo del modello |
| **[dsh-search-index](https://github.com/drscrewdriver/dsh-search-index)** | Ricerca delle sessioni nella barra laterale: commutazione titolo/contenuto, filtro per utente/risposta/tool |

## License

MIT
