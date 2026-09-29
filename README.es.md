<p align="center">
  <strong>Una búsqueda de sesiones con índice propio para la barra lateral de DeepSeek Harness — conmutación en un clic entre título y contenido, con filtros por usuario / respuesta / herramienta</strong>
</p>
<p align="center">
  <a href="README.md">简体中文</a> · <a href="README.en.md">English</a> · <a href="README.fr.md">Français</a> · <a href="README.de.md">Deutsch</a> · <a href="README.it.md">Italiano</a> · <a href="README.ru.md">Русский</a> · <strong>Español</strong>
</p>
<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-263146?style=flat-square"></a>
  <img alt="Public" src="https://img.shields.io/badge/status-public-7da1de?style=flat-square">
</p>

# dsh-search-index

> **Índice de búsqueda** para la barra lateral del web de DSH: añade al pie de la barra lateral una entrada **«Búsqueda»** cuyo panel flotante conmuta en un clic entre **búsqueda por título ↔ búsqueda por contenido**; el modo contenido muestra títulos y fragmentos encontrados **agrupados por sesión**, con filtrado por categoría **usuario / respuesta / herramienta**. Trae consigo un **índice independiente** (sin depender del índice de texto completo oficial de DSH), con sincronización incremental, reorganización no destructiva y exportación/importación de instantáneas.

> **Este paquete solo se ocupa de la búsqueda y del índice.** La consulta y la limpieza del historial de sesiones (el antiguo panel de «sesiones archivadas») se han trasladado a la pestaña «Sala de archivos» de **`dsh-session-steward`**; este paquete sigue **leyendo** el conjunto de archivo oficial para excluir del índice las sesiones archivadas, pero ya no **escribe** en él — el conjunto de archivo tiene un único escritor: el steward. El contrato está descrito en `dsh-归档文件格式契约-20260914.md`.

Sin modificar el código fuente de dsh y sin PR: un cliente cordis más la mitad anfitriona del plugin, ensamblados mediante el comando `dsh plugin` y un parche de bundle.

## Predecesor y versión actual

**Predecesor: `dsh-session-search-toggle`.** Aquella versión se apoyaba en el `defineStore` de `@deepseek-ai/dsh-client-runtime` para obtener el asiento de la fila de ajustes. DSH 0.1.2 renombró y reestructuró los paquetes motor del cliente (`dsh-client-runtime` → `dsh-client-store`), y el código antiguo ya no podía cargarse en el nuevo anfitrión — un solo plugin no podía cubrir ambas versiones con un único artefacto.

**La versión actual (`dsh-search-index` 0.6.0) toma DSH 0.2.0 como línea principal** (peer `>=0.2.0-rc.1 <0.2.1-0`). Las líneas de anfitriones históricos se atienden con líneas de versiones separadas: DSH 0.1.7 lo atiende la 0.5.7 (dist-tag npm `dsh-0.1.7`, rama `compat/0.1.7`); los anfitriones 0.1.1/0.1.2 más antiguos usan el artefacto antiguo, que ya no evoluciona con esta versión. Antecedentes históricos:

- **Un solo artefacto, adaptable en tiempo de ejecución**: el mismo `lib/client.js` se carga tanto en 0.1.1-rc.2 como en 0.1.2-rc.1, **sin ninguna rama por cadenas de versión**. El bundle del cliente solo hace `require` de `react` / `react-dom`, ambos presentes en la tabla de módulos compartida de las dos versiones.
- **Ninguno de los dos paquetes motor se importa**: ni `dsh-client-runtime` ni `dsh-client-store` — el cambio de nombre, por tanto, **no puede afectarle**.
- **Asiento store implementado localmente**: la fila de ajustes necesita un asiento store (`StoreHandle` / `StoreInstance`, contrato propiedad de `@deepseek-ai/dsh-client-ui-slots` e idéntico en ambas versiones). Este plugin sustituye `defineStore` por una implementación local de unas treinta líneas — solo depende de `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`, sin ningún specifier ligado a una versión.
- **Todos los demás contratos coinciden en ambas versiones**: el slot `settings.general.item`, `SettingsScope.{getSnapshot,subscribe,set,unset}` y las tres caras de consulta de `sessionQuery` tienen las mismas firmas en las dos.

