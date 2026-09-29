# Changelog

Tutte le modifiche importanti e le correzioni di bug sono registrate qui. Le versioni seguono la versionazione semantica (installazione: `dsh plugin --profile web add github:drscrewdriver/dsh-search-index`).

## 0.6.0 — Adattamento a DSH 0.2.0-rc.1 (passaggio di generazione dei metadati senza alcuna modifica al codice)

- **Passaggio di generazione di peer/engines**: i 4 peer dsh-* (`dsh-client-locale` / `dsh-client-ui-settings` / `dsh-client-ui-settings-general` / `dsh-client-ui-slots`) e le due occorrenze di `engines.dsh` in `package.json` e `dsh.plugin.json` sono sostituiti insieme con `>=0.2.0-rc.1 <0.2.1-0` (finestra rc bloccata, rivalutazione da 0.2.1 in poi).
- **Zero modifiche al codice**: la superficie di consumo del plugin verso l'host è un puro caller (letture morbide via `ctx.get('slots'/'locale'/'configForms')` + interfacce strutturali locali); 0.2.0 rispetto a 0.1.7 non ha toccato né i contratti slots/settings né il registro dei posti.
- **Passaggio di generazione delle devDependencies**: la devDep `dsh-client-ui-slots` passa da `^0.1.0-rc.6` a `0.2.0-rc.1` (allineamento al nuovo optional peer, per evitare alberi di installazione disaccoppiati); la devDep `@deepseek-ai/cordis` passa da `^4.0.1` a `^4.0.4` (la famiglia di pacchetti 0.2.0-rc.1 richiede `~4.0.4`).
- **Gestione delle dipendenze**: il gestore di pacchetti facente fede in questo repository è pnpm (`pnpm-workspace.yaml` + pnpm-lock v9); `pnpm-lock.yaml` è rigenerato e il vecchio `package-lock.json` (fermo all'era 0.5.0) è rimosso.
- **Documentazione**: matrice di compatibilità e frase della linea principale dei README (zh/en) aggiornate a 0.2.0; la linea DSH 0.1.7 continua a essere servita da 0.5.7 (dist-tag `dsh-0.1.7`, ramo `compat/0.1.7`).

> Nota: le versioni tra 0.2.0-beta.5 e 0.5.7 sono a carico della linea DSH 0.1.x; si veda il ramo `compat/0.1.7` e il dist-tag npm `dsh-0.1.7`.

## 0.2.0-beta.5 — Nella colonna stretta la «tastiera» cede il posto e i nomi delle due voci si leggono per intero

### Correzioni (messe in luce dai test reali di beta.4)
- **Sintomo**: da quando beta.4 ha fatto cessare l'occupazione esclusiva della riga da parte di questa voce, la riga `sidebar.footer.action` deve contenere insieme
  «🔍 Ricerca Ctrl K» e «🧭 Steward delle sessioni». A misura reale, la larghezza naturale delle due stringhe somma **240px**,
  e la colonna stretta (circa 215–225px) non la contiene: questo plugin è in `flex:1`, il wrapper dello steward in `flex:none` (che non cede mai),
  così **tutto il disavanzo grava sulla pastiglia di ricerca**, la cui etichetta è l'unico elemento riducibile — è stata schiacciata fino a un solo «搜».
- **Chi deve cedere**: la tastiera è un **promemoria** (il tooltip della voce e la barra in fondo al pannello ripetono entrambi lo stesso accordo),
  l'etichetta è l'**identità** della voce. Quindi cede la tastiera: `.dsws_root` dichiara `container-type:inline-size`,
  e sotto i 132px di propria larghezza ripiega `.dsws_kbd` via `@container` (43px risparmiati).
- **Misurato sul reale (Chrome, una sonda replica il CSS e il DOM veri delle due voci)**: con colonna da 180–230px l'etichetta resta completa 28/28, la tastiera si nasconde da sola,
  zero fuoriuscite per entrambe le voci; da 240px la tastiera torna visibile. La baseline pre-modifica mostrava solo 12/28 dell'etichetta a 220px.
- **La forma rail va esentata**: `container-type` porta con sé anche il containment di dimensione inline-size, che fa **collassare a larghezza 0** la radice del rail in `flex:none`
  (verificato sul reale: root=0 mentre il pulsante resta a 36px, fuoriuscendo dalla casella). Per questo `.dsws_rootRail` torna esplicitamente a `container-type:normal`.
- **Il rail torna a 28×28**: la casella di contenuto del rail fa solo 36px (rail di 56px − 2×10px di padding); la casella di controllo ufficiale da 36×36
  presuppone **un solo controllo per riga**; con le due voci sulla stessa riga, 36+28=64px fuoriescono di 14px. Si prende 28+28=56px,
  appena più stretto dei 32+28=60px pre-modifica.
- Padding della tastiera `0 5px` → `0 4px` (i 2px a proprio carico).

## 0.2.0-beta.4 — La voce della barra laterale si adatta a condividere la riga con lo «steward delle sessioni»

### Modifiche
- **Cedere il posto, non occupare tutto**: `.dsws_root` era originariamente `flex:none;width:100%` e occupava l'intera riga nella flex-riga `sidebar.footer.action`,
  spingendo la voce vicina dello steward a fine riga, con la pastiglia da 42px per giunta disallineata rispetto al pulsante-icona di fronte. Passaggio a `flex:1 1 auto;min-width:0`, pulsante `flex:1;min-width:0` —
  isomorfo al controllo ufficiale dello stesso posto (`.trigger{flex:1;min-width:0;height:42px;border-radius:12px;padding:0 10px 0 8px}` di `ui-settings-general`).
  Senza spazio, ad abbreviarsi per primo è l'etichetta (`.dsws_buttonLabel` ha già l'ellipsis), senza più schiacciare i vicini.
