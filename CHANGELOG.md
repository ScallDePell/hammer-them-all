# Changelog

## 0.7.0

- Le module s'appelle désormais **Hammer Them'All** : identifiant `hammer-them-all`, dépôt ScallDePell/hammer-them-all, zip `hammer-them-all.zip` à décompresser dans `Data/modules/hammer-them-all`. Les fichiers `rwf-tools.mjs` et `styles/rwf-tools.css` deviennent `hammer-them-all.mjs` et `styles/hammer-them-all.css`, la classe CSS `rwf-tools-app` devient `hammer-them-all-app`, le socket `module.hammer-them-all`.
- Pour Foundry, c'est un nouveau module : supprimez le dossier `Data/modules/rwf-tools` et activez Hammer Them'All dans le monde. Au premier lancement, le MJ passe au nouvel identifiant toute macro qui appelle encore `game.modules.get("rwf-tools")`, les trois macros de RWF tools comme celles que vous avez écrites (elles gardent leur place dans les barres de macros) et chaque joueur garde la liste des macros déjà placées. Les poursuites et cibles de combat en cours, le brouillon de préparation et le choix des dés ne sont pas repris : terminez les poursuites en cours avant la mise à jour.

## 0.6.4

- Correctif 0.6.3 : le MJ republiait les écarts qu'il avait déjà écrits au lieu de relire l'état des personnages. Les joueurs voyaient donc des écarts figés ou en retard (un PJ qui rate semblait reculer de deux). Le MJ relit maintenant toujours l'état, et publie les écarts juste après chaque manœuvre d'un PNJ, avant que le tour passe.

## 0.6.3

- Les joueurs voient enfin bouger l'écart des personnages qu'ils ne jouent pas : le MJ tient à jour l'écart de chacun dans la poursuite, et le HUD des joueurs le lit là.
- Les jauges se lisent du côté du camp joué : + et vert quand son camp gagne du terrain. Le même écart s'affiche +1 chez les poursuivants et −1 chez les fuyards ; la légende passe de « Rattrapé … Semé » à « Semé … Rattrapé » côté poursuivants. Le MJ lit les jauges du côté des personnages non joueurs.

## 0.6.2

- Une poursuite lancée par une version plus ancienne (combattants reliés dans le désordre) se répare d'elle-même : chaque participant est relié au combattant de son jeton à chaque lecture. Le joueur ne joue plus au tour d'un Vilain et retrouve ses manœuvres à son tour.
- Côté MJ, le tour d'un personnage qu'il joue s'affiche en vert « À Vilain de jouer » au lieu de « À vous de jouer ».

## 0.6.1

- Correctif : au lancement (et à la séparation) d'une poursuite, chaque combattant Foundry est relié au participant par son jeton, et non plus par l'ordre de création. Avant, un PJ pouvait recevoir le nom, le camp ou le +2 d'un autre participant, se voir comme un Vilain ou ne pas pouvoir jouer à son tour.
- Un joueur ne possède plus que les personnages dont il est vraiment propriétaire.
- Plus lisible : chaque écart n'apparaît qu'une fois, sous le fuyard, avec une ligne par poursuivant (son rang, son nom, sa jauge). Une légende « Rattrapé … Semé » coiffe la zone des fuyards. Les couleurs suivent le camp du joueur : vert quand son camp gagne du terrain. Un poursuivant affiche simplement « → sa cible ».
- Les explications des manœuvres sont plus courtes.

## 0.6.0

- Un écart par poursuivant : chaque poursuivant a son propre écart avec le fuyard qu'il chasse. La manœuvre d'un poursuivant ne change que le sien ; celle d'un fuyard l'éloigne de tous ses poursuivants. Deux poursuivants qui réussissent ne rapprochent plus le fuyard de deux cases, et l'échec de l'un ne fait plus reculer l'autre.
- À −3 un poursuivant rattrape sa cible ; à +3 il est semé et sort de la poursuite. Un fuyard a semé ses poursuivants quand tous ceux qui le chassaient sont semés.
- Le fuyard montre l'écart de son poursuivant le plus proche, et celui de chacun (« Poursuivi par Vilain (−1), Vilain (+1) »). Un poursuivant qui change de cible repart de l'écart de ce fuyard.
- Demande le Ruleset RWF 2.6.0.

## 0.5.0

