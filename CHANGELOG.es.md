# Changelog

Todos los cambios importantes y correcciones de errores se registran aquí. Las versiones siguen el versionado semántico (instalación con `dsh plugin --profile web add github:drscrewdriver/dsh-search-index`).

## 0.6.0 — Adaptación a DSH 0.2.0-rc.1 (cambio de generación de metadatos sin modificar ni una línea de código)

- **Cambio de generación de peer/engines**: los 4 peer de dsh-* (`dsh-client-locale` / `dsh-client-ui-settings` / `dsh-client-ui-settings-general` / `dsh-client-ui-slots`) y las dos apariciones de `engines.dsh` en `package.json` y `dsh.plugin.json` se sustituyen a la vez por `>=0.2.0-rc.1 <0.2.1-0` (ventana rc clavada, reevaluación a partir de 0.2.1).
- **Cero cambios de código**: la superficie de consumo del plugin frente al anfitrión es un puro caller (lecturas blandas vía `ctx.get('slots'/'locale'/'configForms')` + interfaces estructurales locales); 0.2.0 respecto a 0.1.7 no ha tocado ni los contratos slots/settings ni el registro de asientos.
- **Cambio de generación de devDependencies**: la devDep `dsh-client-ui-slots` pasa de `^0.1.0-rc.6` a `0.2.0-rc.1` (alineación con el nuevo optional peer, para evitar árboles de instalación mal emparejados); la devDep `@deepseek-ai/cordis` pasa de `^4.0.1` a `^4.0.4` (la familia de paquetes 0.2.0-rc.1 exige `~4.0.4`).
- **Gestión de dependencias**: el gestor de paquetes con autoridad en este repositorio es pnpm (`pnpm-workspace.yaml` + pnpm-lock v9); se regenera `pnpm-lock.yaml` y se elimina el anticuado `package-lock.json` (detenido en la era 0.5.0).
- **Documentación**: la matriz de compatibilidad y la frase de la línea principal de los README (zh/en) se actualizan a 0.2.0; la línea DSH 0.1.7 sigue atendida por 0.5.7 (dist-tag `dsh-0.1.7`, rama `compat/0.1.7`).

> Nota: las versiones entre 0.2.0-beta.5 y 0.5.7 corren a cargo de la línea DSH 0.1.x; véase la rama `compat/0.1.7` y el dist-tag npm `dsh-0.1.7`.

## 0.2.0-beta.5 — En columna estrecha, la «tecla» cede el paso y el nombre de las dos entradas se lee completo

### Correcciones (reveladas por las pruebas reales de beta.4)
- **Síntoma**: desde que beta.4 dejó de dar a esta entrada la línea entera en exclusiva, la línea `sidebar.footer.action` debe albergar a la vez
  «🔍 Búsqueda Ctrl K» y «🧭 Steward de sesiones». Medido en la realidad, la anchura natural de las dos cadenas suma **240px**,
  y la columna estrecha (unos 215–225px) no las caben: este plugin está en `flex:1`, el envoltorio del steward en `flex:none` (que nunca cede),
  de modo que **todo el déficit recae sobre la pastilla de búsqueda**, cuya etiqueta es el único elemento encogible — quedó apretada hasta un solo «搜».
- **Quién debe ceder**: la tecla es un **recordatorio** (el tooltip de la entrada y la barra del pie del panel repiten ambos el mismo acorde),
  la etiqueta es la **identidad** de la entrada. Así que cede la tecla: `.dsws_root` declara `container-type:inline-size`,
  y por debajo de 132px de anchura propia repliega `.dsws_kbd` vía `@container` (43px ahorrados).
- **Medido en real (Chrome, una sonda reproduce el CSS y el DOM verdaderos de las dos entradas)**: con columna de 180–230px la etiqueta queda completa 28/28, la tecla se oculta sola,
  las dos entradas sin ninguna sobresalida; a partir de 240px la tecla vuelve a mostrarse. La línea base previa dejaba la etiqueta en 12/28 a los 220px.
- **La forma de raíl necesita exención**: `container-type` trae también el containment de tamaño inline-size, que hace **colapsar a anchura 0** la caja raíz del raíl en `flex:none`
  (comprobado en real: root=0 mientras el botón sigue en 36px, sobresaliendo fuera de la caja). Por eso `.dsws_rootRail` vuelve explícitamente a `container-type:normal`.
- **El raíl vuelve a 28×28**: la caja de contenido del raíl mide solo 36px (raíl de 56px − 2×10px de padding); la caja de control oficial de 36×36
  parte del supuesto de **un solo control por línea**; con las dos entradas en la misma línea, 36+28=64px sobresalen 14px. Se toman 28+28=56px,
  un pelo más estrecho que los 32+28=60px de antes del cambio.
- Padding de la tecla `0 5px` → `0 4px` (los 2px por su cuenta).

