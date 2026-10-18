# Changelog

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
