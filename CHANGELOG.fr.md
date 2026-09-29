# Changelog

Toutes les modifications importantes et corrections de bugs sont consignées ici. Les versions suivent la gestion sémantique de versions (installation : `dsh plugin --profile web add github:drscrewdriver/dsh-search-index`).

## 0.6.0 — Adaptation à DSH 0.2.0-rc.1 (changement de génération des métadonnées sans aucune modification de code)

- **Changement de génération des peer/engines** : les 4 peer dsh-* (`dsh-client-locale` / `dsh-client-ui-settings` / `dsh-client-ui-settings-general` / `dsh-client-ui-slots`) ainsi que les deux occurrences de `engines.dsh` dans `package.json` et `dsh.plugin.json` sont remplacées par `>=0.2.0-rc.1 <0.2.1-0` (fenêtre rc verrouillée, réévaluation à partir de 0.2.1).
- **Zéro modification de code** : la surface de consommation du plugin vis-à-vis de l'hôte est un pur caller (lectures souples via `ctx.get('slots'/'locale'/'configForms')` + interfaces structurelles locales) ; 0.2.0 par rapport à 0.1.7 n'a ni touché aux contrats slots/settings ni au registre des sièges.
- **Changement de génération des devDependencies** : la devDep `dsh-client-ui-slots` passe de `^0.1.0-rc.6` à `0.2.0-rc.1` (alignement sur le nouvel optional peer, pour éviter un arbre d'installation mal apparié) ; la devDep `@deepseek-ai/cordis` passe de `^4.0.1` à `^4.0.4` (la lignée de paquets 0.2.0-rc.1 exige `~4.0.4`).
- **Gestion des dépendances** : le gestionnaire de paquets faisant foi dans ce dépôt est pnpm (`pnpm-workspace.yaml` + pnpm-lock v9) ; `pnpm-lock.yaml` est régénéré et l'obsolète `package-lock.json` (resté à l'ère 0.5.0) est supprimé.
- **Documentation** : la matrice de compatibilité des README (zh/en) et la phrase de ligne principale sont mises à jour vers 0.2.0 ; la ligne DSH 0.1.7 continue d'être servie par 0.5.7 (dist-tag `dsh-0.1.7`, branche `compat/0.1.7`).

> Remarque : les versions entre 0.2.0-beta.5 et 0.5.7 relèvent de la ligne DSH 0.1.x ; voir la branche `compat/0.1.7` et le dist-tag npm `dsh-0.1.7`.

## 0.2.0-beta.5 — Dans une colonne étroite, la « touche » cède la place et le nom des deux entrées se lit en entier

### Corrections (révélées par les tests en conditions réelles de beta.4)
- **Symptôme** : après que beta.4 a mis fin à l'occupation exclusive de la ligne par cette entrée, la ligne `sidebar.footer.action` doit accueillir à la fois
  « 🔍 Recherche Ctrl K » et « 🧭 Steward de sessions ». Mesuré en réel, la largeur naturelle des deux chaînes totalise **240px**,
  alors qu'une colonne étroite (environ 215–225px) n'y parvient pas : ce plugin est en `flex:1`, le wrapper du steward en `flex:none` (qui ne cède jamais),
  de sorte que **tout le défaut pèse sur la pastille de recherche**, dont l'étiquette est le seul élément réductible — elle a été comprimée jusqu'à ne plus montrer qu'un « 搜 ».