## 0.2.0-beta.4 — La entrada de la barra lateral se adapta a compartir línea con el «steward de sesiones»

### Cambios
- **Ceder el paso, no acaparar la línea**: `.dsws_root` era originalmente `flex:none;width:100%` y ocupaba la línea entera en la flex-línea `sidebar.footer.action`,
  empujando la entrada vecina del steward al final de la línea, con la pastilla de 42px además desalineada respecto al botón de icono del compañero. Pasa a `flex:1 1 auto;min-width:0`, botón `flex:1;min-width:0` —
  isomorfo al control oficial del mismo asiento (`.trigger{flex:1;min-width:0;height:42px;border-radius:12px;padding:0 10px 0 8px}` de `ui-settings-general`).
  Cuando falta espacio, lo primero que se abrevia es la etiqueta (`.dsws_buttonLabel` ya tiene ellipsis), sin seguir apretando a los vecinos.
- **Raíl plegado alineado con el 36×36 oficial**: con `wide=false` el botón pasa a `.dsws_buttonRail` (`36×36`, `border-radius:50%`),
  el elemento raíz gana `.dsws_rootRail` y se mantiene `flex:none`; alineado con la especificación de raíl de Figma (raíl 56px / padding 10px / caja de control 36×36).
- **Contenido alineado a la izquierda**: se quita `justify-content:center`, y el icono queda en la misma columna que la línea oficial de «Ajustes» justo debajo.

### Sin cambios
- Interacción, panel, índice, rutas, espacio de nombres de ajustes `switch-search`: absolutamente nada tocado; con `enabled` apagado, toda la entrada (incluidas `⌘K` / `Ctrl K`) desaparece junta como siempre.
- La cooperación ocurre solo en el CSS respectivo de cada plugin: este no referencia ningún valor del steward ni supone su presencia ni su ausencia.
- Los selectores nuevos están todos referenciados en el código; el «cero clases huérfanas» de `tests/client-styles.test.mjs` sigue cumpliéndose.

## 0.2.0-beta.1 — Renombrado a dsh-search-index, el historial de sesiones se traslada al steward

### Cambios rompientes

- **Renombrado del paquete**: `dsh-session-search-toggle` → **`dsh-search-index`** (id de registro del cliente, id de parche cordis y dirección del repositorio renombrados con él). El espacio de nombres de ajustes **sigue siendo `switch-search`**: es una clave de almacenamiento, cambiarla perdería la configuración de los usuarios — deliberadamente no se deja que siga al nombre del producto. El nombre antiguo sigue resolviéndose vía el redireccionamiento de GitHub, pero pase la dependencia del perfil al nombre nuevo para no dejar convivir los dos nombres.
- **Traslado del dominio del historial de sesiones** (navegación del archivo + limpieza del archivo, incluida la entrada «sesiones archivadas» de la barra lateral y el «ver archivo» de la tarjeta de ajustes) → a la pestaña «Sala de expedientes» del nuevo paquete **`dsh-session-steward` (steward de sesiones)**.
- **Este paquete ya no escribe el conjunto de archivo**: `pruneArchiveFile` y los dos métodos `list-archived` / `archive-prune` se van con él. Sigue **leyendo** el conjunto de archivo oficial (`readArchiveSet`) para excluir del índice las sesiones archivadas — el conjunto de archivo tiene un único escritor: el steward. El contrato de formato de archivo está descrito en `dsh-归档文件格式契约-20260914.md`.
- **Lápida explícita para los nombres de método antiguos**: `list-archived` / `archive-prune` responden ahora **HTTP 410** con un error claro que apunta a `/session-steward/api/session-history-list|prune`. Refrescar el navegador no recarga la mitad anfitriona; el bundle de cliente viejo debe **fallar a gritos y saber adónde ir**, en vez de recibir un 404 silencioso que se leería como «el archivo se rompió».

### Eliminaciones

- `src/client/archive-panel.tsx` (trasladado al steward), la función de escritura `pruneArchiveFile` de `src/host/archive-source.ts`, la entrada de archivo en la tarjeta de ajustes y la superficie de inyección `openSession` de `IndexBlock`, además de las claves de texto afectadas.
- El caso de prueba de prune se marchó con la implementación: la cobertura sigue a la **implementación**, y se ha reconstruido del lado del steward en `tests/history.spec.ts` (8 casos), para no dejar un hueco donde «ninguno de los dos paquetes prueba».

### Conservados

- Todas las capacidades del índice independiente: sincronización incremental, reorganización no destructiva (shadow + conmutación atómica + archivo acotado `archiveKeep`), exportación/importación de instantáneas, inspección de recuperación del índice, explicitación de fallos de lectura de estado. `archiveKeep` se refiere al número de copias de **archivos de índice** conservadas y no tiene que ver con el archivado de sesiones; por eso se queda en este paquete.

