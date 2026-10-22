# Hammer Them'All (ex RWF tools) : historique et passation

Depuis la 0.7.0 (22 octobre 2026), le module s'appelle Hammer Them'All, identifiant `hammer-them-all`. « RWF tools » ci-dessous désigne le même module avant le renommage.

Ce document résume tout ce qui s'est fait sur RWF tools jusqu'à la 0.6.4 (20 octobre 2026), pour reprendre le travail dans un nouveau projet sans relire les anciennes discussions. Les détails version par version sont dans [CHANGELOG.md](../CHANGELOG.md), le fonctionnement pour les joueurs dans [README.md](../README.md).

## 1. Pourquoi ce module existe

- **Règle de Luca (18 octobre 2026) :** tout outil propre à Real World Fantasy vit dans ce module privé, jamais dans Rule Them'All (RTA). RTA reste un moteur générique capable d'exprimer n'importe quel JDR ; RWF tools ajoute par-dessus les outils de table de RWF.
- Le module s'appuie sur RTA (moteur, Actions, cartes de chat) et sur le **Ruleset RWF** importé dans le monde. Les règles (DD, tests, dégâts, poursuite, épuisement…) restent dans le Ruleset ; le module ne fait que l'interface et l'orchestration (qui joue, quand, sur qui).
- Trois outils, chacun ouvert par une macro créée par le client du MJ : **Demander un test** (MJ), **HUD Combat** et **HUD Poursuite** (tous, en Observateur).

## 2. Dépendances

| RWF tools | Rule Them'All minimum | Ruleset RWF minimum |
|---|---|---|
| 0.1.x | 1.0.8 (`chat.postActionCard`) | 2.1.0 |
| 0.2.0 | 1.0.10 | 2.2.0 |
| 0.2.1 | 1.0.11 | 2.2.0 |
| 0.2.2 | 1.0.12 | 2.2.0 |
| 0.2.3 | 1.0.13 | 2.2.0 |
| 0.2.4 | 1.0.14 | 2.2.0 |
| 0.2.5 | 1.0.15 | 2.2.0 |
| 0.2.6 | 1.0.17 | 2.4.0 conseillé |
| 0.3.x | 1.0.20 (drapeau de combat `rule-them-all.singlePass`) | 2.4.0 |
| 0.4.x, 0.5.0 | 1.0.20 | 2.5.0 |
| 0.6.x | 1.0.20 | **2.6.0** (le HUD refuse les versions plus anciennes) |

Ce que chaque version du Ruleset RWF a apporté pour RWF tools :

- **2.1.0** : roll `d20-annonce` (`@input.de`), test `test-competence-demande`, Action `test-demande` et `pratique-test` réservées au MJ par Permission. La pratique ne progresse plus qu'en combat (état « En combat ») ou sur un test demandé par le MJ ; la case « Demandé par le MJ » cochable par le joueur a disparu.
- **2.2.0** : règles des anciens HUD (d20 et dégâts annoncés en saisie `de`/`degats`, passes 1/2/3 avec une attaque, un sprint ou un rechargement par passe, munitions, rafale, full auto, rechargement, essoufflement, poursuite à pied, « Reprendre son souffle »).
- **2.3.0** : états observables et échelles descriptives (pas utilisé directement par le module).
- **2.4.0** : vaincu à Vitalité 0, compteur `round-en-cours` qui rend les déclencheurs de round idempotents.
- **2.5.0** : saisie `sens` (1 fuyard, −1 poursuivant), effets de poursuite sur le rôle `target`, Action `epuisement` (Incapacité physique à Endurance ≤ 0).
- **2.6.0** : chaque personnage garde sa propre part de l'écart (`progression-poursuite`, effets sur soi, bornes ±2 × borne).

Les fichiers du Ruleset sont dans le dépôt Rule Them'All, `Rulesets/rwf/` (seule la dernière version y reste), et dans les fichiers du projet, `rulesets/rwf/rwf-ruleset-2.x.0.json`. On l'importe avec le bouton Importer du Configurateur, on le publie, puis on passe les Acteurs dessus. Attention : l'identifiant de version (`versionId`, par exemple `rwf-2-6-0`) est répété dans le fichier ; ne pas l'éditer à la main.

## 3. API de Rule Them'All utilisée

Tout passe par `game.ruleThemAll` (fonction `rta()` dans `src/hud-common.mjs` et `src/test-request.mjs`) :