- **Rail ripiegato allineato al 36×36 ufficiale**: con `wide=false` il pulsante passa a `.dsws_buttonRail` (`36×36`, `border-radius:50%`),
  l'elemento radice guadagna `.dsws_rootRail` e resta `flex:none`; allineamento alla specifica rail di Figma (rail 56px / padding 10px / casella di controllo 36×36).
- **Contenuto allineato a sinistra**: tolto `justify-content:center`, l'icona si allinea alla stessa colonna della riga ufficiale «Impostazioni» subito sotto.

### Non toccato
- Interazione, pannello, indice, rotte, namespace delle impostazioni `switch-search`: nulla è stato toccato; con `enabled` spento, l'intera voce (incluse `⌘K` / `Ctrl K`) scompare come prima in un colpo solo.
- La cooperazione avviene solo nel CSS rispettivo dei due plugin: questo non riferisce alcun valore dello steward e non presume né la sua presenza né la sua assenza.
- I nuovi selettori sono tutti referenziati nel codice; il «zero classi orfane» di `tests/client-styles.test.mjs` continua a valere.

## 0.2.0-beta.1 — Rinomina in dsh-search-index, la cronologia delle sessioni passa allo steward

### Modifiche incompatibili

- **Rinomina del pacchetto**: `dsh-session-search-toggle` → **`dsh-search-index`** (id di registrazione client, id di patch cordis e indirizzo del repository rinominati insieme). Il namespace delle impostazioni **rimane `switch-search`**: è una chiave di memorizzazione, cambiarla perderebbe la configurazione degli utenti — si sceglie deliberatamente di non farla seguire al nome del prodotto. Il vecchio nome resta risolvibile tramite il redirect di GitHub, ma portare la dipendenza del profilo al nuovo nome, invece di lasciare convivere i due nomi.
- **Trasferimento del dominio della cronologia delle sessioni** (navigazione dell'archivio + pulizia dell'archivio, compresa la voce «sessioni archiviate» della barra laterale e il «vedi archivio» nella scheda impostazioni) → alla scheda «Sala delle cartelle» del nuovo pacchetto **`dsh-session-steward` (steward delle sessioni)**.
- **Questo pacchetto non scrive più l'insieme di archivio**: `pruneArchiveFile` e i due metodi `list-archived` / `archive-prune` sono usciti insieme a lui. Continua a **leggere** l'insieme di archivio ufficiale (`readArchiveSet`) per escludere dall'indice le sessioni archiviate — l'insieme di archivio ha un solo scrittore: lo steward. Il contratto del formato di file è descritto in `dsh-归档文件格式契约-20260914.md`.
- **Pietra tombale esplicita sui vecchi nomi di metodo**: `list-archived` / `archive-prune` ora rispondono **HTTP 410** con un errore chiaro che punta a `/session-steward/api/session-history-list|prune`. Il refresh del browser non ricarica la metà host; il vecchio bundle client deve **fallire a gran voce e sapere dove andare**, invece di ricevere un 404 silenzioso da leggersi come «l'archivio è rotto».

### Rimozioni

- `src/client/archive-panel.tsx` (trasferito allo steward), la funzione di scrittura `pruneArchiveFile` di `src/host/archive-source.ts`, la voce d'archivio nella scheda impostazioni e la superficie di iniezione `openSession` di `IndexBlock`, oltre alle chiavi di testo interessate.
- Il caso d'uso prune è migrato con l'implementazione: la copertura segue l'**implementazione**, ed è stata ricostruita lato steward in `tests/history.spec.ts` (8 casi), per evitare un vuoto in cui «nessuno dei due pacchetti testa».

### Conservati

- Tutte le capacità dell'indice indipendente: sincronizzazione incrementale, riorganizzazione non distruttiva (shadow + commutazione atomica + archiviazione limitata `archiveKeep`), export/import di snapshot, ispezione di recupero dell'indice, esplicitazione dei fallimenti di lettura dello stato. `archiveKeep` indica il numero di copie di **file dell'indice** da conservare, non c'entra con l'archiviazione delle sessioni; resta dunque in questo pacchetto.