## 0.2.0-beta.3 — El contador de archivo ya señala el camino, el interruptor de activación funciona de verdad, y se limpian 13 selectores huérfanos

### Corrección: el contador de `sesiones archivadas` era una cifra sin dueño — ahora señala el camino

- **Síntoma**: una pastilla de la tarjeta de ajustes informaba de «sesiones archivadas: 72», que este plugin **no puede gestionar** (la navegación y la limpieza del archivo se trasladaron al steward). El usuario veía una cifra y no podía pulsar nada — se leía como una función rota.
- **Remedio**: el texto de la pastilla pasa de `sesiones archivadas {n}` a **`{n} sesión/es archivada/s excluida/s del índice`** (aclara que es la **cantidad excluida por el índice**, no una lista de pendientes), con una frase de pertenencia debajo — quién gestiona qué y de qué se encarga este plugin.
- **Señalar solo el camino correcto**: el anfitrión gana `src/host/peers.ts`, que resuelve `dsh-session-steward` desde el **grafo de módulos del propio plugin** (es decir, los `node_modules` del perfil). Tres estados `installed` / `missing` / `unknown`: «actualmente no instalado» solo se muestra **cuando la resolución falla con certeza** — mandar a un usuario a instalar un plugin que ya tiene es peor que callarse; los demás errores del resolutor (manifiesto corrupto, etc.) van todos a `unknown`, con el texto neutro.
- La base de resolución de `probePeer(name, base?)` es inyectable, así que la rama «presente pero ilegible» es reproducible en pruebas (con un fixture `package.json` corrupto, apuntado mediante la base inyectada).

### Corrección: `activar búsqueda de sesiones` era un interruptor muerto — ahora manda de verdad

- **Síntoma**: `enabled` tenía tipo, valor por defecto, interruptor y texto («mostrar la entrada «Búsqueda» al pie de la barra lateral»), pero **no había un solo segundo consumidor en todo el repositorio**: la entrada se registraba sin condición y el interruptor no controlaba nada.
- **Remedio**: el binding del espacio de nombres de ajustes se resuelve **una sola vez** (`entryScope`), y entrada y tarjeta de ajustes **comparten el mismo** binding; la entrada se suscribe con `useSyncExternalStore` y lee `enabled` — apagado, la entrada entera (tecla de invocación `⌘K` / `Ctrl K` incluida) desaparece junta: «¿está activo este plugin?» tiene siempre una sola respuesta.
- Cuando los ajustes son ilegibles (sin `settingsScope`, estado ilegible) **la entrada sigue visible**: no poder leer la elección del usuario no equivale a petición de cierre; y ocultar la entrada es esconder también «el único camino de vuelta al panel».

### Limpieza: 13 selectores huérfanos (10 de ellos del panel de archivo ya trasladado)

- Al mudarse el panel de archivo al steward, los selectores se quedaron en su sitio y siguieron empaquetándose: `dsws_archRow` / `dsws_archCheck` / `dsws_uuid` / `dsws_dialogHead` / `dsws_dialogTitle` / `dsws_dangerBtn` / `dsws_editActive` / `dsws_linkBtn` / `dsws_indexLine` / `dsws_setRoot`. Una hoja de estilos llena de estilos «para un panel que ya no existe» se lee como «este plugin sigue a cargo de ese rincón» — exactamente el malentendido que la escisión debía enterrar.
- Se limpian además 3 clases muertas: `dsws_switch` / `dsws_switchTrack` / `dsws_switchThumb` — el `Toggle` pasó hace tiempo a estilos puramente en línea, esos selectores de clase nunca fueron referenciados.
- La hoja de estilos baja de 53 clases a 50, **cero huérfanas**.
- tests: nuevo `tests/client-styles.test.mjs` — la hoja de estilos solo puede tener un dueño; **cada** clase debe estar referenciada en el código, o falla (precisamente por eso estas 13 clases pudieron seguir escondidas hasta hoy). También queda clavado «el binding de ajustes tiene un solo dueño» (`bind()` exactamente una vez + al menos dos consumidores) — la línea de defensa estructural contra el interruptor muerto.
- tests: nuevo `tests/host-peers.test.mjs` (`node --import tsx`) que cubre la clasificación en tres estados.
- **Refutado por contraste**: volver a meter una clase huérfana → `client-styles` sale al instante con `exit 1`; cambiar la red de `probePeer` para que devuelva siempre `missing` → `host-peers` sale al instante con `exit 1`; restaurados ambos, todo vuelve a verde.

## 0.2.0-beta.2 — Tecla de invocación y pistas de teclas por plataforma; ordenación de resultados, títulos en tiempo real y una tanda de correcciones en la cadena de búsqueda

