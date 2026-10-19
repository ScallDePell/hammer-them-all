# RWF tools

Outils de jeu de Real World Fantasy pour Foundry VTT v14, par-dessus [Rule Them'All](https://github.com/ScallDePell/Rule-Them-All) et son Ruleset RWF. Module privé : les outils propres à RWF vivent ici, jamais dans Rule Them'All.

Il demande Rule Them'All 1.0.17 ou plus récent et le Ruleset RWF 2.5.0 ou plus récent, actif dans le monde.

## Les macros

Au premier lancement, le client du MJ crée trois macros : **Demander un test** (MJ seulement), **HUD Combat** et **HUD Poursuite** (ouvertes à tous, en Observateur). Chaque utilisateur reçoit une fois dans sa barre de macros celles qu'il peut lancer ; s'il les en retire, elles n'y reviennent pas (elles restent dans le dossier des macros). Un joueur qui se connecte avant le MJ les reçoit dès que le MJ les a créées.

Ce sont des macros de script : si un joueur ne peut pas les lancer, vérifiez dans **Configurer les permissions** que son rôle a « Utiliser des macros de script ».

## Demander un test

1. Le MJ clique la macro. La fenêtre liste les joueurs connectés qui possèdent un personnage joueur RWF ; la liste suit les connexions en direct.
2. Il coche un ou plusieurs personnages, choisit la compétence et la DD (les DD sont les paramètres du Ruleset marqués « Difficulté de test »), puis **Envoyer le test**.
3. Chaque joueur choisi voit s'ouvrir une fenêtre qu'il ne peut pas fermer tant qu'il n'a pas répondu : **Lancer les dés** (dés de Foundry, Dice So Nice s'il est installé) ou son résultat du d20 lancé sur la table.
4. Le client du MJ lance alors l'Action « Test demandé par le MJ » du Ruleset avec ce d20 et poste la carte de chat habituelle. Une réussite rapporte de la pratique, comme le prévoit RWF ; c'est le seul test hors combat qui en rapporte.

La fenêtre du MJ montre les tests en attente et leurs résultats. **Annuler** retire une demande et ferme la fenêtre du joueur ; **Vider** efface toute la liste (les tests encore en attente sont annulés). Un joueur qui recharge sa page reçoit de nouveau la demande à sa reconnexion.

## HUD Combat

La macro **HUD Combat** ouvre, sur chaque client, une fenêtre qui suit le combat de Foundry une fois commencé. Elle suit le combattant qui agit quand il appartient à l'utilisateur (n'importe lequel pour le MJ), sinon son propre personnage.

- En tête : le round, la passe en cours sur le nombre de passes du combattant, et à qui c'est le tour.
- Les ressources : Vitalité, Endurance, Énergie, Défense, attaques utilisées dans le round sur ce que permet la meilleure maîtrise, efforts physiques sur 3.
- **Dés Foundry / Dés sur table**, retenu par client : sur table, le HUD demande le d20 lu sur la table, puis, si l'attaque touche, le total des dés de dégâts (ou de soins) ; avec les dés Foundry, tout est lancé automatiquement. La carte de chat montre le jet, la difficulté, le résultat et les dégâts.
- Chaque combattant garde sa cible pendant le combat, la même pour tous (le MJ voit celle du joueur) : un combat commence sans cible ; elle change quand ce combattant en choisit une autre (ici, ou en ciblant un combattant sur la scène quand on le joue) et disparaît quand la cible quitte le combat ou est mise hors de combat. **Changer** liste les combattants du camp opposé sur la scène (les PNJ pour un personnage joueur, les personnages joueurs pour un PNJ), du plus proche au plus loin, avec la distance bord à bord. La **Couverture** de la cible s'ajoute à sa Défense ; elle est gardée par cible sur ce client.
- Une carte par manière d'agir : mains nues, chaque arme (dégâts, portée, perforation, chargeur et réserve, attaques par round ; Tirer ou Attaquer, Rafale, Full auto, Recharger selon l'arme), chaque pouvoir disponible (latent pour le MJ seulement), et les actions physiques Sprinter et Reprendre son souffle. Chaque bouton montre le d20 à atteindre ; un bouton grisé dit pourquoi au survol (la Condition du Ruleset qui l'interdit, une cible hors de portée, une arme de mêlée qui n'est pas au contact).
- Chaque Action est celle du Ruleset RWF, lancée par Rule Them'All, avec sa carte de chat.
- **Fin de la passe N** ou **Fin du round** passe au combattant suivant ; pour un joueur, c'est le client du MJ qui le fait (il faut un MJ connecté).