> **▼ Soporte de versiones de DSH**
> | Versión de DSH | Estado | Soporte y diferencia clave |
> | --- | --- | --- |
> | 0.2.0-rc.1 | ✅ | **versión actual 0.6.0**; peer/engines = `>=0.2.0-rc.1 <0.2.1-0`, cero cambios de código (consumo puramente caller de los asientos slots/locale/configForms) |
> | 0.1.7-rc.1+ | ✅ | 0.5.7 (dist-tag `dsh-0.1.7`); configForms resuelve el handle por entry id, los anfitriones antiguos recaen en settingsScope vinculado por espacio de nombres |
> | 0.1.1-rc.2 | ✅ (artefacto antiguo, congelado) | el motor store está en `@deepseek-ai/dsh-client-runtime/client` |
> | 0.1.2-rc.1 | ✅ (artefacto antiguo, congelado) | el motor pasó a llamarse `@deepseek-ai/dsh-client-store`; este plugin no importa ninguno de los dos |

**Actualización desde el nombre antiguo**: este paquete procede del renombrado de `dsh-session-search-toggle`; el id de registro del cliente, el id de parche cordis y la URL del repositorio se renombraron con él. GitHub conserva redirecciones para los repositorios renombrados, así que el nombre antiguo sigue resolviéndose — pero pasa la dependencia del perfil al nombre nuevo en lugar de dejar que ambos convivan mucho tiempo:

```sh
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master
dsh plugin --profile web remove dsh-session-search-toggle
dsh web   # reiniciar
```

El espacio de nombres de ajustes sigue siendo `switch-search` (**la clave de almacenamiento se mantiene estable, sin migración**), de modo que la configuración existente sigue funcionando bajo el paquete nuevo.

## Qué sabe hacer

- **Doble modo título ↔ contenido**: una entrada, dos maneras de buscar — «Título» filtra en vivo por subcadena del título de sesión / directorio de trabajo; «Contenido» busca en el cuerpo de los mensajes a través del **índice independiente construido por este plugin**.
- **Contenido agrupado por sesión**: cada resultado de la búsqueda por contenido ocupa una línea por sesión (título de sesión + fragmento más relevante + etiqueta de tipo); un clic abre esa sesión, sin inundar la pantalla mensaje a mensaje.
- **Filtro por tipo de contenido**: chips de filtro en la cabecera del modo contenido — **Todo / Usuario / Respuesta / Herramienta**; `Herramienta` abre a los resultados los eventos `tool/call` y `tool/result`, para buscar directamente en los argumentos y valores de retorno de las llamadas a herramientas.
- **Ordenación de resultados**: **Relevancia / Fecha** a la derecha de la misma fila — «Fecha» ordena por la **última actividad de la sesión**, las tocadas más recientemente primero; la preferencia se guarda en local y sobrevive a las recargas. Cada resultado entrega a la vez la marca de tiempo del documento y la de la sesión, así que el front-end puede reordenar por su cuenta.
- **Títulos en tiempo real**: el anfitrión se suscribe a `session/event`; un renombrado (`session/title`) se pliega en el índice al instante, sin esperar a la siguiente ronda de sincronización (30 s por defecto).
- **Tarjeta de ajustes**: Ajustes → Plugins gana una tarjeta **«Índice de búsqueda»** — interruptor de activación, modo de búsqueda por defecto, controles de sincronización / retención / directorio del índice independiente y el bloque de ciclo de vida del índice (estado, reorganización no destructiva, exportación/importación de instantáneas). Cuando informa «N sesión(es) archivada(s) excluida(s)», **señala en el propio sitio quién responde**: consultar y limpiar las sesiones archivadas corresponde al **«steward de sesiones»** (`dsh-session-steward`), y este plugin solo lee el conjunto de archivo; si no está instalado, el aviso lo dice expresamente («actualmente no instalado») — el veredicto lo emite el anfitrión resolviéndolo desde el **grafo de módulos del propio plugin**, y ante un resultado indeterminado vale el texto neutro: **nunca se informa «ilegible» como «no instalado»**.
- **Tecla de invocación y pistas de teclas por plataforma**: tanto la entrada de la barra lateral como la barra de teclas del pie del panel muestran la tecla de invocación — `⌘K` en macOS, `Ctrl K` en Windows/Linux, decidido según el sistema en marcha; la tecla de cierre del panel también sigue la plataforma (`esc` en macOS, `Esc` en el resto). La detección degrada en cascada **UA-CH → `navigator.platform` → cadena UA**, así que un modo privado nunca rebaja a un usuario de Mac a los símbolos de Windows. **Aviso y enlace salen de la misma fuente**: el acorde escrito en la pastilla es exactamente el que reconoce el gestor de `keydown` — nunca «una tecla prometida, otra interceptada».
- **Salto directo al hacer clic**: hacer clic en un resultado abre la sesión correspondiente, posicionándose en el contexto donde está el hallazgo.