### Nueva: tecla de invocación + pistas de teclas por plataforma (estilo de ventana flotante inspirado en `@hyzyn/dsh-search`)

- **Un acorde invoca el panel**: **`⌘K` (macOS) / `Ctrl K` (Windows/Linux)** desde cualquier punto de la barra lateral abre el panel de búsqueda, equivalente al clic en la entrada. El enlace cuelga del componente de la entrada, no del nivel plugin — cerrada la entrada, el acorde desaparece con ella: «¿está activo el plugin?» tiene una sola respuesta.
- **Pistas de teclas por plataforma**: tanto a la derecha de la entrada de la barra lateral como en la nueva barra de teclas del pie del panel se renderiza la pastilla de la tecla de invocación; la tecla de cierre es igualmente `esc` (macOS) / `Esc` (resto). Hasta ahora el plugin no mostraba **ninguna pista de atajos**: la entrada solo se descubría con el ratón.
- **Reconocimiento de plataforma con degeneración en tres niveles**: `UA-CH (navigator.userAgentData.platform) → navigator.platform → cadena UA`. Copiando la simple comprobación de `navigator.platform` del plugin de referencia, esta API devuelve cadena vacía bajo ciertas configuraciones de privacidad y degradaba en silencio a un usuario de Mac al vocabulario de Windows; ahora la cadena vacía sigue preguntando río abajo, y si nada responde se **degrada a `Ctrl`/`Esc`** — `Ctrl` lo entiende todo el mundo, `⌘` no.
- **Pista y enlace de la misma fuente**: el acorde de la pastilla y el que realmente reconoce `keydown` salen del mismo sitio (`isInvokeChord` en `src/client/platform.ts`), exigiéndose mutuamente «la otra tecla modificadora debe estar ausente» para distinguir ambas plataformas. Por tanto no pueden existir pistas falsas sin reacción del tipo «abajo pone `⌘K`, pero el gestor solo reconoce `Ctrl+K`».
- **Tecla adaptativa**: `.dsws_kbd` se renderiza con `min-width:18px; width:auto` — `Ctrl K`, `⌘K`, `Esc` se muestran completos sin apretarse; la etiqueta de texto de la entrada pasa a ser encogible con ellipsis, para que la tecla no saque la etiqueta fuera del botón.
- tests: nuevo `tests/client-platform.test.mjs` (`node --import tsx`, pruebas directas de las funciones puras de `src/client/platform.ts`: degeneración en tres niveles con cadena vacía en modo privado, cuatro inventarios de vocabulario, tabla de verdad de acordes, y la coherencia entre mitades «la tecla que anuncia cada plataforma debe ser aceptada por el gestor»; más clavados estructurales sobre el **artefacto** — el nivel UA-CH tiene un único dueño, `isInvokeChord` referenciado al menos dos veces (definición + escuchador), tres pastillas de tecla, superficies de acorde de ambas plataformas de la misma fuente). **Refutado**: sustituir `isInvokeChord(...)` en el escuchador por una comparación literal hace fallar al instante las aserciones del artefacto.

### Mejora: la sombra del flotante pasa a los tokens oficiales

- La sombra del panel estaba codificada a fuego `0 8px 28px rgba(0,0,0,.16)`, ahora pasa a `var(--dsw-shadow-lv3, 0 8px 28px rgba(0,0,0,.16))` — el mismo nivel de sombra flotante que los `Menu` / `Modal` / `Toast` / `HoverCard` oficiales, variando con el tema; el valor antiguo queda como respaldo en `var()`, los anfitriones viejos no retroceden. El radio de 12px ya coincidía con la tarjeta desplegable oficial (`r12` del `Menu`); el velo toma `--dsw-alias-bg-mask-1` + `--dsw-mask-blur`, misma fuente que el `Modal` oficial.

### Corrección: la búsqueda por contenido se quedaba eternamente en blanco — la clave de petición tenía dos dueños

- **Síntoma**: la búsqueda por contenido obtenía los resultados correctos, pero la interfaz se quedaba clavada en estado de carga sin mostrar nada. Del lado del anfitrión, en pruebas reales todo perfecto — `content-search` devolvía aciertos tanto para chino (`插件`, `适配`) como para ASCII (`dsh`); ni el índice ni la tokenización fallaban.
- **Raíz**: la clave de petición estaba **escrita a mano por duplicado**. El effect que lanza la petición armaba una clave de tres segmentos `query\0type\0sortBy`, mientras el renderizado, para juzgar «¿este resultado pertenece a la entrada actual?», armaba otra de dos segmentos `query\0type`. La versión que añadió la ordenación solo tocó el lado de escritura: las dos claves nunca coincidirán, y `activeContent` caía en cada vuelta en la rama vacía de `loading` — los resultados llegaban, se analizaban, y luego se tiraban.
- **Remedio**: la clave converge en un **único dueño** — un `contentRequestKey(normalized, contentType, sortBy)` compartido por ambos lados. No se eligió «reponer el segmento faltante en el segundo ejemplar»: seguirían siendo dos dueños, y la próxima dimensión de entrada volvería a hacer derivar todo.
- **Antirregresión**: nuevo `tests/client-panel-key.test.mjs`. La ruta de renderizado de React no entra en esta cobertura (`client-store.test.mjs` declara al principio que no cubre la GUI), así que se clavan invariantes estructurales — el artefacto debe contener **exactamente un** template literal con separador NUL, y el auxiliar compartido debe estar referenciado al menos 3 veces (definición + dos puntos de llamada). La aserción se probó: reescribir la segunda clave en el artefacto la hace fallar; luego se restauró.