## 0.2.0-beta.3 — Il contatore d'archivio ora indica la strada, l'interruttore di attivazione funziona davvero, 13 selettori orfani eliminati

### Correzione: il contatore `sessioni archiviate` era un numero senza nessuno che se ne occupasse — ora indica la strada

- **Sintomo**: una pastiglia nella scheda impostazioni riportava «sessioni archiviate: 72», che questo plugin **non può gestire** (navigazione e pulizia dell'archivio sono migrate allo steward). L'utente vedeva un numero e non poteva cliccare niente — da leggersi come una funzione rotta.
- **Rimedio**: il testo della pastiglia passa da `sessioni archiviate {n}` a **`{n} sessione/i archiviata/e escluse dall'indice`** (precisa che è la **quantità esclusa dall'indice**, non una lista di cose da fare), con sotto una frase di appartenenza — chi gestisce cosa, e che cosa fa questo plugin.
- **Indicare solo la strada giusta**: l'host guadagna `src/host/peers.ts`, che risolve `dsh-session-steward` dal **grafo di moduli del plugin stesso** (cioè i `node_modules` del profilo). Tre stati `installed` / `missing` / `unknown`: «attualmente non installato» appare **solo se la risoluzione fallisce con certezza** — dire a un utente di installare un plugin che ha già è peggio che tacere; gli altri errori del risolutore (manifest corrotto ecc.) vanno tutti in `unknown`, con testo neutro.
- La base di risoluzione di `probePeer(name, base?)` è iniettabile, quindi il ramo «presente ma illeggibile» è riproducibile in test (con un fixture `package.json` corrotto, puntato tramite la base iniettata).

### Correzione: `attiva ricerca sessioni` era un interruttore morto — ora funziona davvero

- **Sintomo**: `enabled` aveva un tipo, un valore predefinito, un interruttore, un testo («mostra la voce «Ricerca» in fondo alla barra laterale»), ma **nemmeno un secondo consumatore in tutto il repository**: la voce si registrava incondizionatamente e l'interruttore non comandava nulla.
- **Rimedio**: il binding del namespace impostazioni si risolve **una sola volta** (`entryScope`), e voce e scheda impostazioni **condividono lo stesso** binding; la voce si iscrive via `useSyncExternalStore` e legge `enabled` — spento, l'intera voce (tasto di invocazione `⌘K` / `Ctrl K` compreso) scompare in blocco: «questo plugin è attivo?» ha sempre una sola risposta.
- Quando le impostazioni sono illeggibili (niente `settingsScope`, stato illeggibile) **la voce resta visibile**: non leggere la scelta dell'utente non vale richiesta di chiusura; e nascondere la voce è anche nascondere «l'unico percorso di ritorno al pannello».

### Pulizia: 13 selettori orfani (di cui 10 dal pannello d'archivio già partito)

- Al trasloco del pannello d'archivio verso lo steward, i selettori erano rimasti al loro posto e continuavano a essere impacchettati: `dsws_archRow` / `dsws_archCheck` / `dsws_uuid` / `dsws_dialogHead` / `dsws_dialogTitle` / `dsws_dangerBtn` / `dsws_editActive` / `dsws_linkBtn` / `dsws_indexLine` / `dsws_setRoot`. Un foglio di stili pieno di stili «per un pannello che non esiste più» si legge come «questo plugin gestisce ancora quel angolo» — esattamente il malinteso che la scissione doveva seppellire.
- Altre 3 classi morte eliminate: `dsws_switch` / `dsws_switchTrack` / `dsws_switchThumb` — il `Toggle` è passato da tempo a stili puramente in linea, questi selettori di classe non sono mai stati referenziati.
- Il foglio di stili scende da 53 classi a 50, **zero orfane**.
- test: nuovo `tests/client-styles.test.mjs` — il foglio di stili può avere un solo proprietario; **ogni** classe deve essere referenziata nel codice, altrimenti fallisce (è precisamente la ragione per cui queste 13 classi sono rimaste nascoste finora). È also bloccato anche «il binding delle impostazioni ha un solo proprietario» (`bind()` esattamente una volta + almeno due consumi) — la linea di difesa strutturale contro l'interruttore morto.
- test: nuovo `tests/host-peers.test.mjs` (`node --import tsx`) che copre la classificazione a tre stati.
- **Confutato per contrasto**: reinserire una classe orfana → `client-styles` esce subito con `exit 1`; cambiare la rete di sicurezza di `probePeer` per restituire sempre `missing` → `host-peers` esce subito con `exit 1`; ripristinati entrambi, tutto torna verde.

## 0.2.0-beta.2 — Tasto di invocazione e suggerimenti tastiera per piattaforma; ordinamento risultati, titoli in tempo reale e una raffica di correzioni alla catena di ricerca

### Aggiunta: tasto di invocazione + suggerimenti tastiera per piattaforma (stile a pop-up ispirato a `@hyzyn/dsh-search`)

- **Un accordo invoca il pannello**: **`⌘K` (macOS) / `Ctrl K` (Windows/Linux)** da qualunque punto della barra laterale apre il pannello di ricerca, equivalente al clic sulla voce. Il binding pende dal componente della voce, non dal livello plugin — chiusa la voce, l'accordo sparisce con lei: «il plugin è attivo?» ha una sola risposta.
- **Suggerimenti per piattaforma**: sia a destra della voce nella barra laterale sia nella nuova barra tastiera in fondo al pannello è resa la pastiglia del tasto di invocazione; il tasto di chiusura è parimenti `esc` (macOS) / `Esc` (altrove). Finora il plugin non mostrava **nessun suggerimento di scorciatoia**: la voce si scopriva solo col mouse.
- **Riconoscimento piattaforma a tre gradi di ripiego**: `UA-CH (navigator.userAgentData.platform) → navigator.platform → stringa UA`. Copiando la sola verifica `navigator.platform` del plugin di riferimento, questa API restituisce una stringa vuota sotto certe configurazioni privacy, degradando silenziosamente un utente Mac al vocabolario Windows; ora una stringa vuota prosegue l'interrogazione a valle, e se nulla risponde si **ripiega su `Ctrl`/`Esc`** — `Ctrl` lo capisce chiunque, `⌘` no.
- **Suggerimento e binding dalla stessa sorgente**: l'accordo sulla pastiglia e quello effettivamente riconosciuto da `keydown` escono dal medesimo punto (`isInvokeChord` in `src/client/platform.ts`), chiedendosi a vicenda «l'altro tasto modificatore deve mancare» per distinguere le due piattaforme. Impossibile dunque il falso suggerimento senza reazione tipo «in fondo scritto `⌘K`, ma il gestore riconosce solo `Ctrl+K`».
- **Tastiera adattiva**: `.dsws_kbd` è reso con `min-width:18px; width:auto` — `Ctrl K`, `⌘K`, `Esc` si mostrano interi senza schiacciarsi; l'etichetta testuale della voce diventa riducibile in ellipsis, perché la tastiera non spinga l'etichetta fuori dal pulsante.
- test: nuovo `tests/client-platform.test.mjs` (`node --import tsx`, test diretti delle funzioni pure di `src/client/platform.ts`: ripiego a tre gradi con stringa vuota in modalità privacy, quattro inventari di vocaboli, tabella di verità degli accordi, e la coerenza tra metà «il tasto annunciato da ciascuna piattaforma deve essere accettato dal gestore»; più bloccaggi strutturali sull'**artefatto** — il grado UA-CH ha un solo proprietario, `isInvokeChord` referenziato almeno due volte (definizione + ascoltatore), tre pastiglie-tasto, superfici d'accordo delle due piattaforme dalla stessa sorgente). **Confutato per contrasto**: sostituire `isInvokeChord(...)` nell'ascoltatore con un confronto letterale fa fallire subito le asserzioni d'artefatto.

### Affinamento: l'ombra del pannello flottante passa ai token ufficiali

- L'ombra del pannello era codificata fissa `0 8px 28px rgba(0,0,0,.16)`, ora diventa `var(--dsw-shadow-lv3, 0 8px 28px rgba(0,0,0,.16))` — lo stesso livello di ombra flottante dei `Menu` / `Modal` / `Toast` / `HoverCard` ufficiali, variabile col tema; il vecchio valore resta come ripiego `var()`, i vecchi host non regrediscono. Il raggio di 12px coincideva già con la scheda a discesa ufficiale (`r12` del `Menu`); il velo riprende `--dsw-alias-bg-mask-1` + `--dsw-mask-blur`, stessa sorgente del `Modal` ufficiale.

### Correzione: la ricerca per contenuto restava per sempre vuota — la chiave di richiesta aveva due proprietari

- **Sintomo**: la ricerca per contenuto otteneva i risultati giusti, ma l'interfaccia restava bloccata nello stato di caricamento, senza mostrare nulla. Lato host, sul reale era impeccabile — `content-search` restituiva occorrenze sia per il cinese (`插件`, `适配`) sia per l'ASCII (`dsh`); né indice né tokenizzazione avevano problemi.
- **Causa radice**: la chiave di richiesta era **scritta a mano in due esemplari**. L'effect che invia la richiesta assemblava una chiave a tre segmenti `query\0type\0sortBy`, il rendering per giudicare «questo risultato appartiene all'input corrente?» ne assemblava una a due segmenti `query\0type`. La versione che aggiungeva l'ordinamento ha toccato solo il lato scrittura: le due chiavi non coincideranno mai, e `activeContent` ricadeva a ogni giro nel ramo vuoto `loading` — i risultati arrivavano, si analizzavano, poi venivano buttati.
- **Rimedio**: la chiave converge a un **unico proprietario** — un `contentRequestKey(normalized, contentType, sortBy)` condiviso dai due lati. Non è stata scelta la strada di «recuperare il segmento mancante sul secondo esemplare»: resterebbero due proprietari, e la prossima dimensione d'input rifarebbe derivare il tutto.
- **Anti-regressione**: nuovo `tests/client-panel-key.test.mjs`. Il percorso di rendering React non rientra in questa copertura (`client-store.test.mjs` dichiara in apertura di non coprire la GUI), quindi si bloccano invarianti strutturali — nell'artefatto ci dev'essere **esattamente un** template literal con separatore NUL, e l'helper condiviso dev'essere referenziato almeno 3 volte (definizione + due punti di chiamata). L'asserzione è stata provata: riscrivere la seconda chiave nell'artefatto la fa fallire, poi si è ripristinato.

### Aggiunta: ordinamento risultati (rilevanza / data) + titoli rinominati registrati nell'indice in tempo reale

- **Commutatore d'ordinamento**: sopra i risultati della ricerca per contenuto un nuovo commutatore «Rilevanza / Data», sulla stessa riga del filtro per tipo, allineato a destra. «Rilevanza» predefinito conserva il comportamento esistente; «Data» ordina in decrescente per **ultima attività della sessione**, a parità di tempo per forza di corrispondenza.
- **Due campi temporali, ognuno al suo mestiere**: ogni occorrenza consegna insieme `time` (marcatura temporale del **documento** meglio accoppiato) e `updatedAt` (orologio a livello **sessione**). L'ordinamento usa la seconda — l'ora del documento toccato non dice se la sessione è stata mossa di recente. Entrambi i campi sono forniti; il front-end può riordinare da sé.
- **Ordinare prima del troncamento**: l'host ordina prima e tronca poi su `limit`. Troncare prima per ordinare poi farebbe sì che la modalità «Data» rimescolasse solo il top N già tagliato per rilevanza — come non ordinare affatto.
- **Scelta persistente**: la preferenza d'ordinamento vive nel `localStorage` (chiave `dsh-search-index.sortBy`) e sopravvive ai ricaricamenti; in modalità privacy il fallimento di lettura/scrittura ricade in silenzio sulla rilevanza.
- **Compatibilità con la metà host invecchiata**: un host che non conosce `sortBy` ricade sulla rilevanza invece di fallire; il client riordina localmente solo se ogni occorrenza porta un `updatedAt` numerico, per non calcolare NaN su dati vecchi.
- **L'ora arriva nelle righe di contenuto**: la riga d'intestazione dei risultati di contenuto mostrava solo l'etichetta di tipo, l'ora appariva solo nei risultati della ricerca per titolo. Ordinare per «Data» senza vedere alcuna data rende l'ordinamento inverificabile. Ora a destra dell'etichetta di tipo compare la **ultima attività della sessione** (`updatedAt`) — il campo usato dall'ordinamento, e la stessa ora vista nella riga d'intestazione.
- **Titoli in tempo reale**: una rinomina aggiunge un evento `session/title` log-only (senza toccare la faccia del modello). Finora bisognava attendere il prossimo giro di sincronizzazione a filigrana (30 s predefiniti) perché l'indice lo riflettesse; ora l'host si iscrive a `session/event` e, all'occorrenza, ripiega il titolo mirato per id (`SwitchWatermarkSync.refreshTitles`), senza aspettare la scansione intera. Gli eventi sono fusi a raffiche di 250 ms; con `autoSync: false` non interviene; **la filigrana non si muove** — un aggiornamento di titolo non farà mai vantare all'indice di aver letto ciò che non ha letto; il giro successivo reingerisce la sessione sulla versione bumpata.
- test: l'ordinamento `sortBy=time` usa deliberatamente campioni rovesciati «vecchio ma molto rilevante / nuovo ma poco rilevante» (altrimenti l'asserzione potrebbe valere solo per caso), e copre ordinare-prima-di-troncare e ripiego su ordinamento sconosciuto; `refreshTitles` copre ripiego immediato, nessuna rilettura del log, filigrana intatta, idempotenza sugli id sconosciuti, convergenza al giro successivo. Serie completa 24/24.

### Correzione: ispezione e recupero dei semilavorati dopo interruzione anomala della ricostruzione

- All'attivazione dell'host (prima dell'apertura del motore) la directory dell'indice viene ispezionata automaticamente: un `index.building.sqlite` incompleto — se esiste active è giudicato «l'ultima ricostruzione non è mai finita» e gettato (con -wal/-shm; active non è mai stato in pericolo); se manca active è giudicato «il crash è caduto nella finestra di rinomina», si **ripristina il più recente degli archivi come active** e poi si butta il semilavorato; né active né archivio, si riparte da zero. Log `[switch-search] index recovery` dall'inizio alla fine.
- Il fallimento di lettura dello stato è ora esplicito (pastiglia d'errore + pulsante riprova); finita l'eterna «lettura dello stato dell'indice…».
- test: 2 casi sul percorso di recupero (getto del semilavorato / ripristino dalla finestra di rinomina), serie completa 18/18.

### Interazione: la pulizia dell'archivio converge in una modalità modifica

- Il pannello d'archivio è in sola lettura per impostazione predefinita; un pulsante «Modifica» in testa passa allo stato di modifica — caselle di controllo, seleziona tutto e il rosso «Elimina selezione (N)» compaiono solo in modalità modifica; «Fatto» ne esce e svuota la selezione.
- Il pulsante elimina segue comunque il flusso completo di conferma (confirm JS: riepilogo degli id + avvertenze backup/riavvio/irrevocabilità) → `archive-prune` → revoca immediata della marcatura di cancellazione morbida nell'indice → aggiornamento della lista e permanenza in modalità modifica per continuare la pulizia.

### Aggiunta: pulizia in massa dell'archivio (pannello di gestione)

- Il pannello d'archivio guadagna una modalità di gestione di massa: seleziona tutto/spunta sessioni archiviate → **conferma con confirm JS** (elenca il riepilogo degli id da rimuovere) → l'API `archive-prune` rimuove in massa gli id dall'array `global.archivedSessionIds` dell'archivio canonico `~/.dsh/storages/workspace.json`.
- La scrittura segue il protocollo ufficiale storage-json: **prima il backup (workspace.json.bak-<ts>) poi la sostituzione atomica** (file temporaneo nella stessa directory + rename), serializzazione identica all'ufficiale (2 spazi + newline finale); tetto di 5000 id per operazione.
- Dopo la rimozione, l'indice del plugin **revoca subito la marcatura di cancellazione morbida** (version=-1; il prossimo giro a filigrana reingerisce le sessioni ancora presenti); lo stato in memoria del DSH in esecuzione carica il nuovo array solo **dopo il riavvio** — pannello e log lo segnalano chiaramente.
- test: backup del prune / scrittura atomica / nessun residuo / idempotenza id sconosciuti, serie completa 17/17.

### Affinamento: osservabilità della ricostruzione + accelerazione con transazioni a lotti + driver better-sqlite3 opzionale

- **Condotta della progressione corretta**: l'avanzamento della riorganizzazione veniva riferito solo a fine lavori (il pannello restava su «0/?»); passa a un sink di stato — index-status riflette done/total/fase in diretta.
- **Log di sviluppo** (prefisso `[switch-search]`, via logger cordis): identificazione del driver, righe di ritmo ogni 50 sessioni di ricostruzione (sess/s / eta / durata dei chunk), transizioni di fase, riepilogo dei giri di sincronizzazione (scanned/updated/skipped-archived/failures/duration) — dati per confrontare oggettivamente le velocità prima/dopo.
- **Checkpoint di transazioni a lotti**: la ricostruzione commette una transazione ogni 50 sessioni (fsync ammortizzato); i chunk falliti vengono rigiocati uno a uno, isolati; taratura PRAGMA (synchronous=NORMAL / temp_store=MEMORY / cache_size=64MB).
- **Doppio driver**: `better-sqlite3` entra in optionalDependencies (un fallimento di compilazione nativa non blocca l'installazione), caricato dinamicamente a runtime con ripiego su node:sqlite in sua assenza; motore e index-status annotano il driver corrente (campo `driver`) — installarlo o no gioca solo sulla velocità, non sulle funzioni.
- **Testo dell'ingresso di ricerca**: il pulsante in fondo «Titolo» → «Ricerca sessioni».
- test: nuovi test di sicurezza dell'annidamento delle transazioni a lotti + identificazione del driver, serie completa 16/16.

### Aggiunta: sincronizzazione della cancellazione morbida d'archivio + pannello di consultazione dell'archivio + allineamento allo stile DSH

- **Cancellazione morbida d'archivio (schema v4)**: ogni giro di sincronizzazione a filigrana legge `workspaceRegistry.archivedSessionIds` ufficiale (risoluzione pigra, ripiego automatico se il servizio manca); le sessioni archiviate portano una marcatura `archived` nell'indice — escluse da ricerca e lista sessioni, contenuto documento rimosso ma header (cache dei titoli) conservato; **la revoca dell'archiviazione reingerisce automaticamente il testo integrale** (version=-1 innesca la rilettura al giro successivo).
- **La riorganizzazione non copia più i contenuti archiviati**: ricostruzione / export-import di snapshot scrivono per una sessione archiviata solo la riga header, zero copie docs/fts.
- **Pannello di consultazione dell'archivio**: finestra flottante centrata in sola lettura che elenca l'insieme d'archivio ufficiale (titolo/ora/cwd), clic apre la sessione; due ingressi — «sessioni archiviate» in fondo al pannello di ricerca e «vedi archivio» nella scheda impostazioni (nuova API `list-archived`, fence invariato). Nessun endpoint unarchive ufficiale, il pannello non offre operazioni di ripristino.
- **Allineamento allo stile DSH** (alle metriche e ai token dei sorgenti ufficiali `SettingsRoot` / `ConnectionIndicator`): il pulsante del footer passa alle specifiche ufficiali del trigger (42px / raggio 12px / token hover); lo stato dell'indice adotta il linguaggio ufficiale delle pastiglie (colori semantici `--dsw-alias-state-warn/success/error-*`, animazione a puntini durante la sincronizzazione + arresto sotto `prefers-reduced-motion`); il velo della finestra flottante passa ai token mask del Modal (`--dsw-alias-bg-mask-1` + blur).
- test: nuovo `tests/index-archive.test.mjs` (5 casi: cancellazione morbida / ripristino con reingerimento / riga header / salto in ricostruzione / regole snapshot), serie completa 15/15.

### Affinamento: rifacimento della pipeline di ricerca (tokenizzazione / archiviazione / percorso di query)

- **Tokenizzazione a livello parola via Intl.Segmenter al posto del trigram**: il testo estratto è segmentato ai confini di parola ICU e entra in FTS5 unicode61; il lato query passa dalla stessa tokenizzazione. Il volume dell'indice scende dalle intere finestre di 3 caratteri del trigram a token a livello parola (ordine del 1/4 atteso); le query corte di 2 caratteri tornano da «scansione LIKE dell'intera tabella» a query di indice normali; gli input parziali colgono per prefisso dell'ultima parola (`*` finale, «正在搜» → 正在搜索); i frammenti a cavallo di più parole non colgono più per errore (precisione in crescita).
- **Contenuto esterno FTS5**: la tabella virtuale FTS passa al modo contenuto esterno `content='docs'` (colonna tokenizzata `index_text` + colonna `text` originale); l'indice invertito non duplica più il testo integrale, ancora circa la metà di archiviazione risparmiata; inserimenti/cancellazioni mantengono la coerenza via comando `docs_fts 'delete'`.
- **Percorso di query alleggerito**: i rowid della sottoquery MATCH limitata per rank si allineano direttamente a `docs.doc_id`; una sola istruzione basta per ricerca + filtro per tipo/superficie, eliminando la seconda query `IN (...)` da 5000 parametri a ogni battuta.
- Indice schema v3: il vecchio indice è azzerato all'apertura; la sincronizzazione a filigrana lo reingerisce automaticamente al prossimo sondaggio, senza riorganizzazione manuale.
- test: nuove regressioni semantiche di tokenizzazione (query corte / prefisso / precisione), 7/7.

### Rifacimento: scheda impostazioni indipendente (modo thinking-levels)

- **Scheda indipendente `settings.plugin.item`**: il plugin guadagna la propria scheda impostazioni (doppia registrazione `id`+`key`, compatibile sia con lo slot per chiave del CLI dsh sia con lo slot list del DSH Desktop), in sostituzione della vecchia riga generica `settings.general.item` e del suo posto store locale. La scheda si lega al namespace impostazioni `switch-search`, si iscrive via `useSyncExternalStore` e commette al volo con `scope.set` (senza modulo di stazionamento).
- **Pannello sotto-impostazioni unificato**: interruttore di attivazione, modalità di ricerca predefinita, interruttore di sincronizzazione automatica, intervallo di sincronizzazione, numero di archivi conservati, e la zona di gestione dell'indice di ricerca per contenuto (stato, pulsante di riorganizzazione dell'indice, export/import di snapshot) — tutto converge nella stessa scheda.
- **Dizionari di locale**: nuovi dizionari zh/en `switch-search` (`src/client/locales.ts`); se il servizio locale manca nei vecchi DSH si ripiega sui testi zh incorporati, e senza settingsScope la scheda si degrada in sola lettura su DEFAULT_CONFIG, senza crash.
- **Suddivisione del client**: le chiamate all'host e i tipi condivisi da pannello/scheda convergono in `src/client/host-api.ts`; il `dsh.client.inject` di `package.json` guadagna `@deepseek-ai/dsh-client-locale` e `@deepseek-ai/dsh-client-ui-settings`.
- **Test**: `tests/client-store.test.mjs` riscritto per dimostrare il nuovo posto della scheda (binding di namespace, assenza di posto store, degrado senza settingsScope), 3/3.

### Aggiunta: motore di indice full-text indipendente (basta dipendere dall'indice FTS5 ufficiale di DSH)

- **File d'indice proprio**: la ricerca per contenuto passa all'indice costruito dal plugin (node:sqlite FTS5 + tokenizzazione trigram, application id indipendente `0x53574954`), conservato in `~/.dsh-switch-search/` (sovrascrivibile con la configurazione `indexDir` o la variabile d'ambiente `DSH_SWITCH_SEARCH_DIR`). Con il `session-query-sqlite` ufficiale sul suo `openAt: never` predefinito, la ricerca per contenuto resta pienamente disponibile; il file d'indice ufficiale non è mai aperto, nessuna reciproca interferenza.
- **Sincronizzazione incrementale a filigrana**: in secondo piano, la filigrana `version` delle sessioni è confrontata ogni `syncIntervalMs` (30 s predefiniti) e solo per le sessioni nuove/modificate `readSession` le immette in modo incrementale; la semantica di estrazione testuale è allineata a `extractSessionEventText` ufficiale (user/reply/tool/todo/turn-end), con replica del ripiego di superficie (i vecchi messaggi sostituiti per modifica sono marcati shadowed e esclusi dalla ricerca).
- **Riorganizzazione non distruttiva (ricostruzione)**: pannello/impostazioni possono innescare «riorganizza indice» — costruzione completa del file shadow, il vecchio indice resta interrogabile nel frattempo; a fine lavori commutazione atomica in tre `rename`, il vecchio indice è archiviato come `index.archive-<ts>.sqlite` (conservate `archiveKeep` copie, 2 predefinite).
- **Interfaccia di migrazione a snapshot JSON**: `index-export` esporta uno snapshot JSON Lines (una riga per sessione, documenti estratti inclusi), `index-import` importa lo snapshot e lo commuta atomicamente lungo lo stesso percorso di riorganizzazione — sincronizzato lo snapshot, fa da indice, permettendo trasloco tra macchine e backup a freddo.
- **API HTTP**: `/switch-search/api` guadagna `index-status` / `index-rebuild` / `index-export` / `index-import`; `list-sessions` ripiega sulla lettura dell'indice quando sessionQuery non è disponibile; il fence originale è mantenuto ovunque.
- **Client**: il pannello contenuto offre un ingresso «costruisci l'indice» quando l'indice manca e mostra l'avanzamento durante la riorganizzazione; la riga impostazioni guadagna la zona di gestione «indice di ricerca per contenuto» (badge di stato, pulsante di riorganizzazione, export/import di snapshot).
- **Configurazione**: `autoSync` / `syncIntervalMs` / `archiveKeep` / `indexDir` tutti facoltativi con valori predefiniti, compatibile all'indietro.

### Verifiche

- `node tests/index-engine.test.mjs`: 6/6 (ingestione e ricerca raggruppata, filtro per tipo, bonifica della sintassi FTS, vecchio indice interrogabile durante la riorganizzazione, isolamento delle sessioni corrotte, andata-ritorno export→import di snapshot, salto delle righe difettose).
- `npm test` (`tests/client-store.test.mjs`): 9/9.

### Aggiunta: compatibilità con le due versioni di DSH (0.1.1-rc.2 / 0.1.2-rc.1)

- **Un solo artefatto, adattivo a runtime**: lo stesso `lib/client.js` si carica in entrambe le versioni, senza rami su stringhe di versione. Il bundle client fa `require` solo di `react` / `react-dom`, entrambi nella tabella di moduli condivisa delle due versioni.
- **Rimozione dell'unico import di valore legato a una versione**: la riga impostazioni costruiva il proprio store via `defineStore` di `@deepseek-ai/dsh-client-runtime/client`; quel pacchetto motore è stato rinominato `@deepseek-ai/dsh-client-store` in 0.1.2, e qualunque import di valore avrebbe bloccato una singola versione (sotto 0.1.2 la materializzazione sollevava subito `require(...) missed the module table`, e l'intera metà client non si caricava).
- **Posto store divenuto implementazione locale**: il contratto del posto (`StoreHandle` / `StoreInstance`) appartiene a `@deepseek-ai/dsh-client-ui-slots` ed è identico nelle due versioni; il livello di rendering consuma solo `getSnapshot` / `subscribe` / `actions`. L'implementazione locale fa una trentina di righe, copre `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` e conserva la recinzione di revisione e la semantica di notifica dell'abbonamento; il comportamento è coperto da `tests/client-store.test.mjs` (9 casi).
- **Tipo snapshot specchiato localmente**: `SettingsScopeSnapshot<T>` ha gli stessi campi nelle due versioni (status / value / base / user / revision / writable / mode); si passa a uno specchio strutturale locale, perché un import di tipo non punti a una sola versione.
- **Metadati**: `engines.dsh` stretto su `>=0.1.0-rc.7 <0.2.0-0`; `peerDependencies` / `devDependencies` perdono `@deepseek-ai/dsh-client-runtime`; `dsh.client.inject` indica il pacchetto proprietario dello slot effettivamente riempito (`@deepseek-ai/dsh-client-ui-settings-general`); gli externals client di `tsdown` perdono il runtime in ballo insieme.

### Verifiche

- `npm test` (`tests/client-store.test.mjs`): 9/9.
- `_smoke/smoke-batch-c.mjs`: rotte della metà host + namespace impostazioni; la metà client si materializza una volta su ciascuna delle due tabelle di moduli reali (0.1.1-rc.2 con precaricato `dsh-client-runtime/client` / 0.1.2-rc.1 con `dsh-client-store`); un `require` oltre la tabella fallisce, e i due registri di registrazione coincidono.
