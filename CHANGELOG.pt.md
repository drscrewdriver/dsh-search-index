# Changelog

Todos os cambios importantes e correções de erros são registrados aqui. As versões seguem o versionamento semântico (instalação com `dsh plugin --profile web add github:drscrewdriver/dsh-search-index`).

## 0.7.24

- Segundo ato da issue [#4](https://github.com/drscrewdriver/dsh-search-index/issues/4): 0.7.22 resolveu «a causa da falha desta vez é exibida»; esta versão resolve «como levar o cenário embora ao tropeçar seguidamente». Novo registro de falhas em memória (buffer circular de 50, mesma categoria+detail soma contagem, nunca toca o disco) e orquestração de diagnóstico (`diagnose` / `renderDoctorReport`): relatório Markdown ordenado da causa ao efeito, cada passo com valor observado, porquê e comando executável por plataforma.
- Novo botão «Relatório de diagnóstico» no rodapé do painel: gera → copia → limpa o registro; se a área de transferência for negada, imprime no console do navegador. Duas rotas novas: `doctor` e `doctor-clear`.
- i18n: adicionado o locale Português (pt-BR) — dicionário em tempo de execução, metadados do pacote e espelhos README/CHANGELOG.

## 0.7.23

> A 0.7.22 não pôde ser publicada por resíduo de metadados staged-publish do npm registry (`409 Cannot publish over previously staged version`, npm/cli#9889); publicada como 0.7.23. **O código é idêntico ao 0.7.22**; esta entrada existe apenas para o número de versão poder pousar.

## 0.7.22

- Resultado do tratamento da issue #4 (busca de conteúdo indisponível): **a causa da falha era capturada mas não exibida**; esta versão conecta as três rupturas — `detail` devolvido pelo host, sufixo `{detail}` nas três categorias mais batidas (`drs-empty` / `drs-not-activated` / `drs-missing`) e os placeholders `{error}` acrescentados às 7 mensagens `panel.contentErr.*` nas dez línguas.
- A causa de falha da sincronização profunda fica visível no painel (bloco de falha + botão «Tentar sincronizar de novo»); `panel.deepSync.*` completado em todas as línguas (antes só zh/en).
- 9 testes novos (`client-panel-deepsync-error`, `drs-detail-surface`) fixando o caminho do detail do catch até a UI.

## 0.7.21

- **Interruptor «Memorizar histórico de busca» (desligado de fábrica)**: ao reabrir o painel restaura palavras-chave, domínio, filtros, datas, modo e **posição de rolagem**; TTL de 12 h; salva apenas a intenção de busca, nunca estado de processo; gravação em dois caminhos (debounce de 300 ms + escrita no desmonte); botão «Limpar» ao fim da linha de chips; localStorage com degradação silenciosa.
- Textos completos nas dez línguas (`card.rememberQuery*` / `panel.history.clear*`).

## 0.7.20

- **Correção do intervalo de peers que impedia o instalador de resolver rc**: o node-semver só satisfaz pre-release em intervalos quando a fronteira compartilha a mesma tupla; `0.2.1-rc.5` não satisfaz `<0.3.0-0`. Os quatro peers `@deepseek-ai/dsh-client-*` voltam à enumeração exata; `engines.dsh` mantém o intervalo delimitado. **Correção pura de metadados, zero diff em código de execução**.

## 0.7.19

- Superfície de terminal (dsh-tui / paleta de comandos do Desktop, mesma fonte): comando /sfind com duplo modo --title/--content.

## 0.7.15

- **O critério de assentamento da sincronização profunda acompanha o orçamento de rodada única do DRSC 0.2.6**: `syncing=false` já não significa «varredura concluída» — o critério passa a `syncing === false && deferred === 0`; DRSC antigo sem o campo vale 0, **comportamento idêntico linha a linha nas duas versões** (esta versão pode sair antes do DRSC 0.2.6). O teto de espera de 180 s permanece; tempo esgotado registra `drsSettled:false` e segue com a reorganização.

## 0.7.12

- **Distinção de dados frios e localização por retrocesso profundo**: correspondências por distância de turnos — ≤40 quente (salto direto), 41..200 frio (🧊, confirmação inline antes de retroceder), >200 muito frio (❄️, abre sem retrocesso automático); enriquecimento de turnos **sem tocar o DRSC** (SQL somente leitura em processo / campo `turn` do HTTP); falha degrada para quente.
- **Motor de carregamento profundo**: mesmo caminho da trilha oficial (botão «carregar registros anteriores» do host, reserva `conversation.loadOlder()`); âncora oficial `[data-chat-anchor-key]`; orçamento `ceil(gap/P)+1` com medição de largura de página; teto duro 60 s / 40 páginas.
- **HUD flutuante de retrocesso**: fica pousado após assentar (Saltar / Cancelar; tentativa de novo com orçamento extra, máx. 2 rodadas); tokens reais do host, sem preto em tema claro. Contrato: campos opcionais `turn`/`turnGap`/`onSurface`; 11 chaves novas zh/en.

## 0.7.11

- **Detecção de DRSC não ativado com comando de ativação**: os bundles do host só ativam `dependencies` de topo do perfil; o DRSC como dependência transitiva «instala mas não ativa». Sonda 404 → categoria nova `drs-not-activated`, campo `notActivated` em `search-status`, e o cartão/painel mostram `dsh plugin --profile <name> add dsh-reference-session-collector` + reinício.
- `classifyDrsFailure`: 404 sai de `drs-http-error` para categoria própria; dicionários ganham 3 chaves por língua (21 ao todo no contrato); 6 casos de teste novos (59 no total).

## 0.7.10

- Completados os dez idiomas: a fila «Conexão com o DRS», os rótulos de canal, o canal ativo e os seis códigos de diagnóstico (`card.drsReason.*` / `panel.contentErr.*`) só existiam em zh/en; ja/ko/fr/de/it/ru/es/pt já estão incluídos (18 chaves por idioma).
- Novo teste de contrato do dicionário: todos os idiomas devem ter as 18 chaves e conservar `{mode}` / `{error}` iguais ao zh.

## 0.7.9

- Corrigido o erro de `search-status` na janela de arranque (`switch-search: index engine is not open`): o motor abria só após `setImmediate` enquanto o cartão pollava desde o início; agora usa o critério `engine.isOpen`, mesmo padrão de `index-status`.
- Novo contrato de rota ponta a ponta `tests/index-route.test.mjs` (4 casos);O log de degradação sem prefixo duplicado.

## 0.7.8

- **Canal em processo somente leitura para a busca de conteúdo**: o DSH NEXT desktop responde 403 a requisições fora do renderer — a ala HTTP nunca funciona ali; `content-search` degrada agora para leitura direta do `projection.db` (forma de hit idêntica à do HTTP), restaurando a busca de conteúdo no desktop (issue #1).
- Novo `contentTransport` (`auto`/`http`/`in-process`); disciplina de somente leitura (`DatabaseSync readOnly`, jamais `openProjectionStore`, **nunca limpa o banco**); a semântica de erro divide-se em seis categorias; `search-status` ganha `mode`/`transport`/`local`/`detail`; dependência mantida external com import dinâmico; 13 casos de teste novos (`drs-local`, `drs-transport`).

## 0.7.7

- Corrigida a sincronização profunda que sempre falhava no aparelho real: o `op` ia no corpo JSON, mas a distribuição POST do DRSC só lê `?op=`; agora `POST ?op=sync` (corpo preservado por compatibilidade).
- O critério de espera usa a bandeira `syncing` real (op=status) em vez do `last_sync` da rodada anterior; resultado registrado em `index-status.deepSync.drsSettled`.
- Documentado que **não se pode instalar junto** o pacote fundido `dsh-session-steward` (≤0.5.x) — rota duplicada; adicionada a **matriz de compatibilidade (0.7.7 medida)**: 9 rc testados célula a célula na fazenda (`docs/compat-matrix-0.7.7.md`).

## 0.7.6

- Corrigido o cartão de configurações que não via o progresso da sincronização profunda: `index-status` ganhou a superfície `deepSync` (0.7.5 só a expunha na página de busca).

## 0.7.5

- Novo botão «Sincronização profunda (drsc)» (rodapé da busca + cartão): POST drsc {op:'sync'} reescaneia devagar para reparar a biblioteca de projeção → poll de op=status até busy=false → reorganização não destrutiva do índice local; progresso via index-status.deepSync.

## 0.7.4

- Corrigido o clique em resultado que não saltava no formato de página inteira 017+: o SwitchPanel de página recebia um `open` noop (só `onClose` era passado); agora a página volta à sessão anterior e abre a alvo.

## 0.7.3

- Corrigido o encaminhamento same-origin do DRS na rota: o Host do chamador é repassado ao DrsCorpusSource (antes caía em 127.0.0.1:8080 enquanto o DRS real serve na porta do próprio host, causando fetch failed).

## 0.7.1

- Reembolo de versão (conteúdo idêntico ao 0.7.0): o pnpm cacheia tarball `file:` homônimo por conteúdo, e sobrescrever a mesma versão não força re-resolução; o patch força a reanálise.

## 0.7.0

- **O subdomínio de busca volta do dsh-manage-session para este pacote, com a dependência DRS preenchida**: dependência dura `dsh-reference-session-collector`; a busca de conteúdo passa pela biblioteca de projeção DRS (erro explícito quando inalcançível, sem recair no índice local); `corpusSource`/`drsBaseUrl` no plano de configuração; novo `src/host/settings-bridge.ts` (ponte ≤0.1.5 + projeção somente leitura moderna); enumeração de hosts ampliada a 18 itens.
- **Entrada de dupla forma (cisão 017)**: ≥0.1.7 usa linha `sidebar.panellist` + página inteira no `main` (`variant:'page'`); <0.1.7 mantém o dialog do rodapé; os formulários são mutuamente exclusivos por sondagem de assento.
- **Regressão de namespace**: `manage-sessions-search` → `switch-search` (chave estável sem migração; switches voltam ao padrão após a atualização); diretório de índice continua `~/.dsh-switch-search`; conjunto de arquivamento somente leitura; exclusão inline vira sonda cross-plugin (`directDelete` → `/manage-session/api/session-history-purge`).

0.6.7: adenda de enumeração de hosts para DSH 0.2.1-rc.3 (bump só de declaração; plano de contrato com zero diff).

## 0.6.6 (2026-10-18)

- hosts: acrescentada a enumeração declarativa 0.2.1-rc.2 (34/34 peers `@deepseek-ai/*` verificados pacote a pacote no npm; este plugin não toca `ctx.web` provider nem o slot `conversation.input.model.label`; zero mudança de código — versão pura de metadados; célula rc.2 da fazenda a postos).

## 0.6.5 — Adaptação ao DSH 0.2.1-rc.1 (correção da costura webStartup)

- **Explodia ao carregar**: desde 0.2.1-a.2 o host removeu `webRuntime` e renomeou para `webStartup`. Esta versão injeta `webStartup` e lê pela cadeia de reserva de nome duplo (`ctx.webStartup ?? ctx.webRuntime`); comportamento inalterado no 0.2.0.
- **Normalização de manifestos**: `engines.dsh`, os quatro peers `@deepseek-ai/dsh-client-*` e o `dsh.plugin.json` unificados na enumeração exata `0.2.0-rc.1 || 0.2.0-rc.2 || 0.2.1-rc.1` (sem intervalos nem sentinelas `-0`); duplo manifesto com o mesmo número 0.6.5; devDep `dsh-client-ui-slots` para `0.2.1-rc.1`.

## 0.6.2 — Rodapé da barra lateral com entrelinha reduzida e centro forçado (inclui correção de entradas de terceiros)

- **Linha contêiner**: o convênio do slot `sidebar.footer.action` sobe para `justify-content:center` (todas as entradas, incluídas terceiros) e `row-gap` 2px → 0.
- **Entrada deste plugin**: botão 42px → 32px, padding lateral simétrico `0 10px`; o rodapé de duas linhas passa de 86px a 64px; forma de trilho recolhido inalterada.
- **Correção de terceiros**: o «contexto insight» do dsh-context (`.lc-ov-entry`) é alinhado aoconvênio com `!important`; o nome de classe é fixo no código-fonte do dsh-context e estável entre versões (medido 0.56.1 / 0.60.0).

## 0.6.1 — Correção do «salto para conteúdo» que falhava em silêncio nos hosts 0.1.7/0.2.0

- **Sintoma**: clicar num resultado fechava o painel sem abrir a sessão alvo, sem erro no console — sempre nos hosts 0.1.7 e 0.2.0.
- **Causa-raiz**: a navegação de sessões saiu do contrato `sessions` entre 0.1.5 e 0.1.7 (fica com `uiWorkspace.openSession`); a guarda `typeof sessions.open === 'function'` transformava o método ausente em no-op silencioso. A quebra já acontecia no 0.1.7 — o julgamento «código zero» do 0.6.0 só conferiu slots/settings, não o consumo de `sessions`.
- **Correção**: dispersão de abertura convergida para `openSessionThrough` (`src/client/host-api.ts`) — `uiWorkspace.openSession` primeiro (0.1.7+), reserva `sessions.open`, silêncio quando ambos faltam; novo `tests/client-open-session.test.mjs`.

## 0.6.0 — Adaptação ao DSH 0.2.0-rc.1 (troca de geração de metadados sem modificar uma linha de código)

- **Troca de geração peer/engines**: os 4 peers dsh-* e as duas ocorrências de `engines.dsh` em `package.json` e `dsh.plugin.json` passam a `>=0.2.0-rc.1 <0.2.1-0` (janela rc travada, reavaliação a partir de 0.2.1).
- **Código zero**: o consumo do host é puramente caller (`ctx.get('slots'/'locale'/'configForms')` de leitura suave + interfaces estruturais locais); o 0.2.0 não mexeu nos contratos slots/settings nem na contabilidade de assentos.
- **devDependencies**: `dsh-client-ui-slots` → `0.2.0-rc.1`; `@deepseek-ai/cordis` → `^4.0.4`.
- **Gerência de dependências**: o PM autoritativo deste repo é pnpm; `pnpm-lock.yaml` regerado, `package-lock.json` obsoleto removido.
- **Documentação**: matriz de compatibilidade e frase de linha principal do README (zh/en) atualizadas para 0.2.0; a linha DSH 0.1.7 segue servida pela 0.5.7 (dist-tag `dsh-0.1.7`, branch `compat/0.1.7`).

> Nota: as versões entre 0.2.0-beta.5 e 0.5.7 pertencem à linha DSH 0.1.x — veja o branch `compat/0.1.7` e a dist-tag npm `dsh-0.1.7`.

## 0.2.0-beta.5 — Na coluna estreita, a «tecla» cede o passo e o nome das duas entradas se lê inteiro

- **Sintoma (exposto pelo beta.4)**: a linha `sidebar.footer.action` precisa comportar «🔍 Buscar Ctrl K» e «🧭 Mordomo de sessões»; a largura natural conjunta mede **240px** e a coluna estreita (~215–225px) não comporta — todo o déficit recaía sobre a pílula de busca e a etiqueta encolhia para um «Bus».
- **Quem deve ceder**: a tecla é **pista** (repetida no tooltip e na barra de rodapé); a etiqueta é a **identidade**. `container-type:inline-size` + `@container` abaixo de 132px esconde `.dsws_kbd` (economiza 43px). Medido no Chrome: 180–230px mantém as etiquetas 28/28 inteiras com a tecla oculta; ≥240px a tecla volta.
- **O trilho fica de fora**: `container-type` encolhia o root do trilho `flex:none` a 0px — `.dsws_rootRail` reverte a `container-type:normal`; botões do trilho voltam a 28×28; padding da tecla `0 5px` → `0 4px`.

## 0.2.0-beta.4 — A entrada da barra lateral adapta-se a compartilhar linha com o «mordomo de sessões»

- **Ceder, não monopolizar**: `.dsws_root` deixa de ser `flex:none;width:100%` e passa a `flex:1 1 auto;min-width:0` (mesmo formato do controle oficial do `ui-settings-general` no mesmo assento); com espaço curto a etiqueta trunca primeiro.
- **Trilho recolhido alinhado aos 36×36 oficiais**: `wide=false` usa `.dsws_buttonRail` (`36×36`, `border-radius:50%`), root mantém `flex:none`; conteúdo alinhado à esquerda, na mesma coluna do ícone oficial «Configurações» logo abaixo.
- **Não mudado**: interação, painel, índice, rotas e namespace `switch-search`; desligar `enabled` continua removendo a entrada inteira (incluídas `⌘K` / `Ctrl K`).

## 0.2.0-beta.1 — Renomeado a dsh-search-index; o histórico de sessões migra para o mordomo de sessões

- **Mudanças destrutivas**: o pacote renomeia `dsh-session-search-toggle` → **`dsh-search-index`** (id de registro, patch cordis e repo acompanham); o namespace de configurações **continua `switch-search`** (chave de armazenamento — mudá-la perderia a configuração do usuário). A consulta/limpeza de arquivamento (entrada «sessões arquivadas») migra para a aba «Sala de arquivos» do **`dsh-session-steward`**; este pacote só **lê** o conjunto de arquivamento — um único escritor: o steward.
- **Túmulos explícitos**: `list-archived` / `archive-prune` agora respondem **HTTP 410** apontando para `/session-steward/api/session-history-list|prune` — o bundle cliente antigo deve falhar alto e saber para onde ir, não levar 404 silencioso lido como «arquivamento quebrado».
- **Preservado**: todo o índice independente — sincronização incremental, reorganização não destrutiva, instantâneos, inspeção de recuperação; `archiveKeep` conta **arquivos de índice**, alheio ao arquivamento de sessões.

## 0.2.0-beta.3 — A contagem de arquivadas aponta o caminho, o interruptor de ativação funciona de verdade, 13 seletores órfãos removidos

- **«Sessões arquivadas» era um número órfão**: a pílula passa a **«{n} sessão(ões) arquivada(s) excluída(s)»** (é exclusão do índice, não tarefa pendente) com a nota de quem é o dono. Novo `src/host/peers.ts` resolve `dsh-session-steward` a partir do **grafo de módulos do próprio plugin**, em três estados `installed`/`missing`/`unknown`: «não instalado» só quando a resolução falha de fato — **nunca se reporta «ilegível» como «não instalado»**.
- **«Ativar busca de sessões» era um interruptor morto** — nenhum consumidor; agora entrada e cartão compartilham um único `entryScope`, a entrada assina `enabled` via `useSyncExternalStore`, e desligar remove a entrada inteira (com o acorde). Sem conseguir ler a configuração, **a entrada permanece visível**.
- **Limpeza**: 13 seletores órfãos removidos (10 do painel de arquivamento migrado + 3 classes mortas de Toggle); folha cai de 53 para 50 classes, **órfãos 0**; novos `client-styles.test.mjs` (zero classe órfã + binding único) e `host-peers.test.mjs` (três estados); ambos os cenários de regressão foram comprovados fazendo-as falhar e revertendo.

## 0.2.0-beta.2 — Tecla de invocação e pistas por plataforma; ordenação de resultados, títulos em tempo real e uma rodada de correções na cadeia de busca

- **Novo: um acorde invoca o painel** — `⌘K` (macOS) / `Ctrl K` (Windows/Linux) em qualquer ponto da barra lateral, equivalente ao clique; a tecla some junto com a entrada quando o plugin está desligado. **Pistas por plataforma** com degradação em cascata UA-CH → `navigator.platform` → string UA; **o aviso e a ligação saem da mesma fonte** (`isInvokeChord`), nunca «tecla prometida, tecla interceptada». `.dsws_kbd` auto-largura sem espremer a etiqueta. Novo `client-platform.test.mjs` (funções puras + estrutura do artefato; regressão comprovada).
- **Corrigido: busca de conteúdo permanentemente vazia** — a chave do pedido estava escrita à mão em dois lugares com formas diferentes (`query\0type\0sortBy` vs `query\0type`); convergida para um dono único `contentRequestKey`; `client-panel-key.test.mjs` fixa o invariante estrutural (literal de separador NUL exatamente um; auxiliar compartilhado referenciado ≥3 vezes).
- **Novo: ordenação de resultados (relevância/data) + títulos em tempo real** — o host assina `session/event` e dobra `session/title` no índice na hora (`refreshTitles`, rajadas mescladas em 250 ms, **a marca de água não se move**); ordenar por data usa o `updatedAt` da sessão e acontece **antes do truncamento**; preferência em localStorage com degradação silenciosa; a linha de conteúdo passa a mostrar o tempo da sessão.
- **Novo: inspeção e recuperação de reconstrução interrompida** — sombra órfã com ativo presente é descartada; ativo ausente rola o arquivo de arquivamento mais recente de volta; leitura de estado não fica mais presa em «lendo…».
- **Otimizações**: sombra de rebuild com o índice ativo servindo; checkpoint em transações de 50 sessões; PRAGMA tuning; `better-sqlite3` como optionalDependency com reserva `node:sqlite` e campo `driver` exposto; logs `[switch-search]` com taxa/eta.
- **Novo: exclusão lógica de arquivadas no índice (schema v4)** + painel de arquivamento somente leitura com edição; alinhamento de estilo DSH (trigger 42px, pílulas de estado por token, sombra `--dsw-shadow-lv3`, mask do Modal).
- **Refatoração do motor de busca**: tokenização por palavra com `Intl.Segmenter` no lugar de trigram (índice ~1/4; consulta de 2 caracteres volta a ser indexada; prefixo `*`); FTS5 external content (`content='docs'`, ~metade do armazenamento); caminho de consulta sem a segunda varredura `IN (...)`; schema v3 reinge sozinho na próxima passada.
- **Refatoração: cartão de configurações independente (padrão thinking-levels)**: `settings.plugin.item` com duplo `id`+`key`, namespace `switch-search`, `useSyncExternalStore` + `scope.set` imediato; dicionário locale `src/client/locales.ts`; callers de host convergidos para `src/client/host-api.ts`.
- **Novo: motor de índice FTS5 próprio** (sem o índice oficial): arquivo próprio `0x53574954` em `~/.dsh-switch-search/` (cobrível por config/env), sincronização por marca de água (30 s), reorganização sombra+troca atômica com arquivamento `archiveKeep`, instantâneos JSON Lines `index-export`/`index-import`, rotas `index-status`/`index-rebuild` com o mesmo fence.
- **Compatibilidade dupla de versão (0.1.1-rc.2 / 0.1.2-rc.1)**: um único artefato sem ramificação de versão — nenhum dos pacotes motor é importado, o assento store é local (~30 linhas cobrindo `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }`), tipos espelhados estruturalmente; `engines.dsh` reduzido a `>=0.1.0-rc.7 <0.2.0-0`.
- **Validação**: 15/15 a 24/24 conforme o conjunto (motor, arquivamento, recuperação, plataforma, chave de painel, store); cenários de regressão comprovados fazendo cada teste novo falhar e revertendo.