### Nueva: ordenación de resultados (relevancia / fecha) + cambios de título registrados en el índice en tiempo real

- **Conmutador de ordenación**: sobre los resultados de la búsqueda por contenido, un nuevo conmutador «Relevancia / Fecha», en la misma línea que el filtro de tipo, alineado a la derecha. «Relevancia» por defecto conserva el comportamiento existente; «Fecha» ordena en descendente por la **última actividad de la sesión**, a igualdad de tiempo por fuerza de coincidencia.
- **Dos campos temporales, cada uno con su oficio**: cada acierto entrega a la vez `time` (marca temporal del **documento** mejor emparejado) y `updatedAt` (reloj a nivel de **sesión**). La ordenación usa la segunda — la hora del documento tocado no dice si la sesión se movió recientemente. Se dan ambos campos; el front-end puede reordenar por su cuenta.
- **Ordenar antes de truncar**: el anfitrión ordena primero y trunca después según `limit`. Truncar antes de ordenar haría que el modo «Fecha» solo remezclara el top N ya cortado por relevancia — como no ordenar.
- **Elección persistente**: la preferencia de ordenación vive en `localStorage` (clave `dsh-search-index.sortBy`) y sobrevive a las recargas; si la lectura/escritura falla en modo privado, degrada en silencio a relevancia.
- **Compatibilidad con la mitad anfitriona envejecida**: un anfitrión que no conozca `sortBy` degrada a relevancia en lugar de fallar; el cliente solo reordena en local si cada acierto lleva un `updatedAt` numérico, para no calcular NaN sobre datos viejos.
- **La hora llega a las líneas de contenido**: la línea de cabecera de los resultados de contenido solo mostraba la etiqueta de tipo; la hora aparecía solo en los resultados de búsqueda por título. Ordenar por «Fecha» sin ver ninguna fecha equivale a no poder verificar que la ordenación funciona. Ahora, a la derecha de la etiqueta de tipo, figura la **última actividad de la sesión** (`updatedAt`) — el mismo campo que usa la ordenación, y la misma hora que se ve en la línea de cabecera.
- **Títulos en tiempo real**: un renombrado añade un evento `session/title` de solo-log (sin tocar la cara del modelo). Hasta ahora había que esperar a la siguiente ronda de sincronización por marca de agua (30 s por defecto) para que el índice lo reflejara; ahora el anfitrión se suscribe a `session/event` y, al detectarlo, repliega el título de forma dirigida por id (`SwitchWatermarkSync.refreshTitles`), sin esperar el barrido completo. Los eventos se fusionan en rachas de 250 ms; con `autoSync: false` no interviene; **la marca de agua no se mueve** — una actualización de título jamás hará presumir al índice haber leído lo que no leyó; la siguiente ronda reingesta la sesión según la versión bombeada.
- tests: la ordenación `sortBy=time` usa deliberadamente muestras invertidas «viejo pero muy relevante / nuevo pero poco relevante» (de lo contrario la aserción podría salir solo por casualidad), y cubre ordenar-antes-de-truncar y la degradación con ordenación desconocida; `refreshTitles` cubre repliegue inmediato, ausencia de relectura del log, marca de agua intacta, idempotencia con ids desconocidos y convergencia en la ronda siguiente. Serie completa 24/24.

### Corrección: inspección y recuperación de semielaborados tras la interrupción anómala de una reconstrucción

- Al activarse el anfitrión (antes de abrir el motor) se inspecciona automáticamente el directorio del índice: un `index.building.sqlite` sin acabar — si existe el activo se dictamina «la última reconstrucción nunca terminó» y se descarta (incluidos -wal/-shm; el activo nunca estuvo en peligro); si falta el activo, el dictamen es «el fallo cayó en la ventana de renombrado», se **restaura el más reciente de los archivados como activo** y luego se descarta el semielaborado; sin activo ni archivo, se arranca de cero. Log `[switch-search] index recovery` de principio a fin.
- El fallo de lectura de estado ahora es explícito (pastilla de error + botón de reintentar); se acabó el eterno «leyendo el estado del índice…».
- tests: 2 casos del camino de recuperación (descarte del semielaborado / restauración desde la ventana de renombrado), serie completa 18/18.