## Vista previa de la interfaz

Disposición de la entrada de búsqueda en la barra lateral y del panel de búsqueda:

![Entrada de búsqueda en la barra lateral](assets/content-search-example.png)
![Panel de búsqueda](assets/new-index.png)

## El índice independiente: tres mecanismos

El modo contenido **construye su propia base**, sin depender del índice de texto completo oficial `session-query-sqlite` de DSH. El índice vive en `src/host/`: `schema.ts` crea las tablas (incluida la tabla FTS5 propia `docs_fts`), `engine.ts` ejecuta las consultas y `extract.ts` extrae de los eventos de sesión el texto buscable (incluidos el nombre y los argumentos de la herramienta en `tool/call`, y el texto del resultado en `tool/result` — la base de datos del «filtro de herramientas»). El `sessionQuery` de DSH se usa solo como **lector de corpus** (`listSessions` / `readSession`), nunca como backend de búsqueda.

### 1. Un índice independiente del contenido de las sesiones

El índice es el **archivo SQLite propio de este plugin**, sin interferir en absoluto con el índice oficial. Directorio de persistencia configurable, exportación/importación por instantánea y reconstrucción completa posibles. Al activarse, el anfitrión inspecciona el directorio del índice: un `index.building.sqlite` sin terminar cuando existe un índice activo se interpreta como «la última reconstrucción no llegó a acabarse» y simplemente se descarta; si falta el índice activo, el dictamen es «el fallo cayó en la ventana de renombrado» y el archivo más reciente se restaura como activo.

### 2. Las sesiones inservibles se depuran según el archivo, con actualización continua

`archive-source.ts` lee `global.archivedSessionIds` del centro de almacenamiento oficial `~/.dsh/storages/workspace.json` y mantiene **las sesiones archivadas (es decir, inservibles) fuera del índice**. El conjunto de archivo tiene un único escritor — el steward; este paquete se limita a leerlo.

La sincronización es **rodante**: `SwitchWatermarkSync` en `sync.ts` mantiene una marca de agua `version` por sesión y en cada pasada solo compara diferencias y solo reingesta las sesiones cambiadas — nunca una reconstrucción total. Los propios archivos de índice se conservan en un número limitado de copias según `archiveKeep`, y los más viejos se retiran automáticamente.

### 3. La limpieza nunca estorba al índice en servicio

La limpieza pasa por un **índice sombra**: `rebuild.ts` construye `index.building.sqlite` desde cero junto al índice activo, y durante toda la construcción **el índice activo sigue atendiendo las búsquedas** — ninguna consulta queda bloqueada. Al terminar, el cambio son tres `rename` síncronos (active → archive, shadow → active): una única ventana atómica.

De ahí la semántica de fallos: **sombra presente + activo presente = construcción sin terminar**; la sombra es entonces un desecho y se descarta sin ceremonia — el índice activo nunca estuvo en peligro.

## Instalación

```sh
# Opción 1: instalación directa desde GitHub (recomendada) — lib/ está subido al repo, sin compilación local
dsh plugin --profile web add github:drscrewdriver/dsh-search-index#master

# Opción 2: ensamblado desde una ruta local / el código fuente (véase la sección «Desarrollo»)

# Reiniciar dsh web — ¡imprescindible! Una instancia en marcha no recarga en caliente la capa de bundle
dsh web
```

Tras la instalación aparece al pie de la barra lateral un botón **«Búsqueda»**; Ajustes → Plugins gana la tarjeta **«Índice de búsqueda»**.

> ⚠️ **Alcanzabilidad de GitHub**: la instalación vía github: presupone que github.com es accesible; en una red con restricciones, configure antes un proxy o espejo operativo, o `add` se quedará colgado en la fase de descarga.

## Desarrollo

```sh
pnpm install            # incluye la cadena de paquetes cliente @deepseek-ai + tsdown/tsc
pnpm typecheck          # tsc --noEmit
pnpm build              # tsc(lib/types) + tsdown(lib/index.mjs + lib/client.js)
```

### Estructura de las fuentes