- **Qui doit céder** : la touche est un **rappel** (le tooltip de l'entrée et la barre du bas du panneau répètent tous deux le même accord),
  l'étiquette, elle, est l'**identité** de l'entrée. On fait donc céder la touche : `.dsws_root` déclare `container-type:inline-size`,
  et en dessous de 132px de large, il replie `.dsws_kbd` via `@container` (43px gagnés).
- **Mesuré en réel (Chrome, une sonde reproduisant le CSS et le DOM réels des deux entrées)** : pour une largeur de colonne de 180–230px, l'étiquette reste complète 28/28, la touche se masque automatiquement,
  zéro débordement pour les deux entrées ; à partir de 240px la touche réapparaît. La ligne de base d'avant modification ne montrait plus que 12/28 de l'étiquette à 220px.
- **La forme rail doit être exemptée** : `container-type` apporte aussi la containment de taille inline-size, ce qui fait **s'effondrer à 0 de large** la boîte racine du rail en `flex:none`
  (constaté en réel : root=0 alors que le bouton reste à 36px, débordant hors de la boîte). D'où un retour explicite à `container-type:normal` sur `.dsws_rootRail`.
- **Retour du rail à 28×28** : la boîte de contenu du rail ne fait que 36px (rail de 56px − 2×10px de padding) ; le boîtier de contrôle officiel de 36×36
  repose sur l'hypothèse **d'un seul contrôle par ligne** ; avec les deux entrées sur la même ligne, 36+28=64px déborde de 14px. On prend 28+28=56px,
  un poil plus étroit que les 32+28=60px d'avant modification.
- Padding de la touche `0 5px` → `0 4px` (2px à sa propre charge).

## 0.2.0-beta.4 — L'entrée de la barre latérale s'adapte au partage de ligne avec le « steward de sessions »

### Changements
- **Céder la place, pas tout occuper** : `.dsws_root` était à l'origine `flex:none;width:100%` et occupait toute la ligne dans le flex-ligne `sidebar.footer.action`,
  repoussant l'entrée voisine du steward en fin de ligne, la pastille de 42px étant de surcroît désalignée avec le bouton icône d'en face. Passage à `flex:1 1 auto;min-width:0`, bouton `flex:1;min-width:0` —
  isomorphe au contrôle officiel du même siège (`.trigger{flex:1;min-width:0;height:42px;border-radius:12px;padding:0 10px 0 8px}` de `ui-settings-general`).
  À défaut d'espace, c'est d'abord l'étiquette qui s'abrège (`.dsws_buttonLabel` a déjà son ellipsis), sans plus écraser les voisins.
- **Rail replié aligné sur le 36×36 officiel** : quand `wide=false`, le bouton passe à `.dsws_buttonRail` (`36×36`, `border-radius:50%`),
  et l'élément racine gagne `.dsws_rootRail` pour rester `flex:none` ; alignement sur la spécification rail de Figma (rail 56px / padding 10px / boîtier de contrôle 36×36).
- **Contenu aligné à gauche** : suppression de `justify-content:center`, l'icône se met dans la même colonne que la ligne officielle « Réglages » juste en dessous.

### Ce qui n'a pas bougé
- Interactions, panneau, index, routes, espace de noms de réglages `switch-search` : strictement rien n'a bougé ; quand `enabled` est coupé, toute l'entrée (y compris `⌘K` / `Ctrl K`) disparaît comme avant.
- La coopération ne se joue que dans le CSS respectif des deux plugins : celui-ci ne référence aucune valeur du steward et ne présume ni de sa présence ni de son absence.
- Les nouveaux sélecteurs sont tous référencés par le code ; le « zéro classe orpheline » de `tests/client-styles.test.mjs` continue d'être vrai.

## 0.2.0-beta.1 — Renommage en dsh-search-index, l'historique des sessions est confié au steward

### Changements cassants

- **Renommage du paquet** : `dsh-session-search-toggle` → **`dsh-search-index`** (id d'enregistrement client, id de patch cordis et adresse du dépôt renommés en même temps). L'espace de noms des réglages **reste `switch-search`** : c'est une clé de stockage, la changer perdrait la configuration des utilisateurs, on refuse donc délibérément de la faire suivre le nom du produit. L'ancien nom reste résoluble via la redirection GitHub, mais passez la dépendance de profil au nouveau nom pour éviter que les deux noms coexistent.
- **Sortie du domaine de l'historique de sessions** (parcours des archives + nettoyage des archives, y compris l'entrée « sessions archivées » de la barre latérale et le « voir les archives » de la carte de réglages) → vers l'onglet « Salle des dossiers » du nouveau paquet **`dsh-session-steward` (steward de sessions)**.
- **Ce paquet n'écrit plus l'ensemble d'archives** : `pruneArchiveFile` et les deux méthodes `list-archived` / `archive-prune` sont sortis avec lui. Il **lit** toujours l'ensemble d'archives officiel (`readArchiveSet`) pour écarter les sessions archivées de l'index — l'ensemble d'archives n'a qu'un seul écrivain : le steward. Le contrat de format de fichier est décrit dans `dsh-归档文件格式契约-20260914.md`.
- **Pierre tombale explicite sur les anciens noms de méthode** : `list-archived` / `archive-prune` répondent désormais **HTTP 410** avec une erreur claire pointant vers `/session-steward/api/session-history-list|prune`. Un rafraîchissement du navigateur ne recharge pas la moitié hôte ; le vieux bundle client doit **échouer bruyamment en étant informé où aller**, plutôt que de recevoir un 404 silencieux qu'on lirait comme « les archives sont cassées ».

### Suppressions

- `src/client/archive-panel.tsx` (migré vers le steward), la fonction d'écriture `pruneArchiveFile` de `src/host/archive-source.ts`, l'entrée d'archives de la carte de réglages et la surface d'injection `openSession` de `IndexBlock`, ainsi que les clés de libellés concernées.
- Le cas de test prune est parti avec l'implémentation : la couverture suit l'**implémentation**, elle a été reconstruite côté steward dans `tests/history.spec.ts` (8 cas), afin d'éviter un trou où « aucun des deux paquets ne teste ».

### Conserves

- Toutes les capacités de l'index indépendant : synchronisation incrémentale, consolidation non destructive (shadow + bascule atomique + archives bornées `archiveKeep`), export/import d'instantanés, inspection de récupération de l'index, explicitation des échecs de lecture d'état. `archiveKeep` désigne le nombre de copies de **fichiers d'index** conservées, sans rapport avec l'archivage des sessions ; il reste donc dans ce paquet.

## 0.2.0-beta.3 — Le compteur d'archives indique désormais la route, l'interrupteur d'activation marche pour de bon, 13 sélecteurs orphelins purgés

### Correction : le compteur `sessions archivées` n'était le dossier de personne — désormais il indique la route

- **Symptôme** : une pastille de la carte de réglages annonçait « sessions archivées : 72 », que ce plugin **ne peut pas gérer** (parcours et nettoyage des archives ont migré vers le steward). L'utilisateur voyait un chiffre sans rien pouvoir cliquer — à lire comme une fonction cassée.
- **Remède** : le libellé de la pastille passe de `sessions archivées : {n}` à **`{n} session(s) archivée(s) exclue(s) de l'index`** (précisant qu'il s'agit de la **quantité exclue par l'index**, pas d'une liste de tâches), avec en dessous une phrase d'appartenance — qui gère quoi, et ce que fait ce plugin.
- **Ne pointer que la bonne route** : l'hôte gagne `src/host/peers.ts`, qui résout `dsh-session-steward` depuis le **graphe de modules du plugin lui-même** (autrement dit les `node_modules` du profil). Trois états `installed` / `missing` / `unknown` : « actuellement non installé » n'est affiché **que si la résolution échoue de façon certaine** — dire à un utilisateur d'installer un plugin qu'il a déjà est pire que se taire ; les autres erreurs du résolveur (manifeste corrompu, etc.) partent toutes en `unknown`, avec le libellé neutre.
- La base de résolution de `probePeer(name, base?)` est injectable : la branche « présent mais illisible » devient reproductible en test (avec un fixture `package.json` corrompu, désigné via la base injectée).

### Correction : `activer la recherche de sessions` était un interrupteur mort — désormais il commande vraiment

- **Symptôme** : `enabled` avait un type, une valeur par défaut, un interrupteur, un libellé (« afficher l'entrée « Recherche » au bas de la barre latérale »), mais **pas un seul second consommateur dans tout le dépôt** : l'entrée s'enregistrait sans condition et l'interrupteur ne commandait rien.
- **Remède** : le binding de l'espace de noms des réglages est résolu **une seule fois** (`entryScope`), l'entrée et la carte de réglages **partageant le même** binding ; l'entrée s'abonne via `useSyncExternalStore` et lit `enabled` — coupé, toute l'entrée (touche d'invocation `⌘K` / `Ctrl K` comprise) disparaît d'un bloc : « ce plugin est-il activé » n'a toujours qu'une seule réponse.
- Quand les réglages sont illisibles (pas de `settingsScope`, état illisible), **l'entrée reste visible** : ne pas lire le choix de l'utilisateur ne vaut pas demande de fermeture ; et masquer l'entrée, c'est aussi cacher « l'unique chemin de retour vers le panneau ».

### Nettoyage : 13 sélecteurs orphelins (dont 10 issus du panneau d'archives déjà parti)

- Lors du déménagement du panneau d'archives chez le steward, les sélecteurs étaient restés sur place et continuaient d'être packagés : `dsws_archRow` / `dsws_archCheck` / `dsws_uuid` / `dsws_dialogHead` / `dsws_dialogTitle` / `dsws_dangerBtn` / `dsws_editActive` / `dsws_linkBtn` / `dsws_indexLine` / `dsws_setRoot`. Une feuille de styles pleine de styles « pour un panneau qui n'existe plus » donnait à lire « ce plugin gère encore ce coin » — exactement le malentendu que la scission devait enterrer.
- 3 classes mortes purgées en plus : `dsws_switch` / `dsws_switchTrack` / `dsws_switchThumb` — le `Toggle` est passé depuis longtemps aux styles purement en ligne, ces sélecteurs de classes n'ont jamais été référencés.
- La feuille de styles passe de 53 classes à 50, **zéro orphelin**.
- tests : nouveau `tests/client-styles.test.mjs` — la feuille de styles ne peut avoir qu'un seul propriétaire ; **chaque** classe doit être référencée dans le code, sinon échec (c'est précisément la raison pour laquelle ces 13 classes ont pu se cacher jusqu'ici). Est également épinglé « le binding des réglages n'a qu'un seul propriétaire » (`bind()` exactement une fois + au moins deux consommateurs) — la ligne de défense structurelle contre l'interrupteur mort.
- tests : nouveau `tests/host-peers.test.mjs` (`node --import tsx`) couvrant la classification en trois états.
- **Réfuté en pratique** : réinsérer une classe orpheline → `client-styles` fait immédiatement `exit 1` ; changer le filet de `probePeer` pour renvoyer toujours `missing` → `host-peers` fait immédiatement `exit 1` ; une fois les deux rétablis, tout redevient vert.

## 0.2.0-beta.2 — Touche d'invocation et raccourcis par plateforme ; tri des résultats, titres en temps réel et une salve de corrections de la chaîne de recherche

### Ajout : touche d'invocation + raccourcis affichés selon la plateforme (style de pop-up inspiré de `@hyzyn/dsh-search`)

- **Un accord invoque le panneau** : **`⌘K` (macOS) / `Ctrl K` (Windows/Linux)** depuis n'importe où dans la barre latérale ouvre le panneau de recherche, équivalent au clic sur l'entrée. La liaison pend au composant d'entrée, pas au niveau du plugin — quand l'entrée est fermée, l'accord disparaît avec elle : « le plugin est-il actif » n'a qu'une seule réponse.
- **Raccourcis affichés selon la plateforme** : à droite de l'entrée de la barre latérale comme dans la nouvelle barre de touches du bas du panneau, la pastille de la touche d'invocation est rendue ; la touche de fermeture est pareillement `esc` (macOS) / `Esc` (ailleurs). Jusqu'ici le plugin n'affichait **aucun raccourci** : l'entrée ne se découvrait qu'à la souris.
- **Identification de plateforme à trois étages de repli** : `UA-CH (navigator.userAgentData.platform) → navigator.platform → chaîne UA`. En copiant la simple détection `navigator.platform` du plugin de référence, cette API renvoie une chaîne vide sous certaines configurations de confidentialité, dégradant silencieusement un utilisateur Mac vers le vocabulaire Windows ; désormais une chaîne vide poursuit l'interrogation en aval, et si rien ne répond on **retombe sur `Ctrl`/`Esc`** — `Ctrl` se comprend partout, pas `⌘`.
- **Avis et liaison de la même source** : l'accord sur la pastille et celui réellement reconnu par `keydown` sortent du même endroit (`isInvokeChord` dans `src/client/platform.ts`), chacun exigeant de l'autre « l'autre touche modificatrice doit être absente » pour distinguer les deux plateformes. Impossible donc d'avoir ces faux avis sans réponse du genre « `⌘K` affiché en bas, mais le gestionnaire ne reconnaît que `Ctrl+K` ».
- **Touche adaptative** : `.dsws_kbd` est rendu avec `min-width:18px; width:auto` — `Ctrl K`, `⌘K`, `Esc` s'affichent en entier sans se comprimer ; l'étiquette texte de l'entrée devient réductible en ellipsis, pour que la touche ne pousse pas l'étiquette hors du bouton.
- tests : nouveau `tests/client-platform.test.mjs` (`node --import tsx`, tests directs des fonctions pures de `src/client/platform.ts` : repli à trois étages avec chaîne vide en mode privé, quatre jeux de vocabulaires, table de vérité des accords, et la cohérence inter-moitiés « la touche annoncée par chaque plateforme doit être acceptée par le gestionnaire » ; plus des épinglages structurels sur l'**artefact** — le niveau UA-CH n'a qu'un seul propriétaire, `isInvokeChord` référencé au moins deux fois (définition + écouteur), trois touches affichées, surfaces d'accords des deux plateformes de même source). **Réfuté en pratique** : remplacer l'`isInvokeChord(...)` de l'écouteur par un test littéral fait échouer immédiatement les assertions d'artefact.

### Affinement : l'ombre du flottant passe aux jetons officiels

- L'ombre du panneau était codée en dur `0 8px 28px rgba(0,0,0,.16)` ; elle devient `var(--dsw-shadow-lv3, 0 8px 28px rgba(0,0,0,.16))` — le même étage d'ombre flottante que les `Menu` / `Modal` / `Toast` / `HoverCard` officiels, variant avec le thème ; l'ancienne valeur reste en repli `var()`, les vieux hôtes ne régressent pas. Le rayon de 12px coïncidait déjà avec la carte déroulante officielle (`r12` du `Menu`) ; le voile reprend `--dsw-alias-bg-mask-1` + `--dsw-mask-blur`, même source que le `Modal` officiel.

### Correction : la recherche par contenu restait éternellement vide — la clé de requête avait deux propriétaires

- **Symptôme** : la recherche par contenu obtenait les bons résultats, mais l'interface restait bloquée en état de chargement, sans rien afficher. Côté hôte, le réel était impeccable — `content-search` renvoyait des occurrences aussi bien pour le chinois (`插件`, `适配`) que pour l'ASCII (`dsh`) ; ni l'index ni la tokenisation n'avaient de problème.
- **Cause racine** : la clé de requête était **écrite à la main en deux exemplaires**. L'effect qui lance la requête assemblait une clé à trois segments `query\0type\0sortBy`, tandis que le rendu, pour juger « ce résultat appartient-il à la saisie courante », en assemblait une à deux segments `query\0type`. La version qui a ajouté le tri n'a touché que le côté écriture : les deux clés ne coïncideront jamais, et `activeContent` retombait à chaque cycle dans la branche vide `loading` — les résultats arrivaient, se parseaient, puis étaient jetés.
- **Remède** : la clé converge vers un **propriétaire unique** — un `contentRequestKey(normalized, contentType, sortBy)` partagé par les deux côtés. Pas question de « rattraper le segment manquant sur le second exemplaire » : il resterait deux propriétaires, et le prochain ajout d'une dimension de saisie referait dériver le tout.
- **Anti-régression** : nouveau `tests/client-panel-key.test.mjs`. Le chemin de rendu React n'entre pas dans cette couverture (`client-store.test.mjs` déclare d'emblée ne pas couvrir le GUI) ; on épinglera donc des invariants structurels — le produit ne doit contenir qu'**exactement un** template literal avec séparateur NUL, et l'assistant partagé doit être référencé au moins 3 fois (définition + deux points d'appel). L'assertion a été éprouvée : réécrire la seconde clé dans le produit la fait échouer, puis on a rétabli.

### Ajout : tri des résultats (pertinence / date) + titres renommés inscrits dans l'index en temps réel

- **Bascule de tri** : au-dessus des résultats de la recherche par contenu, une nouvelle bascule « Pertinence / Date », sur la même ligne que le filtre de type, alignée à droite. « Pertinence » par défaut conserve le comportement existant ; « Date » trie en ordre décroissant par **dernière activité de la session**, puis par force de correspondance à temps égal.
- **Deux champs temporels, chacun son rôle** : chaque résultat livre ensemble `time` (horodatage du **document** au mieux apparié) et `updatedAt` (horloge au niveau **session**). Le tri emploie la seconde — l'heure du document touché ne dit rien de la fraîcheur de la session. Les deux champs sont fournis ; le front-end peut retrier à sa guise.
- **Le tri précède la troncature** : l'hôte trie d'abord, puis tronque selon `limit`. Tronquer d'abord pour trier ensuite ferait que le mode « Date » ne réordonnerait que le top N déjà coupé par pertinence — autant ne rien trier.
- **Préférence persistée** : le choix de tri vit dans le `localStorage` (clé `dsh-search-index.sortBy`) et survit aux rechargements ; en mode privé, l'échec de lecture/écriture retombe silencieusement sur la pertinence.
- **Compatibilité avec la moitié hôte vieillissante** : un hôte qui ignore `sortBy` retombe sur la pertinence au lieu d'erreur ; le client ne retrié localement que si chaque résultat porte un `updatedAt` numérique, pour ne pas calculer de NaN sur d'anciennes données.
- **L'heure rejoint les lignes de contenu** : la ligne d'en-tête des résultats de contenu n'affichait que l'étiquette de type, l'heure n'apparaissant que dans les résultats de recherche par titre. Trier par « Date » sans voir aucune date, c'est être incapable de vérifier que le tri s'applique. Désormais, à droite de l'étiquette de type figure la **dernière activité de la session** (`updatedAt`) — le champ utilisé par le tri, et la même heure que celle vue dans la ligne de titre.
- **Titres en temps réel** : un renommage ajoute un événement `session/title` log-only (sans toucher la face modèle). Jusqu'ici il fallait attendre la prochaine ronde de synchronisation par filigrane (30 s par défaut) pour que l'index le reflète ; désormais l'hôte s'abonne à `session/event` et, à l'occurrence, replie le titre de façon ciblée par id (`SwitchWatermarkSync.refreshTitles`), sans attendre le balayage complet. Les événements sont fusionnés par rafales de 250 ms ; aucune intervention si `autoSync: false` ; **le filigrane ne bouge pas** — un rafraîchissement de titre ne fera jamais prétendre à l'index qu'il a lu ce qu'il n'a pas lu ; la ronde suivante réingère la session selon la version bumpée.
- tests : le tri `sortBy=time` use délibérément d'échantillons inversés « vieux mais très pertinents / neufs mais peu pertinents » (sans quoi l'assertion pourrait n'être qu'une coïncidence), et couvre tri avant troncature et repli sur tri inconnu ; `refreshTitles` couvre repli immédiat, non-relecture du journal, filigrane intact, idempotence des id inconnus, convergence à la ronde suivante. Série complète 24/24.