- **Scinder la poursuite** (Réglages du MJ) : les participants cochés partent dans une poursuite à part, un autre combat Foundry, en gardant leur initiative, leur jauge et leur issue. Il faut au moins un fuyard et un poursuivant de chaque côté. Le chat annonce la séparation, les joueurs concernés voient la nouvelle poursuite s'ouvrir.
- Avec plusieurs poursuites, le HUD montre un onglet par poursuite, nommé d'après ses fuyards ; côté MJ, le suivi de combat suit l'onglet choisi. Un joueur voit d'office celle où il joue.
- Un poursuivant sans cible chasse le fuyard le plus proche (la jauge la plus basse), puis le moins poursuivi.
- Un joueur dont le jeton n'a pas encore son acteur prêt sur son client est reconnu comme propriétaire par l'acteur du jeton : il garde ses manœuvres à son tour.

## 0.4.5

- Le message de début de poursuite donne l'ordre de jeu, avec le +2 de chaque fuyard (« Luca 13.33 + 2 = 15.33 · Vilain 15.32 · … »).

## 0.4.4

- La carte de chat d'une manœuvre (et d'une action du HUD Combat) parle au nom du combattant qui agit, et plus du jeton sélectionné par le MJ.
- Le +2 d'initiative des fuyards est donné une fois la poursuite lancée, sur leur initiative relue dans le combat, puis le round commence par la meilleure initiative. La console note l'ordre obtenu (« RWF tools | Pursuit initiative »).
- Le HUD lit la jauge d'un participant même quand ce client ne peut pas lister ses véhicules ; un échec de lecture est noté dans la console.

## 0.4.3

- Quand le MJ lance une poursuite, le HUD Poursuite s'ouvre tout seul chez chaque joueur connecté qui possède un participant.

## 0.4.2

- Chaque poursuivant montre la jauge du fuyard qu'il chasse, colorée de son point de vue : en vert quand il se rapproche (vers Rattrapé), en rouge quand le fuyard s'éloigne (vers Semé).

## 0.4.1

- Corrige l'issue d'un participant (rattrapé, semé, à bout de souffle) qui n'était pas gardée par la poursuite : Foundry découpait l'identifiant du participant à ses points. L'issue était annoncée plusieurs fois dans le chat, et un poursuivant dont le fuyard était rattrapé ne passait pas à un autre fuyard. Une poursuite lancée avant cette version est à relancer.

## 0.4.0

- Poursuite à jauge d'écart : chaque fuyard a une jauge de −3 (rattrapé) à +3 (il a semé ses poursuivants). La manœuvre d'un fuyard fait monter sa jauge, celle d'un poursuivant fait baisser la jauge du fuyard qu'il chasse ; plusieurs poursuivants sur un fuyard s'additionnent. Avant, chacun avait sa propre jauge et un fuyard pouvait n'être jamais rattrapé.
- Chaque poursuivant chasse un fuyard, réparti d'office entre eux et modifiable par le MJ (préparation, Réglages) ou par son joueur à son tour (**Cible**). Quand son fuyard sort de la course, il passe à un autre.
- L'avantage de vitesse d'un fuyard se compte contre le plus rapide de ses poursuivants, celui d'un poursuivant contre le fuyard qu'il chasse.
- À pied à 0 d'Endurance, un participant est à bout de souffle : il sort de la poursuite (annoncé dans le chat, marqué vaincu, tours passés).
- Demande le Ruleset RWF 2.5.0 (jauge d'écart, Incapacité physique automatique à 0 d'Endurance).

## 0.3.1