### Interacción: la limpieza del archivo converge en un modo de edición

- El panel de archivo es de solo lectura por defecto; un botón «Editar» en la cabecera pasa al estado de edición — casillas, seleccionar todo y el rojo «Eliminar selección (N)» aparecen solo en modo edición; «Hecho» sale y vacía la selección.
- El botón de eliminar sigue recorriendo el flujo completo de confirmación (confirm de JS: resumen de ids + avisos de copia de seguridad/reinicio/irreversibilidad) → `archive-prune` → retirada inmediata de la marca de borrado suave en el índice → actualización de la lista y permanencia en modo edición para seguir limpiando.

### Nueva: limpieza en lote del archivo (panel de gestión)

- El panel de archivo gana un modo de gestión en lote: seleccionar todo/marcar sesiones archivadas → **confirmación con confirm de JS** (lista el resumen de los ids a retirar) → la API `archive-prune` retira en lote los ids del array `global.archivedSessionIds` del almacenamiento canónico `~/.dsh/storages/workspace.json`.
- La escritura sigue el protocolo oficial storage-json: **primero copia de seguridad (workspace.json.bak-<ts>) y luego sustitución atómica** (archivo temporal en el mismo directorio + rename), serialización idéntica a la oficial (2 espacios + salto de línea final); techo de 5000 ids por operación.
- Tras la retirada, el índice del plugin **levanta al instante la marca de borrado suave** (version=-1; la siguiente ronda de sincronización por marca de agua reingiere las sesiones que sigan existiendo); la memoria del DSH en marcha no carga el nuevo array hasta **después del reinicio** — el panel y el log lo avisan claramente.
- tests: copia de seguridad del prune / escritura atómica / ausencia de residuos / idempotencia con ids desconocidos, serie completa 17/17.

### Mejora: observabilidad de la reconstrucción + aceleración con transacciones por lotes + driver better-sqlite3 opcional

- **Gestión del progreso corregida**: el avance de la reorganización solo se informaba al terminar (el panel seguía en «0/?»); pasa a un sink de estado — index-status refleja en caliente done/total/fase.
- **Log de desarrollo** (prefijo `[switch-search]`, vía el logger de cordis): identificación del driver, líneas de ritmo cada 50 sesiones de reconstrucción (sess/s / eta / duración de chunk), transiciones de fase, resumen de rondas de sincronización (scanned/updated/skipped-archived/failures/duration) — datos para comparar objetivamente la velocidad antes y después.
- **Checkpoints de transacciones por lotes**: la reconstrucción hace commit de una transacción cada 50 sesiones (amortización del fsync); los chunks fallidos se reproducen uno a uno, aislados; ajuste de PRAGMA (synchronous=NORMAL / temp_store=MEMORY / cache_size=64MB).
- **Doble driver**: `better-sqlite3` entra en optionalDependencies (un fallo de compilación nativa no bloquea la instalación), se carga dinámicamente en ejecución con reserva a node:sqlite en su ausencia; el motor y index-status anotan el driver actual (campo `driver`) — instalarlo o no solo afecta a la velocidad, no a las funciones.
- **Texto de la entrada de búsqueda**: el botón del pie «Título» → «Búsqueda de sesiones».
- tests: nuevos tests de seguridad de anidamiento de transacciones por lotes + identificación del driver, serie completa 16/16.

### Nueva: sincronización de borrado suave del archivo + panel de consulta del archivo + alineación con el estilo DSH

- **Borrado suave del archivo (schema v4)**: cada ronda de sincronización por marca de agua lee el `workspaceRegistry.archivedSessionIds` oficial (resolución perezosa, reserva automática si falta el servicio); las sesiones archivadas llevan una marca `archived` en el índice — excluidas de la búsqueda y de la lista de sesiones, contenido del documento retirado pero header (caché de títulos) conservado; **quitar el archivado reingiere automáticamente el texto completo** (version=-1 dispara la relectura en la ronda siguiente).
- **La reorganización ya no copia contenido archivado**: reconstrucción / exportación-importación de instantánea escriben para una sesión archivada solo la línea header, cero copias en docs/fts.
- **Panel de consulta del archivo**: ventana flotante centrada de solo lectura que lista el conjunto de archivo oficial (título/hora/cwd), un clic abre la sesión; dos entradas — «sesiones archivadas» al pie del panel de búsqueda y «ver archivo» en la tarjeta de ajustes (nueva API `list-archived`, fence intacto). No existe un punto unarchive oficial, el panel no ofrece operaciones de restauración.
- **Alineación con el estilo DSH** (a las métricas y tokens de los fuentes oficiales de `SettingsRoot` / `ConnectionIndicator`): el botón del pie pasa a las especificaciones oficiales del trigger (42px / radio 12px / token hover); el estado del índice adopta el lenguaje oficial de pastillas (colores semánticos `--dsw-alias-state-warn/success/error-*`, animación de puntos durante la sincronización + parada bajo `prefers-reduced-motion`); el velo de la ventana flotante pasa a los tokens de máscara del Modal (`--dsw-alias-bg-mask-1` + blur).
- tests: nuevo `tests/index-archive.test.mjs` (5 casos: borrado suave / restauración con reingesta / línea header / salto en la reconstrucción / reglas de instantánea), serie completa 15/15.

