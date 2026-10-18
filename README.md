# RWF tools

Outils de jeu de Real World Fantasy pour Foundry VTT v14, par-dessus [Rule Them'All](https://github.com/ScallDePell/Rule-Them-All) et son Ruleset RWF. Module privé : les outils propres à RWF vivent ici, jamais dans Rule Them'All.

Il demande Rule Them'All 1.0.8 ou plus récent et le Ruleset RWF 2.1.0 ou plus récent, actif dans le monde.

## Demander un test

Au premier lancement, le module crée la macro **Demander un test** et la place dans la barre de macros du MJ.

1. Le MJ clique la macro. La fenêtre liste les joueurs connectés qui possèdent un personnage joueur RWF ; la liste suit les connexions en direct.
2. Il coche un ou plusieurs personnages, choisit la compétence et la DD (les DD sont les paramètres du Ruleset marqués « Difficulté de test »), puis **Envoyer le test**.
3. Chaque joueur choisi voit s'ouvrir une fenêtre qu'il ne peut pas fermer tant qu'il n'a pas répondu : **Lancer les dés** (dés de Foundry, Dice So Nice s'il est installé) ou son résultat du d20 lancé sur la table.
4. Le client du MJ lance alors l'Action « Test demandé par le MJ » du Ruleset avec ce d20 et poste la carte de chat habituelle. Une réussite rapporte de la pratique, comme le prévoit RWF ; c'est le seul test hors combat qui en rapporte.

La fenêtre du MJ montre les tests en attente et leurs résultats. **Annuler** retire une demande et ferme la fenêtre du joueur ; **Vider** efface toute la liste (les tests encore en attente sont annulés). Un joueur qui recharge sa page reçoit de nouveau la demande à sa reconnexion.

## Installation

Le dépôt est privé : Foundry ne peut pas télécharger le module tout seul. Téléchargez `rwf-tools.zip` depuis la dernière release du dépôt (ou le code), décompressez-le dans `Data/modules/rwf-tools`, puis activez-le dans le monde avec Rule Them'All.

## Développement

```
node --test tests/*.test.mjs                 # RTA_REPO=<checkout Rule Them'All>, par défaut ../rule-them-all
node qa/render-windows.mjs <dossier>          # captures des deux fenêtres (playwright-core, Chromium)
```