### Correction : inspection et récupération des ouvrages inachevés après interruption anormale d'une reconstruction

- À l'activation de l'hôte (avant l'ouverture du moteur), le répertoire d'index est inspecté automatiquement : un `index.building.sqlite` inachevé — si l'active existe, jugé « la dernière reconstruction n'a pas été achevée » et jeté (avec -wal/-shm ; l'active n'a jamais été en danger) ; si l'active manque, jugé « le crash est tombé dans la fenêtre de renommage », on **restaure le plus récent des archivés comme active** puis on jette l'inachevé ; ni active ni archive, on repart de zéro. Journal `[switch-search] index recovery` du bout en bout.
- L'échec de lecture d'état est désormais explicite (pastille d'erreur + bouton réessayer) ; fini le « lecture de l'état de l'index… » sans fin.
- tests : 2 cas sur le chemin de récupération (abandon de l'inachevé / restauration depuis la fenêtre de renommage), série complète 18/18.

### Interaction : le nettoyage des archives se concentre dans un mode édition

- Le panneau d'archives est en lecture seule par défaut ; un bouton « Éditer » dans l'en-tête fait basculer en mode édition — cases à cocher, tout sélectionner et le rouge « Supprimer la sélection (N) » n'apparaissent qu'en mode édition ; « Terminé » en sort et vide la sélection.
- Le bouton de suppression conserve son processus complet de confirmation (confirm JS : résumé des id + avertissements sauvegarde/redémarrage/irrévocabilité) → `archive-prune` → levée immédiate de la suppression douce dans l'index → rafraîchissement de la liste et maintien en mode édition pour poursuivre le nettoyage.

### Ajout : nettoyage en masse des archives (panneau de gestion)

- Le panneau d'archives gagne un mode de gestion en masse : tout sélectionner/cocher des sessions archivées → **confirmation par confirm JS** (liste le résumé des id à retirer) → l'API `archive-prune` retire en masse les id du tableau `global.archivedSessionIds` du stockage canonique `~/.dsh/storages/workspace.json`.
- L'écriture suit le protocole officiel storage-json : **sauvegarde d'abord (workspace.json.bak-<ts>) puis remplacement atomique** (fichier temporaire dans le même répertoire + rename), sérialisation identique à l'officielle (2 espaces + retour final à la ligne) ; plafond de 5000 id par opération.
- Après retrait, l'index du plugin **lève immédiatement le marquage de suppression douce** (version=-1 ; la ronde suivante de synchronisation par filigrane rengurgite les sessions toujours présentes) ; l'état en mémoire du DSH en marche ne charge le nouveau tableau qu'**après redémarrage** — le panneau et le journal le signalent clairement.
- tests : sauvegarde du prune / écriture atomique / absence de résidus / idempotence des id inconnus, série complète 17/17.

### Affinement : observabilité de la reconstruction + accélération par transactions par lots + driver better-sqlite3 optionnel

- **Correction de la conduite de la progression** : la progression de la consolidation n'était signalée qu'une fois terminée (le panneau restait à « 0/? ») ; passage à un sink d'état — index-status reflète à chaud done/total/phase.
- **Journal de développement** (préfixe `[switch-search]`, via le logger cordis) : identification du driver, lignes de cadence toutes les 50 sessions de reconstruction (sess/s / eta / durée des chunks), transitions de phase, synthèse des rondes de synchronisation (scanned/updated/skipped-archived/failures/duration) — de quoi comparer objectivement les vitesses avant/après.
- **Checkpoints de transactions par lots** : la reconstruction commet une transaction par 50 sessions (amortissement du fsync) ; les chunks en échec sont rejoués un à un, isolés ; réglages PRAGMA (synchronous=NORMAL / temp_store=MEMORY / cache_size=64MB).
- **Double driver** : `better-sqlite3` entre en optionalDependencies (un échec de compilation natif ne bloque pas l'installation), chargé dynamiquement à l'exécution avec repli sur node:sqlite en son absence ; moteur et index-status affichent le driver courant (champ `driver`) — l'installer ou non ne joue que sur la vitesse, pas sur les fonctions.
- **Libellé de l'entrée de recherche** : le bouton du bas « Titre » → « Recherche de sessions ».
- tests : nouveaux tests de sécurité d'imbrication des transactions par lots + d'identification du driver, série complète 16/16.

### Ajout : synchronisation de la suppression douce d'archives + panneau de consultation des archives + alignement sur le style DSH

- **Suppression douce des archives (schema v4)** : chaque ronde de synchronisation par filigrane lit `workspaceRegistry.archivedSessionIds` officiel (résolution paresseuse, repli automatique si le service manque) ; les sessions archivées portent un marquage `archived` dans l'index — exclues de la recherche et de la liste des sessions, leur contenu documentaire retiré mais le header (cache des titres) conservé ; **le désarchivage rengurgite automatiquement le texte intégral** (version=-1 déclenche la relecture au tour suivant).
- **La consolidation ne copie plus le contenu archivé** : reconstruction / export-import de snapshot n'écrivent que la ligne header pour une session archivée, zéro copie docs/fts.
- **Panneau de consultation des archives** : fenêtre flottante centrée en lecture seule listant l'ensemble d'archives officiel (titre/date/cwd), clic pour ouvrir la session ; deux entrées — « sessions archivées » au bas du panneau de recherche et « voir les archives » dans la carte de réglages (nouvelle API `list-archived`, fence conservé). Aucun point d'entrée unarchive officiel, le panneau n'offre pas d'opération de restauration.
- **Alignement sur le style DSH** (sur les métriques et jetons des sources officielles `SettingsRoot` / `ConnectionIndicator`) : le bouton du footer passe aux spécifications officielles du trigger (42px / radius 12px / jeton hover) ; l'état de l'index adopte le langage officiel des pastilles (couleurs sémantiques `--dsw-alias-state-warn/success/error-*`, animation de points en cours de synchronisation + arrêt sous `prefers-reduced-motion`) ; le voile de la fenêtre flottante passe aux jetons de mask du Modal (`--dsw-alias-bg-mask-1` + blur).
- tests : nouveau `tests/index-archive.test.mjs` (5 cas : suppression douce / restauration-reingestion / ligne header / évitement lors de la reconstruction / règles de snapshot), série complète 15/15.

### Affinement : refonte du pipeline de recherche (tokenisation / stockage / chemin de requête)

- **Tokenisation par mots via Intl.Segmenter à la place du trigram** : le texte extrait est segmenté aux frontières de mots ICU puis entre en FTS5 unicode61 ; le côté requête passe par la même tokenisation. Le volume de l'index passe des fenêtres complètes de 3 caractères du trigram à des jetons au niveau mot (ordre du 1/4 attendu) ; les requêtes courtes de 2 caractères repassent d'un « scan LIKE complet de la table » à une requête d'index normale ; les saisies partielles touchent par préfixe du dernier mot (`*` final, « 正在搜 » → 正在搜索) ; les fragments à cheval sur plusieurs mots ne touchent plus à tort (précision en hausse).
- **Contenu externe FTS5** : la table virtuelle FTS passe au mode contenu externe `content='docs'` (colonne tokenisée `index_text` + colonne `text` originale) ; l'index inversé ne duplique plus le texte intégral, encore environ la moitié de stockage économisée ; insertions/suppressions maintiennent la cohérence via la commande `docs_fts 'delete'`.
- **Chemin de requête allégé** : les rowid de la sous-requête MATCH limitée par rank s'alignent directement sur `docs.doc_id`, une seule déclaration suffit pour la recherche + le filtrage par type/surface, en supprimant la requête secondaire `IN (...)` à 5000 paramètres à chaque frappe.
- Index schema v3 : l'ancien index est réinitialisé à l'ouverture, la synchronisation par filigrane le rengurgite automatiquement au prochain sondage, sans consolidation manuelle.
- tests : nouvelles régressions sémantiques de tokenisation (requêtes courtes / préfixe / précision), 7/7.

### Refonte : carte de réglages indépendante (mode thinking-levels)

- **Carte indépendante `settings.plugin.item`** : le plugin gagne sa propre carte de réglages (double enregistrement `id`+`key`, compatible à la fois avec le slot par clé du CLI dsh et le slot list de DSH Desktop), en remplacement de l'ancienne ligne générique `settings.general.item` et de son siège store local. La carte se lie à l'espace de noms de réglages `switch-search`, s'abonne via `useSyncExternalStore` et commet à chaud via `scope.set` (sans formulaire d'attente).
- **Panneau de sous-réglages unifié** : interrupteur d'activation, mode de recherche par défaut, interrupteur de synchronisation automatique, intervalle de synchronisation, nombre d'archives conservées, et la zone de gestion de l'index de recherche par contenu (état, bouton de consolidation de l'index, export/import d'instantanés) — tout converge vers la même carte.
- **Dictionnaires de locale** : nouveaux dictionnaires zh/en `switch-search` (`src/client/locales.ts`) ; en l'absence du service de locale sur les vieux DSH, repli sur les libellés zh intégrés, et si settingsScope manque la carte se dégrade en DEFAULT_CONFIG en lecture seule, sans planter.
- **Découpage du client** : les appels à l'hôte et les types partagés par panneau/carte convergent dans `src/client/host-api.ts` ; le `dsh.client.inject` de `package.json` gagne `@deepseek-ai/dsh-client-locale` et `@deepseek-ai/dsh-client-ui-settings`.
- **Tests** : `tests/client-store.test.mjs` est réécrit pour prouver le nouveau siège de carte (binding de namespace, absence de siège store, dégradation sans settingsScope), 3/3.

### Ajout : moteur d'index plein texte indépendant (fin de la dépendance à l'index FTS5 officiel de DSH)

- **Fichier d'index propre** : la recherche par contenu passe à l'index construit par le plugin (node:sqlite FTS5 + tokenisation trigram, application id indépendant `0x53574954`), stocké dans `~/.dsh-switch-search/` (surchargeable par la configuration `indexDir` ou la variable d'environnement `DSH_SWITCH_SEARCH_DIR`). Avec le `session-query-sqlite` officiel à son `openAt: never` par défaut, la recherche par contenu reste pleinement disponible ; le fichier d'index officiel n'est jamais ouvert, aucune ingérence mutuelle.
- **Synchronisation incrémentale par filigrane** : en tâche de fond, le filigrane `version` des sessions est comparé toutes les `syncIntervalMs` (30 s par défaut), et seul `readSession` pour les sessions nouvelles/modifiées les entre en base incrémentalement ; la sémantique d'extraction textuelle est alignée sur `extractSessionEventText` officiel (user/reply/tool/todo/turn-end), avec réplique du repli de surface (les vieux messages remplacés par édition sont marqués shadowed et exclus de la recherche).
- **Consolidation non destructive (reconstruction)** : le panneau/les réglages peuvent déclencher « consolider l'index » — construction complète dans le fichier shadow, l'ancien index restant interrogeable pendant ce temps ; à l'achèvement, commutation atomique en trois renommages, l'ancien index étant archivé en `index.archive-<ts>.sqlite` (`archiveKeep` copies conservées, 2 par défaut).
- **Interface de migration par snapshot JSON** : `index-export` exporte un snapshot JSON Lines (une ligne par session, documents extraits compris), `index-import` importe le snapshot et l'insère atomiquement par le même chemin de consolidation — une fois le snapshot synchronisé il tient lieu d'index, permettant déménagement entre machines et sauvegarde froide.
- **API HTTP** : `/switch-search/api` gagne `index-status` / `index-rebuild` / `index-export` / `index-import` ; `list-sessions` retombe sur la lecture de l'index quand sessionQuery est indisponible ; le fence d'origine est conservé partout.
- **Client** : le panneau de contenu offre une entrée « construire l'index » quand l'index manque et affiche la progression pendant la consolidation ; la ligne de réglages gagne une zone de gestion « index de recherche par contenu » (badge d'état, bouton de consolidation, export/import d'instantanés).
- **Configuration** : `autoSync` / `syncIntervalMs` / `archiveKeep` / `indexDir` tous optionnels avec valeurs par défaut, rétrocompatible.

### Vérifications

- `node tests/index-engine.test.mjs` : 6/6 (ingestion et recherche groupée, filtrage par type, assainissement de la syntaxe FTS, ancien index interrogeable pendant la consolidation, isolement des sessions corrompues, aller-retour export→import de snapshot, saut des lignes défectueuses).
- `npm test` (`tests/client-store.test.mjs`) : 9/9.

### Ajout : compatibilité avec les deux versions de DSH (0.1.1-rc.2 / 0.1.2-rc.1)

- **Un seul artefact, adaptatif à l'exécution** : le même `lib/client.js` se charge dans les deux versions, sans branche sur des chaînes de version. Le bundle client ne `require` que `react` / `react-dom`, tous deux dans la table de modules partagée des deux.
- **Suppression du seul import de valeur propre à une version** : la ligne de réglages construisait son store via le `defineStore` de `@deepseek-ai/dsh-client-runtime/client` ; ce paquet moteur a été renommé `@deepseek-ai/dsh-client-store` en 0.1.2, et tout import de valeur verrouillait une seule version (sous 0.1.2, la matérialisation levait d'emblée `require(...) missed the module table`, et toute la moitié client ne se chargeait pas).
- **Siège store devenu implémentation locale** : le contrat de siège (`StoreHandle` / `StoreInstance`) appartient à `@deepseek-ai/dsh-client-ui-slots` et est identique dans les deux versions ; la couche de rendu ne consomme que `getSnapshot` / `subscribe` / `actions`. L'implémentation locale fait une trentaine de lignes, couvre `create()` → `{ actions, getSnapshot, subscribe, clearPersisted }` et conserve la clôture de révision et la sémantique de notification d'abonnement ; le comportement est couvert par `tests/client-store.test.mjs` (9 cas).
- **Type de snapshot mis en miroir localement** : `SettingsScopeSnapshot<T>` a les mêmes champs dans les deux versions (status / value / base / user / revision / writable / mode) ; passage à un miroir structurel local, pour éviter qu'un import de type ne désigne une seule version.
- **Métadonnées** : `engines.dsh` resserré sur `>=0.1.0-rc.7 <0.2.0-0` ; `peerDependencies` / `devDependencies` se débarrassent de `@deepseek-ai/dsh-client-runtime` ; `dsh.client.inject` pointe le paquet propriétaire du slot réellement rempli (`@deepseek-ai/dsh-client-ui-settings-general`) ; les externals client de `tsdown` perdent le runtime en même temps.

### Vérifications

- `npm test` (`tests/client-store.test.mjs`) : 9/9.
- `_smoke/smoke-batch-c.mjs` : routes de la moitié hôte + espace de noms de réglages ; la moitié client se matérialise une fois sur chacune des deux tables de modules réelles (0.1.1-rc.2 préchargeant `dsh-client-runtime/client` / 0.1.2-rc.1 avec `dsh-client-store`) ; un `require` hors table échoue, et les deux registres d'enregistrement concordent.