## HUD Poursuite

La macro **HUD Poursuite** ouvre la poursuite en cours, la même pour tout le monde. Une poursuite se joue comme un combat Foundry, dans l'ordre de l'initiative.

- **Préparer :** **Préparer la poursuite** prend les jetons sélectionnés (ou ciblés), sinon tous les jetons RWF de la scène. Il répond à **Qui fuit ?** (les PNJ ou les PJ), puis ajuste chaque participant : son camp (bouton ⇄), le fuyard que chasse chaque poursuivant (réparti d'office entre les fuyards), son déplacement (à pied ou l'un de ses véhicules), ou le retire. Les autres jetons de la scène sont listés sous **Aussi sur la scène**, avec un bouton Fuyard et un bouton Poursuivant ; **Vitesse maximale du terrain** plafonne les vitesses (0 : pas de limite).
- **Lancer la poursuite :** crée un combat Foundry marqué comme poursuite, avec une seule passe par round. L'initiative RWF est lancée et les fuyards ont +2 au premier round ; elle est relancée à chaque round, sans bonus. La jauge de chaque fuyard repart de 0. Le HUD Poursuite s'ouvre tout seul chez chaque joueur connecté qui possède un participant. Le HUD Combat ne s'occupe pas de ce combat.
- **Une jauge d'écart par fuyard :** de −3 (rattrapé) à +3 (il a semé ses poursuivants). La manœuvre réussie d'un fuyard fait monter sa jauge ; celle d'un poursuivant fait baisser la jauge du fuyard qu'il chasse. Plusieurs poursuivants sur le même fuyard s'additionnent. Un poursuivant n'a pas de jauge à lui : il montre celle du fuyard qu'il chasse, en vert quand il se rapproche, en rouge quand le fuyard s'éloigne.
- **En haut du HUD :** le round et à qui c'est le tour, le choix des dés (Foundry ou sur la table), puis le participant dont c'est le tour : son déplacement, son avantage de vitesse, son Endurance à pied et, pour un poursuivant, sa **Cible** (que son joueur ou le MJ peut changer). Celui qui le joue a ses manœuvres : **Continuer**, **Prendre un risque**, **Raccourci** et **S'arrêter**, chacune avec son bonus ou malus et le d20 à atteindre, et un rappel de ce que fait le test. Une manœuvre jouée passe le tour ; **Passer le tour** le passe sans jouer.
- **Deux zones, Fuyards et Poursuivants :** chaque participant numéroté dans l'ordre de jeu ; un fuyard avec sa jauge, remplie depuis 0 en vert vers +3 et en rouge vers −3, et ceux qui le poursuivent ; un poursuivant avec le fuyard qu'il chasse et sa jauge, colorée de son point de vue. Celui dont c'est le tour est encadré.
- **Avantage de vitesse :** +1, 0 ou −1, celui d'un fuyard contre le plus rapide de ses poursuivants, celui d'un poursuivant contre le fuyard qu'il chasse, calculé seul et passé aux Actions.
- **À bout de souffle :** à pied, à 0 d'Endurance, un participant passe en Incapacité physique (Ruleset RWF) et sort de la course : le chat l'annonce, il est marqué vaincu et ses tours sont passés.
- **Fin :** à −3 un fuyard est rattrapé (le chat nomme ceux qui l'ont rattrapé), à +3 il a semé ses poursuivants. Il est marqué vaincu dans le suivi de combat et ses tours sont passés ; les poursuivants qui le chassaient passent à un autre fuyard encore en course. Quand un camp n'a plus personne en course, la poursuite se termine : le chat donne l'issue de chacun et le combat est supprimé.
- **Réglages** (MJ, repliés en bas) : vitesse maximale du terrain, camp, cible et déplacement de chacun, ajouter un jeton de la scène, retirer un participant, **Terminer la poursuite**.

## Installation

Le dépôt est privé : Foundry ne peut pas télécharger le module tout seul. Téléchargez `rwf-tools.zip` depuis la dernière release du dépôt (ou le code), décompressez-le dans `Data/modules/rwf-tools`, puis activez-le dans le monde avec Rule Them'All.

## Développement

```
node --test tests/*.test.mjs                 # RTA_REPO=<checkout Rule Them'All>, par défaut ../rule-them-all
node qa/render-windows.mjs <dossier>          # captures des fenêtres et des HUD (playwright-core, Chromium)
```