- `configuratorReady`, `configurator` : lire le Ruleset actif (compétences, paramètres marqués « difficulte », Actions, armes, pouvoirs).
- `runtime.getContainerState` : lire l'état RTA d'un Acteur (ressources, parts de poursuite, états).
- `runtime.executeAction` : lancer une Action du Ruleset (option `combatant` pour que la carte parle au nom du combattant qui agit).
- `runtime.emitSystemEvent` : réannoncer `rta.combat.turn` / `rta.combat.round`, envoyer `rta.combat.end` aux Acteurs encore marqués quand un combat est supprimé.
- `runtime.setDefinitionState` : remettre à zéro des compteurs de combat restés d'un ancien combat.
- `chat.postActionCard(result, versionId, {speaker})` : carte de chat d'un test demandé.
- Drapeaux et réglages : combat `rule-them-all.singlePass` (une passe par round), combat `hammer-them-all.targets`, combat `hammer-them-all.pursuit`, réglage monde `hammer-them-all.pursuit` (brouillon de préparation), réglage client `hammer-them-all.diceMode` (`rwf-tools.*` jusqu'à la 0.6.4).
- Socket `module.hammer-them-all` (`module.rwf-tools` jusqu'à la 0.6.4) : `request`/`answer`/`cancel` (tests), `hud.endTurn`, `hud.target`, `pursuit.target`, `pursuit.open`.

## 4. Les versions

### 0.1.0 à 0.1.1 (18 octobre) : demande de test du MJ

- **Demande de Luca :** une macro du MJ ouvre une petite fenêtre listant en temps réel les joueurs connectés qui possèdent un PJ ; le MJ en coche un ou plusieurs, choisit une compétence (les compétences seulement, le combat et la poursuite viendront dans des HUD) et une DD prise dans le Ruleset (Facile 10 … Héroïque 22, Standard par défaut). Le joueur reçoit une fenêtre qu'il ne peut pas fermer avant d'avoir répondu, avec les dés de Foundry ou une valeur lancée sur la table.
- Le client du MJ lance l'Action `test-demande` avec `{dd, de}` et poste la carte. Seul ce test hors combat rapporte de la pratique. Une demande est renvoyée au joueur qui se reconnecte.
- Luca l'a essayé dans Foundry : « ça fonctionne et la progression est effective ». 0.1.1 ajoute **Vider** la liste, à sa demande.

### 0.2.0 à 0.2.6 (18 octobre) : HUD Combat

- **Demande de Luca :** des HUD Combat et Poursuite dans RWF tools, ouverts par des macros pour le MJ et les joueurs, inspirés de l'ancien système RWF v0.1.475 (résumé dans [huds-ancien-systeme-rwf.md](huds-ancien-systeme-rwf.md)).
- 0.2.0 : ressources, passes, cible et couverture, une carte par arme, pouvoir et action physique, d20 à atteindre, portée, dés Foundry ou table, fin de passe ou de round relayée au MJ pour un joueur. Choix par défaut de Claude : couverture par cible sur le client, attaque bloquée hors de portée ou hors contact, mode de dés par client.
- 0.2.1 : « À vous de jouer » en vert seulement pour qui joue réellement le combattant (retour de Luca).
- 0.2.2 : le MJ voit la cible du joueur, cibles du camp opposé seulement, choix des dés plus visible, dégâts en deux temps sur table et sur la carte de chat (retours de Luca).
- 0.2.3 : `src/turn-guard.mjs`, le client du MJ actif réannonce le tour si la passe ne correspond pas (Luca : le premier combattant ne pouvait pas attaquer sans faire tour suivant / précédent).
- 0.2.4 : boutons inactifs hors du tour ; marques de combat remises à zéro à la suppression d'un combat (Luca : « réinitialiser tous les marqueurs d'un combat en début et fin »).
- 0.2.5 : chaque combattant garde sa cible dans le combat, vide au début, perdue si la cible sort ou est vaincue (demande de Luca).
- 0.2.6 : réannonce d'un round non compté (RWF 2.4.0), après le combat de 8 rounds de Luca où personne n'avait perdu d'Endurance.

### 0.3.0 à 0.3.1 (18 et 19 octobre) : poursuite refaite en combat Foundry

- **Demande de Luca :** demander d'abord qui fuit (PJ ou PNJ), jouer comme un combat Foundry dans l'ordre d'initiative avec un bonus pour les fuyards au premier round, deux zones Fuyards / Poursuivants, celui dont c'est le tour mis en avant, ses actions en haut.
- 0.3.0 : préparation par le MJ, « Lancer » crée un combat à une passe par round, +2 d'initiative aux fuyards (valeur choisie par Claude), réglages du MJ repliés en bas, fin quand un camp n'a plus personne.
- 0.3.1 : Luca trouvait la fenêtre peu intuitive et la jauge non colorée. Jauge remplie et colorée, « Préparer » sans sélection prend tous les jetons RWF de la scène, boutons « Aussi sur la scène », manœuvres expliquées.

### 0.4.0 à 0.4.5 (19 octobre) : jauge d'écart par fuyard

- Luca a vu un PJ jamais rattrapé (jauges indépendantes) et demandé un meilleur système. Claude a proposé une jauge d'écart par fuyard partagée avec ses poursuivants, Luca a accepté. Il a aussi signalé qu'un PJ à 0 d'Endurance ne s'arrêtait pas.
- 0.4.0 : une jauge par fuyard (−3 rattrapé … +3 semé), chaque poursuivant chasse une cible, à bout de souffle à pied à 0 d'Endurance.
- 0.4.1 : issues stockées en liste ; Foundry découpait les clés uuid à leurs points (annonce en double, pas de changement de cible).
- 0.4.2 : chaque poursuivant voit la jauge de sa cible (Luca voulait savoir s'il se rapproche).
- 0.4.3 : le HUD s'ouvre tout seul chez les joueurs concernés au lancement (demande de Luca).
- 0.4.4 : la carte parle au nom du combattant qui agit, +2 appliqué après le début du combat.
- 0.4.5 : l'ordre de jeu avec le +2 est affiché dans le chat.

### 0.5.0 (19 octobre) : scinder une poursuite

- Luca : un poursuivant chasse d'abord le fuyard le plus proche, et le MJ doit pouvoir scinder la poursuite si le groupe se sépare. Sur la carte de décision, Claude recommandait un seul combat ; **Luca a choisi des combats séparés**.
- « Scinder la poursuite » crée un autre combat Foundry (initiative, jauge et issue gardées), un onglet par poursuite dans le HUD, poursuivant sans cible vers le fuyard le plus proche.

### 0.6.0 à 0.6.4 (19 octobre) : un écart par poursuivant

- Luca a rejeté la jauge partagée : bonne en 1 contre 1, fausse en X contre 1 (l'échec d'un Vilain faisait reculer l'autre, deux réussites rattrapaient deux cases).
- 0.6.0 (+ RWF 2.6.0) : chaque personnage garde sa part ; l'écart d'un poursuivant = part du fuyard + sa part. À −3 il rattrape, à +3 il est semé ; un fuyard a semé ses poursuivants quand tous sont semés.
- 0.6.1 : combattants reliés aux participants par jeton et non par ordre de création (le PJ se voyait en Vilain, +2 mal attribué) ; une ligne par poursuivant sous chaque fuyard.
- 0.6.2 : chaque lecture relie de nouveau les participants à leur jeton ; côté MJ « À Vilain de jouer » en vert.
- 0.6.3 : le MJ publie la part de chacun dans la poursuite pour les joueurs, qui ne peuvent pas lire l'état des PNJ. Jauges signées du point de vue du camp (demande de Luca : + chez les fuyards = − chez les poursuivants).
- 0.6.4 : le MJ republiait des parts périmées (décalage de 1 entre PNJ et PJ, un PJ qui rate reculait de deux) ; il relit maintenant toujours l'état et publie après chaque manœuvre d'un PNJ. Ligne de console « Pursuit shares » en mode Verbose.

## 5. Décisions à garder en tête

- Les règles vont dans le Ruleset RWF, l'interface et l'orchestration dans RWF tools, rien de propre à RWF dans Rule Them'All.
- Une poursuite est un combat Foundry marqué `hammer-them-all.pursuit`, à une passe par round ; le HUD Combat l'ignore.
- Chaque poursuivant a son propre écart avec sa cible (choix de Luca après la 0.5.0). Pas de jauge commune.
- Scinder = plusieurs combats Foundry (choix de Luca).
- Jauges lues du camp de celui qui regarde ; le MJ lit du côté des PNJ.
- Le client du **MJ actif** fait les écritures que les joueurs ne peuvent pas faire (fin de tour, cibles, parts de poursuite, réparation des tours). Il faut donc un MJ connecté.
- Ne jamais indexer un objet de drapeau Foundry par uuid : Foundry découpe les clés à leurs points. Utiliser des listes `[{uuid, …}]`.
- Dans les fichiers de langue, aucune clé ne peut être à la fois un mot et un groupe (Foundry développe les clés pointées ; un test le vérifie).

## 6. Ce qui reste ouvert

- **À essayer dans Foundry par Luca :** la 0.6.4 n'a pas été essayée. Vérifier côté joueur que la jauge bouge dès la manœuvre d'un Vilain, sans décalage, et que les tours et manœuvres tombent sur le bon participant. Si une jauge reste fausse : console du MJ, lignes « Pursuit shares » (mode Verbose).
- Aussi jamais essayés en jeu : l'épuisement à 0 d'Endurance en poursuite, Scinder la poursuite, les onglets de poursuite, l'ouverture automatique du HUD chez les joueurs.
- **Cache navigateur :** après chaque mise à jour, faire Ctrl+F5 sur **chaque** client, MJ compris. Plusieurs bugs de la soirée du 19 venaient d'un client resté sur l'ancien code ; c'est le client du MJ qui lance la poursuite.
- Une poursuite lancée avec une version plus ancienne est à relancer.
- Pistes proposées et non faites : borne de jauge réglable pour une seule poursuite (aujourd'hui c'est le paramètre du Ruleset « Borne de la jauge de poursuite », 3 par défaut).
- Laissé au MJ par le Ruleset : issue d'une poursuite, blessure grave à 75 % de Vitalité, récupération des rounds de repos.
- Côté Rule Them'All, à reconfirmer en jeu : fenêtre de réaction chez le bon joueur, expiration des états avec le temps du monde.

## 7. Où trouver quoi

- **Dépôt :** github.com/ScallDePell/hammer-them-all (privé, ex rwf-tools, renommé le 22 octobre 2026), branche `main`. Luca travaille directement sur `main`, sans PR.
- **Code :** `hammer-them-all.mjs` (entrée, macros, socket, hooks), `src/test-request*.mjs` (demande de test), `src/hud-model.mjs` (vues pures, testées), `src/hud-markup.mjs`, `src/combat-hud.mjs`, `src/pursuit-hud.mjs`, `src/hud-common.mjs`, `src/turn-guard.mjs`, `styles/hammer-them-all.css`, `lang/fr.json` et `lang/en.json`.
- **Tests :** `node --test tests/*.test.mjs`, avec `RTA_REPO=<checkout de Rule Them'All>` (par défaut `../rule-them-all`) pour le test d'intégration avec le Ruleset.
- **Captures :** `node qa/render-windows.mjs <dossier>` (playwright-core et Chromium).
- **Publication :** monter `version` et `download` dans `module.json`, ajouter l'entrée du CHANGELOG, pousser sur `main`, puis lancer le workflow `.github/workflows/release.yml` à la main (workflow_dispatch sur `main`). Il lance les tests avec un checkout de Rule Them'All, crée le tag `v<version>` et la release avec `hammer-them-all.zip` et `module.json`. Le dépôt étant privé, Foundry ne peut pas télécharger le manifeste : Luca installe le zip à la main dans `Data/modules/hammer-them-all`.
- **Fichiers du projet Rule Them'All** (`/mnt/project-files/rwf-tools/`) : tous les zips de 0.1.0 à 0.6.4, les captures par version (`apercus-0.3.0` … `apercus-0.6.3`, `apercus-hud`) et une copie de ce document.
- **Ancien système RWF :** [docs/huds-ancien-systeme-rwf.md](huds-ancien-systeme-rwf.md), résumé des HUD Combat et Poursuite de l'ancien système RWF v0.1.475 (mise en page, mécaniques, défauts connus, correspondance avec le Ruleset).
- **Sources de règles :** `RWF-Reference-Fonctionnelle.docx` (référence fonctionnelle de Luca, dans les fichiers du projet Rule Them'All) et le dossier `Rulesets/rwf/` du dépôt Rule Them'All (`LISEZMOI.md`, générateur `outils/build-rwf.mjs`, vérifications `verify-rwf.mjs`).