```
src/
├── index.ts            # mitad anfitrión (node): esquema Config + installSettingsSection + rutas
├── config.ts           # configuración pura compartida (enabled/defaultMode + constante de espacio de nombres, sin schemastery para el cliente)
├── host/               # el índice independiente (lado anfitrión)
│   ├── schema.ts       # tablas: docs / docs_fts(FTS5) / sessions / marcas de agua
│   ├── engine.ts       # consultas
│   ├── extract.ts      # extrae el texto buscable de los eventos de sesión (incluidos tool/call y tool/result)
│   ├── sync.ts         # SwitchWatermarkSync: sincronización incremental rodante por marca de agua de versión
│   ├── rebuild.ts      # construcción sombra + conmutación atómica + inspección de recuperación tras fallo
│   ├── archive-source.ts  # lee el conjunto de archivo para excluir del índice las sesiones archivadas
│   └── snapshot.ts     # exportación/importación de instantáneas
└── client/
    └── index.ts        # mitad navegador: entrada sidebar.footer.action + panel flotante + fila settings.general.item
```

- **Mitad anfitrión**: registra la ruta HTTP acotada `/switch-search/api` (`list-sessions` / `content-search` / `search-status`), con una barrera de confianza del navegador idéntica a la pasarela `/api` de DSH (Host en loopback o trustedHosts; cross-site rechazado).
- **Patrón de configuración**: el anfitrión registra el espacio de nombres `switch-search` mediante el servicio `settings` + un `Config` de schemastery; la mitad cliente lo lee y lo escribe en espejo con un asiento store local + `settingsScope.bind`; el módulo puro compartido `src/config.ts` mantiene el bundle del cliente libre de schemastery.
- **Cadena de compilación**: tsdown reproduce la semántica de `packages/client/tsdown.client.ts` del harness (banner `__ModuleLoader__.load`, tabla de externals por plataforma, compuerta de pureza del bundle).
- **lib/ subido al repositorio**: las instalaciones desde GitHub funcionan con el artefacto de compilación ya subido (dsh no ejecuta `prepare` en una instalación desde git); `.gitignore` no excluye `lib/`.

## Relación con la búsqueda oficial de la barra lateral

- El cuadro de búsqueda oficial vive en `sidebar.workspaces` (slot único) que un plugin externo **no puede sustituir**; este plugin **añade una entrada distinta** al pie de la barra lateral vía `sidebar.footer.action` — ambas conviven sin estorbarse.
- La búsqueda de contenido oficial está cableada a fuego en el apiproxy y solo cubre `user/message` + `assistant/message`; este plugin consulta su propio índice y abre `tool/call` + `tool/result`, para una búsqueda a nivel de herramientas.

## Compatibilidad y privacidad

- Requiere DeepSeek Harness instalado con el perfil web; **no se modifica ningún código oficial**. El índice es el archivo propio de este plugin: que el `session-query-sqlite` oficial esté activado o no carece de efecto.
- La configuración vive solo en el espacio de nombres settings de DSH y en el estado del panel del navegador; no se lee ni se envía nada más allá de los datos de búsqueda de sesiones.
- Los tipos de contrato anfitrión/cliente se declaran estructuralmente en `src/*.ts` (la cadena de paquetes cliente dsh en npm está incompleta) y se verifican contra las fuentes del harness en tiempo de compilación.

## La familia de plugins DSH de drscrewdriver

Este proyecto es uno de los plugins DSH mantenidos por [drscrewdriver](https://github.com/drscrewdriver). Si este le resulta útil, lo más probable es que los demás también:

| Plugin | En una línea |
|---|---|
| [dsh-input-traffic](https://github.com/drscrewdriver/dsh-input-traffic) | Cola de entrada en horas punta para el DSH Web GUI: control de tráfico de tres niveles, reordenación arrastrando, congelación de sesiones |
| [dsh-thinking-levels](https://github.com/drscrewdriver/dsh-thinking-levels) | Control del reasoning_effort turno a turno: planificación Auto inteligente o nivel fijo manual |
| [dsh-seatbelt-sandbox](https://github.com/drscrewdriver/dsh-seatbelt-sandbox) | Adaptador de sandbox macOS Seatbelt: loader nativo libsandbox, sucesor del deprecado sandbox-exec |
| [dsh-prime-memory](https://github.com/drscrewdriver/dsh-prime-memory) | Memoria destilada por capas: destilación automática L0~L3, inyección del recuerdo antes de cada paso del modelo |
| **[dsh-search-index](https://github.com/drscrewdriver/dsh-search-index)** | Búsqueda de sesiones en la barra lateral: conmutación título/contenido, filtro por usuario/respuesta/herramienta |

## License

MIT