### Mejora: reestructura del conducto de búsqueda (tokenización / almacenamiento / ruta de consulta)

- **Tokenización por palabras vía Intl.Segmenter en lugar de trigramas**: el texto extraído se divide por fronteras de palabra ICU y entra en FTS5 unicode61; el lado de consulta pasa por la misma tokenización. El volumen del índice baja de las ventanas completas de 3 caracteres del trigrama a tokens por palabra (se espera del orden de 1/4); las consultas cortas de 2 caracteres vuelven del «escaneo LIKE de toda la tabla» a consultas normales de índice; las entradas parciales aciertan por prefijo de la última palabra (`*` final, «正在搜» → 正在搜索); los fragmentos que cruzan palabras ya no aciertan por error (la precisión sube).
- **Contenido externo de FTS5**: la tabla virtual FTS pasa al modo de contenido externo `content='docs'` (columna tokenizada `index_text` + columna `text` original); el índice invertido ya no duplica el texto completo, ahorrando otra vez cerca de la mitad del almacenamiento; inserciones/borrados mantienen la coherencia con el comando `docs_fts 'delete'`.
- **Ruta de consulta aliviada**: los rowid de la subconsulta MATCH limitada por rank se alinean directamente con `docs.doc_id`; una sola instrucción cubre búsqueda + filtro por tipo/superficie, eliminando la segunda consulta `IN (...)` de 5000 parámetros en cada pulsación.
- Índice schema v3: el índice antiguo se reinicia al abrirlo; la sincronización por marca de agua lo reingiere automáticamente en el siguiente sondeo, sin reorganización manual.
- tests: nuevas regresiones semánticas de tokenización (consultas cortas / prefijo / precisión), 7/7.

### Reestructura: tarjeta de ajustes independiente (al modo thinking-levels)

- **Tarjeta independiente `settings.plugin.item`**: el plugin gana su propia tarjeta de ajustes (doble registro `id`+`key`, compatible tanto con el slot por clave del CLI dsh como con el slot list de DSH Desktop), en sustitución de la antigua línea genérica `settings.general.item` y de su asiento store local. La tarjeta se enlaza al espacio de nombres de ajustes `switch-search`, se suscribe con `useSyncExternalStore` y compromete al vuelo con `scope.set` (sin formulario de estancia).
- **Panel de subajustes unificado**: interruptor de activación, modo de búsqueda por defecto, interruptor de sincronización automática, intervalo de sincronización, número de archivados conservados, y la zona de gestión del índice de búsqueda por contenido (estado, botón de reorganización del índice, exportación/importación de instantáneas) — todo converge en la misma tarjeta.
- **Diccionarios de locale**: nuevos diccionarios zh/en de `switch-search` (`src/client/locales.ts`); si falta el servicio de locale en DSH antiguos, reserva con los textos zh incorporados, y sin settingsScope la tarjeta degrada a DEFAULT_CONFIG de solo lectura, sin romperse.
- **División del cliente**: las llamadas al anfitrión y los tipos compartidos por panel/tarjeta convergen en `src/client/host-api.ts`; el `dsh.client.inject` de `package.json` gana `@deepseek-ai/dsh-client-locale` y `@deepseek-ai/dsh-client-ui-settings`.
- **Pruebas**: `tests/client-store.test.mjs` reescrito para demostrar el nuevo asiento de tarjeta (binding de namespace, ausencia de asiento store, degradación sin settingsScope), 3/3.

### Nueva: motor de índice de texto completo independiente (adiós a la dependencia del índice FTS5 oficial de DSH)