- Jauge de poursuite colorée selon l'avancement : remplie de 0 jusqu'à la position, en vert vers le bon bout (s'échapper, rattraper), en rouge vers le mauvais, avec la valeur affichée.
- Préparer la poursuite sans sélection prend tous les jetons RWF de la scène ; les autres jetons de la scène sont listés sous « Aussi sur la scène », avec un bouton Fuyard et un bouton Poursuivant (aussi dans les Réglages pendant la poursuite). Plus de bouton « Ajouter la sélection ».
- Le participant qui joue voit ce que fait une manœuvre (DD, avancée de la jauge, avantage de vitesse) et, sur chaque bouton, le bonus ou malus et le d20 à atteindre ; les autres voient « En attente de la manœuvre de … ». Les participants sont numérotés dans l'ordre de jeu.

## 0.3.0

- HUD Poursuite refait. Le MJ prépare la poursuite : **Qui fuit ?** (les PNJ ou les PJ), puis le camp et le déplacement de chacun. **Lancer la poursuite** crée un combat Foundry à une passe par round, dans l'ordre de l'initiative RWF ; les fuyards ont +2 au premier round.
- Le HUD montre en haut le participant dont c'est le tour et ses coups (pour son joueur ou le MJ), puis deux zones, Fuyards et Poursuivants, avec la jauge de chacun et celui qui joue encadré. Un coup joué passe le tour. Les réglages du MJ sont repliés en bas.
- Plus de référence de vitesse : l'avantage se calcule contre le plus rapide du camp d'en face encore en course.
- Un participant qui atteint ±3 est annoncé dans le chat, marqué vaincu et ses tours sont passés ; la poursuite se termine quand un camp n'a plus personne en course.
- Le HUD Combat ignore le combat d'une poursuite. Une poursuite préparée avec une version précédente n'est pas reprise.
- Demande Rule Them'All 1.0.20 (combat à une seule passe).

## 0.2.6

- Avec le Ruleset RWF 2.4.0 : un round que le combattant qui agit n'a pas compté (annonce perdue) lui est annoncé avant son tour ; son effort physique du round précédent est compté et l'Endurance baisse au troisième, sans jamais compter deux fois le même round.
- Demande Rule Them'All 1.0.17 (combattant vaincu à 0 de Vitalité avec RWF 2.4.0).

## 0.2.5

- HUD Combat : chaque combattant garde sa cible dans le combat, la même pour tous les clients (le MJ voit celle du joueur). Elle ne change que si ce combattant en choisit une autre (dans le HUD, ou en ciblant un combattant sur la scène quand c'est lui qu'on joue) ou si la cible quitte le combat ou est mise hors de combat. Un combat commence sans cible.
- Demande Rule Them'All 1.0.15 (l'attaque d'un joueur inflige ses dégâts à un PNJ du MJ).

## 0.2.4

- HUD Combat : hors de son tour, un combattant voit ses cartes mais aucun bouton d'action n'est actif ; une seule ligne dit pourquoi.
- Un combat supprimé, commencé ou non, remet à zéro les marques de combat (« En combat », passe, dernière passe d'attaque, attaques du round) de ses acteurs, sauf ceux pris dans un autre combat en cours.
- Demande Rule Them'All 1.0.14 (le combat commence sur la meilleure initiative, à la première passe).

## 0.2.3

- Le combattant qui agit peut toujours jouer sa passe : le client du MJ actif vérifie, à chaque changement du combat, que sa passe est celle du combat et que l'attaque de la passe n'est pas marquée comme déjà faite par des compteurs restés d'un combat précédent ; sinon il annonce à nouveau le tour ou remet ces compteurs, et l'écrit dans la console (« rwf-tools | … repaired »).
- « En combat » lu sur l'état appliqué au personnage.
- Demande Rule Them'All 1.0.13.

## 0.2.2

- HUD Combat : le MJ voit la cible choisie par le joueur du personnage qui agit ; le sélecteur de cible ne propose que le camp opposé.
- Choix des dés plus visible (bouton actif rempli, coché).
- Dés sur table en deux temps : le d20, puis, si l'attaque touche, le total des dés de dégâts ou de soins (doublé automatiquement au critique).
- Une carte d'action inutilisable dit pourquoi.
- Demande Rule Them'All 1.0.12 (tour annoncé au combattant qui agit, dégâts sur la carte de chat).

## 0.2.1

- HUD Combat : « À vous de jouer » ne s'affiche plus que pour le joueur du combattant qui agit, ou pour le MJ quand c'est un PNJ ; les autres voient « Tour de » et le nom, en couleur normale.
- Demande Rule Them'All 1.0.11 (le premier combattant après une relance d'initiative peut de nouveau attaquer).

## 0.2.0

- **HUD Combat** : ressources, passes, cible et couverture, une carte par arme, pouvoir et action physique, d20 à atteindre, portée, dés de Foundry ou de la table, fin de passe ou de round (relayée au MJ pour un joueur).
- **HUD Poursuite** : poursuite partagée dans le monde, réglée par le MJ (rôles, déplacement, référence de vitesse, vitesse maximale du terrain), jauge par participant, coups du Ruleset RWF avec l'avantage de vitesse.
- Macros **HUD Combat** et **HUD Poursuite** pour tous, placées une fois dans la barre de chaque utilisateur.
- Demande Rule Them'All 1.0.10 et le Ruleset RWF 2.2.0 ou plus récent.

## 0.1.1

- **Vider** la liste des tests demandés : les tests terminés disparaissent, ceux encore en attente sont annulés chez le joueur.

## 0.1.0

- Macro du MJ **Demander un test** : joueurs connectés avec un personnage joueur RWF, compétence et DD du Ruleset, fenêtre du joueur impossible à fermer avant sa réponse (dés de Foundry ou d20 de la table), test lancé sur le client du MJ avec la pratique de RWF.
