# RWF tools

Outils de jeu de Real World Fantasy pour Foundry VTT v14, par-dessus [Rule Them'All](https://github.com/ScallDePell/Rule-Them-All) et son Ruleset RWF. Module privé : les outils propres à RWF vivent ici, jamais dans Rule Them'All.

Il demande Rule Them'All 1.0.10 ou plus récent et le Ruleset RWF 2.2.0 ou plus récent (2.3.0 conseillé), actif dans le monde.

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
- **Dés Foundry / Dés sur table**, retenu par client : sur table, le HUD demande le d20 lu sur la table (et le total des dés de dégâts, ou vide pour que Foundry les lance) avant de lancer l'Action.
- La cible est celle de Foundry (premier jeton ciblé). **Changer** liste les autres combattants de la scène, du plus proche au plus loin, avec la distance bord à bord. La **Couverture** de la cible s'ajoute à sa Défense ; elle est gardée par cible sur ce client.
- Une carte par manière d'agir : mains nues, chaque arme (dégâts, portée, perforation, chargeur et réserve, attaques par round ; Tirer ou Attaquer, Rafale, Full auto, Recharger selon l'arme), chaque pouvoir disponible (latent pour le MJ seulement), et les actions physiques Sprinter et Reprendre son souffle. Chaque bouton montre le d20 à atteindre ; un bouton grisé dit pourquoi au survol (la Condition du Ruleset qui l'interdit, une cible hors de portée, une arme de mêlée qui n'est pas au contact).
- Chaque Action est celle du Ruleset RWF, lancée par Rule Them'All, avec sa carte de chat.
- **Fin de la passe N** ou **Fin du round** passe au combattant suivant ; pour un joueur, c'est le client du MJ qui le fait (il faut un MJ connecté).

## HUD Poursuite

La macro **HUD Poursuite** ouvre la poursuite en cours, la même pour tout le monde (elle est gardée dans le monde).

- Le MJ sélectionne et cible les jetons des participants, puis **Commencer la poursuite** (ou **Ajouter la sélection** en cours de route). Par défaut, un personnage de joueur poursuit et les autres fuient ; la référence de vitesse est le premier fuyard. La jauge de chacun repart de 0.
- Le MJ règle pour chaque participant son rôle, son déplacement (à pied ou l'un de ses véhicules), la référence de vitesse (cible), et la **Vitesse maximale du terrain** (0 : pas de limite). Il peut retirer un participant ou **Terminer la poursuite**.
- Chaque participant a sa jauge de −3 à +3 (la Progression de poursuite du Ruleset) avec ce que veulent dire ses deux bouts. L'avantage de vitesse (+1, 0 ou −1) est calculé contre la référence et passé aux Actions.
- Le joueur qui joue un participant, et le MJ, ont ses coups : **Continuer**, **Prendre un risque**, **Raccourci** (à pied ou ceux du véhicule) et **S'arrêter**. La référence ne joue pas de coup : c'est contre elle que les autres se mesurent.
- Quand une jauge atteint un bout, le chat l'annonce et les coups se figent ; le MJ conclut la poursuite.

## Installation

Le dépôt est privé : Foundry ne peut pas télécharger le module tout seul. Téléchargez `rwf-tools.zip` depuis la dernière release du dépôt (ou le code), décompressez-le dans `Data/modules/rwf-tools`, puis activez-le dans le monde avec Rule Them'All.

## Développement

```
node --test tests/*.test.mjs                 # RTA_REPO=<checkout Rule Them'All>, par défaut ../rule-them-all
node qa/render-windows.mjs <dossier>          # captures des fenêtres et des HUD (playwright-core, Chromium)
```