- **Archivo de índice propio**: la búsqueda por contenido pasa al índice construido por el plugin (node:sqlite FTS5 + tokenización trigrama, application id independiente `0x53574954`), guardado en `~/.dsh-switch-search/` (sobrescribible con la configuración `indexDir` o la variable de entorno `DSH_SWITCH_SEARCH_DIR`). Con el `session-query-sqlite` oficial en su `openAt: never` por defecto, la búsqueda por contenido sigue plenamente disponible; el archivo de índice oficial nunca se abre, sin interferencias mutuas.
- **Sincronización incremental por marca de agua**: en segundo plano, la marca de agua `version` de las sesiones se compara cada `syncIntervalMs` (30 s por defecto) y solo para las sesiones nuevas/modificadas `readSession` las incorpora de forma incremental; la semántica de extracción de texto se alinea con `extractSessionEventText` oficial (user/reply/tool/todo/turn-end), con réplica del plegado de superficie (los mensajes viejos sustituidos por edición se marcan shadowed y quedan fuera de la búsqueda).
- **Reorganización no destructiva (reconstrucción)**: el panel/los ajustes pueden disparar «reorganizar índice» — construcción completa del archivo shadow, el índice viejo sigue consultable mientras tanto; al terminar, conmutación atómica en tres `rename`, el índice viejo se archiva como `index.archive-<ts>.sqlite` (se conservan `archiveKeep` copias, 2 por defecto).
- **Interfaz de migración por instantánea JSON**: `index-export` exporta una instantánea JSON Lines (una línea por sesión, con los documentos extraídos), `index-import` importa la instantánea y la conmuta atómicamente por el mismo camino de reorganización — sincronizada la instantánea, ya sirve de índice, permitiendo mudanza entre máquinas y copia de seguridad fría.
- **API HTTP**: `/switch-search/api` gana `index-status` / `index-rebuild` / `index-export` / `index-import`; `list-sessions` reserva con la lectura del índice cuando sessionQuery no está disponible; el fence original se mantiene en todos.
- **Cliente**: el panel de contenido ofrece una entrada «construir índice» cuando falta el índice y muestra el progreso durante la reorganización; la línea de ajustes gana la zona de gestión «índice de búsqueda por contenido» (insignia de estado, botón de reorganización, exportación/importación de instantáneas).
- **Configuración**: `autoSync` / `syncIntervalMs` / `archiveKeep` / `indexDir` todos opcionales con valores por defecto, retrocompatible.

### Verificaciones

- `node tests/index-engine.test.mjs`: 6/6 (ingesta y búsqueda agrupada, filtro por tipo, saneamiento de la sintaxis FTS, índice viejo consultable durante la reorganización, aislamiento de sesiones corruptas, ida y vuelta exportación→importación de instantánea, salto de líneas defectuosas).
- `npm test` (`tests/client-store.test.mjs`): 9/9.

### Nueva: compatibilidad con dos versiones de DSH (0.1.1-rc.2 / 0.1.2-rc.1)

- **Un solo artefacto, adaptable en tiempo de ejecución**: el mismo `lib/client.js` se carga en ambas versiones, sin ramas por cadenas de versión. El bundle de cliente solo hace `require` de `react` / `react-dom`, ambos en la tabla de módulos compartida de las dos versiones.
- **Eliminada la única importación de valor propia de una versión**: la línea de ajustes construía su store vía `defineStore` de `@deepseek-ai/dsh-client-runtime/client`; ese paquete motor fue renombrado a `@deepseek-ai/dsh-client-store` en 0.1.2, y cualquier importación de valor clavaba una única versión (bajo 0.1.2 la materialización lanzaba de entrada `require(...) missed the module table`, y toda la mitad de cliente no se cargaba).
- **El asiento store pasa a implementación local**: el contrato del asiento (`StoreHandle` / `StoreInstance`) lo posee `@deepseek-ai/dsh-client-ui-slots` y es idéntico en ambas versiones; la capa de renderizado solo consume `getSnapshot` / `subscribe` / `actions`. La implementación local ronda las 30 líneas, cubre `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` y conserva la valla de revisión y la semántica de notificación de suscripción; el comportamiento lo cubre `tests/client-store.test.mjs` (9 casos).
- **Tipo de instantánea espejado localmente**: `SettingsScopeSnapshot<T>` tiene los mismos campos en ambas versiones (status / value / base / user / revision / writable / mode); se pasa a un espejo estructural local, para que una importación de tipo no apunte a una sola versión.
- **Metadatos**: `engines.dsh` estrechado a `>=0.1.0-rc.7 <0.2.0-0`; `peerDependencies` / `devDependencies` se deshacen de `@deepseek-ai/dsh-client-runtime`; `dsh.client.inject` apunta al paquete dueño del slot realmente rellenado (`@deepseek-ai/dsh-client-ui-settings-general`); los externals de cliente de `tsdown` pierden el runtime en el mismo movimiento.

### Verificaciones

- `npm test` (`tests/client-store.test.mjs`): 9/9.
- `_smoke/smoke-batch-c.mjs`: rutas de la mitad anfitriona + espacio de nombres de ajustes; la mitad de cliente se materializa una vez sobre cada una de las dos tablas de módulos reales (0.1.1-rc.2 con precargado `dsh-client-runtime/client` / 0.1.2-rc.1 con `dsh-client-store`); un `require` fuera de tabla falla, y ambos registros de registro coinciden.
