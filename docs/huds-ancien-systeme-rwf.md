# HUD Combat et HUD Poursuite dans l'ancien système RWF v0.1.475

Résumé extrait du code de l'ancien système (source de règles et de design uniquement, pas de code à reprendre).

Fichiers sources : `module/mobile-combat-hud.mjs`, `module/mobile-pursuit-hud.mjs`, `module/combat.mjs` (ciblage, distance, dégâts), `module/combat2.mjs` (passes, munitions, couverture, sprint), `module/combat-ui.mjs` (ciblage dans le Combat Tracker, initiative auto), `module/endurance.mjs`, `module/injuries-fatigue.mjs`, `styles/rwf-interface.css`, `CHANGELOG.md`, et `RWF-Reference-Fonctionnelle.docx` (sections COMBAT, TIR, DEP, POUR, écarts E08 à E23).

---

## 1. Ce qu'est un « HUD » dans l'ancien système

- Deux panneaux flottants en HTML pur, posés directement dans `document.body` (pas des Applications Foundry) : `#rwf-mobile-combat-hud` et `#rwf-mobile-pursuit-hud`.
- Chacun a un **bouton lanceur** permanent (icône d20 pour Combat, `fa-gauge-high` pour Poursuite) et un **panneau** avec une barre de titre (« Combat » / « Course poursuite ») et un bouton Fermer.
- Ouverture :
  - mobile : boutons Combat et Poursuite de la barre mobile RWF ; un seul panneau ouvert à la fois (ouvrir l'un ferme l'autre) ;
  - desktop joueur : entrées « HUD Combat » et « HUD Poursuite » dans la hotbar Foundry (ordre : Feuille PJ, Timeline, Calendrier, HUD Combat, HUD Poursuite, Armes, Équipements, Véhicules) ;
  - desktop MJ : raccourcis dans la barre « Demande de test » ; le HUD s'ouvre sous cette barre.
- Desktop : largeur `min(390px, 100vw − 24px)`, déplaçable par la barre de titre, position gardée pendant la session ; Combat et Poursuite peuvent rester ouverts ensemble.
- Mobile : plein écran au-dessus de la barre de lanceurs, liste d'actions défilante, bouton de fin de tour collé en bas.
- Rafraîchissement automatique sur les hooks combat / combattant / acteur / objet / ciblage.
- **Mode de dés TABLE / FOUNDRY** dans les deux HUD : TABLE = le joueur lance de vrais dés et déclare le résultat ; FOUNDRY = jet automatique. La valeur par défaut suit le réglage Foundry `diceConfiguration` pour le d20, et le choix fait dans le HUD reste local au client.

---

## 2. HUD Combat

### 2.1 Quel combattant est affiché

Dans cet ordre : le combattant actif s'il appartient à l'utilisateur (ou si c'est le MJ), sinon le personnage assigné s'il est dans le combat, sinon un token contrôlé engagé, sinon n'importe quel combattant possédé. Côté MJ, le HUD suit donc le combattant dont c'est le tour.

Sans combat actif : message « Aucun combat actif — Démarrez un combat dans Foundry… ».

### 2.2 Mise en page (vue principale « Actions »)

```
┌ ⚔ Combat ─────────────────────────────── ✕ ┐
│ ROUND 2 · PASSE 1/3        ▶ VOTRE TOUR     │  (sinon « Tour : <nom> »)
│ <Nom>   ❤️ 12/15   ⚡ 4/6   🔋 8/9   🛡 14   │  Vitalité, Énergie, Endurance, Défense
│ 🎲 MODE  [TABLE] [FOUNDRY]                  │
│ ┌ 🎯 <Cible>   🛡 13 · 📏 4.5 m      [⌖] ┐   │  bouton = changer de cible
│ │ Couverture  [−] 2 [+]   (MJ seulement) │   │
│ └────────────────────────────────────────┘   │
│ ACTIONS                                      │
│ ┌ [img] Corps-à-corps                     ┐  │
│ │ 🎲 1d4+@for · PA 0                      │  │
│ │ 🎯 d20 requis : 9+          [ATTAQUER]  │  │
│ └─────────────────────────────────────────┘  │
│ ┌ [img] Fusil d'assaut                    ┐  │
│ │ 🎲 2d6 · 150 m · PA 1                   │  │
│ │ 🔸 18/30 · réserve 60 · attaques 1/2    │  │
│ │ 🎯 d20 requis : 12+                     │  │
│ │ [TIR] [RAFALE] [FULL] [RECH.]           │  │  RAFALE/FULL si arme automatique
│ └─────────────────────────────────────────┘  │
│ ┌ [img] <Pouvoir> ⚡3 · 🎯 DD 14 · 🎲 2d6 · 10 m  [UTILISER] ┐
│ ┌ 🏃 Action physique  Courir, sauter…   [AGIR] [SPRINT] ┐   │  toujours en dernier
│ [ ✓ FIN DE LA PASSE 1 ]  ou  [ ✓ FIN DU ROUND ]           │
└──────────────────────────────────────────────┘
```

- Sans cible : carte « 🎯 CIBLE — Aucune cible » avec un bouton **CIBLER**.
- Liste d'actions : profil « Corps-à-corps » natif (toujours présent), puis armes équipées, puis pouvoirs connus du joueur (révélés ; le MJ voit aussi les latents), puis « Action physique ».
- Le libellé du bouton principal est TIR pour une arme à feu, ATTAQUER sinon, UTILISER pour un pouvoir.

### 2.3 Les autres vues du HUD

1. **Choix de cible** : « ← Actions », titre « Cibler un PNJ » (ou « un PJ » si l'acteur est un PNJ). Liste des combattants adverses non vaincus ayant un token, **triés par distance croissante**, avec portrait, nom et distance (« Distance inconnue » à défaut).
2. **Résultat (mode TABLE)** : rappel de l'action, de la cible et du « Résultat requis sur le d20 : N+ », puis question « Comment s'est passé votre jet ? » et quatre boutons sur deux lignes (3/4 + 1/4) : ÉCHEC | ⚠ (échec avec complication), puis RÉUSSITE | ✸ (réussite critique).
3. **Saisie des dégâts (mode TABLE, après une réussite)** : « RÉUSSITE » ou « RÉUSSITE CRITIQUE », champ « Dégâts obtenus avec vos dés » (ou « Points de soin obtenus »), avertissement « Résultat strict des dés uniquement : ne rajoutez aucun bonus et ne retirez ni armure, ni perforation, ni réduction : RWF fera les calculs », bouton APPLIQUER LES DÉGÂTS / LES SOINS.

### 2.4 Ciblage

- Une cible est mémorisée **par combattant et par client** (chaque joueur et le MJ ont la leur), en mémoire locale seulement, jamais dans un document ni un réglage. Elle est indépendante du ciblage natif de Foundry pendant un combat.
- Le Combat Tracker reçoit un bouton ⌖ devant chaque portrait : gris = non ciblé, rouge = cible de l'acteur courant ; un clic sur la cible actuelle la retire.
- Toutes les cibles sont effacées au début et à la fin d'un combat. Une cible qui tombe à 0 Vitalité ou devient « Vaincu » est libérée automatiquement.
- Un PJ cible les PNJ ; un PNJ cible les PJ.

### 2.5 Mécaniques de combat utilisées par le HUD

**Initiative** (réglage « initiative automatique à chaque round », actif par défaut) : à chaque changement de round, le MJ principal relance pour tous les non-vaincus `1d20 + Agilité + Esprit`, avec départage Agilité puis Esprit puis aléatoire (décimales invisibles), publie chaque jet dans le chat, remet la passe à 1 et le tour au premier. Le score affiché est l'entier.

**Passes d'attaque** :
- Attaques par round selon la maîtrise de l'arme : 0 à 2 → 1, 3 à 4 → 2, 5 → 3.
- Le round se joue en passes 1, 2, 3. Pendant la passe N, ne jouent que les combattants qui ont au moins N attaques (meilleure arme équipée ou corps-à-corps) et n'ont pas fini cette passe. La passe suivante commence quand la précédente est terminée ; le round change après la dernière passe utile.
- Chaque attaque consomme la passe en cours : impossible hors de son tour, sur une passe déjà faite, ou au-delà du budget de l'arme.
- Le bouton bas devient « FIN DE LA PASSE X » si le combattant a encore une passe ultérieure, sinon « FIN DU ROUND ». Le bouton natif « Tour suivant » de Foundry est intercepté pour insérer les passes 2 et 3 avant de changer de round.
- Un joueur peut terminer son propre tour : la demande part au MJ par socket.

**Difficulté d'une attaque** :
- Protection effective = max(0, Armure − Perforation de l'arme).
- Défense = 10 + Agilité de la cible + Protection effective.
- DD = Défense + Couverture (couverture des équipements équipés + couverture temporaire du token réglée par le MJ de 0 à 10 via −/+ dans le HUD).
- **« d20 requis »** affiché = DD − Caractéristique − Maîtrise − bonus de l'arme + malus d'Endurance (mêlée et mains nues seulement), borné entre 2 et 20, et réduit de 2 pour une rafale.

**Portée** : distance **bord à bord** des tokens (deux tokens qui se touchent sont à 0). Mêlée = contact obligatoire ; arme à distance = portée maximale (0 = pas de limite). Message « ATTAQUE IMPOSSIBLE — … hors de portée : cible à X m, portée maximale Y m ». La portée est vérifiée avant de choisir TABLE ou FOUNDRY.

**Tir et munitions** :
- Tir simple : 1 munition, sans bonus.
- Rafale courte (arme automatique) : 3 munitions, +2 au test.
- Full-auto : rafale de 3 à +2 par passe disponible ; à la dernière rafale contrôlée, si la maîtrise ne donne que 1 ou 2 attaques, 3 munitions de plus sont perdues par le recul.
- Affichage « chargé/capacité · réserve · attaques restantes/max ».
- Recharger (RECH.) consomme une passe, transfère min(capacité − chargé, réserve) et annonce dans le chat une **attaque d'opportunité possible** si quelqu'un est adjacent (sans la jouer).

**Dégâts** :
- Les armes infligent leurs dégâts bruts à la Vitalité : l'armure compte déjà dans la difficulté et ne réduit pas les dégâts.
- Critique : en FOUNDRY, le nombre de dés de la formule est doublé (1d4+Force → 2d4+Force) ; en TABLE, la valeur saisie est multipliée par 2.
- Application directe à la Vitalité de la cible (par le MJ via socket si le joueur n'en est pas propriétaire). Carte de chat « Dés saisis · Dégâts infligés · Vitalité avant → après · HORS DE COMBAT ».
- Blessure : sur un critique, ou blessure grave si les dégâts atteignent au moins 75 % de la Vitalité max.
- À 0 Vitalité : état Vaincu synchronisé (Combat Tracker et effet de statut). Quand tous les PNJ sont à 0, le combat se termine automatiquement.

**Pouvoirs** : coût en Énergie vérifié puis dépensé, DD propre, portée et cible éventuelle. Application « effet » (texte dans le chat), « dégâts » ou « soins » (sur la cible, ou sur soi). Le jet d'un pouvoir latent lancé par le MJ est chuchoté aux MJ.

**Action physique** : boîte de dialogue « Compétence » (compétences de Force ou d'Agilité) + « DD » (13 par défaut), puis test (FOUNDRY) ou choix du résultat (TABLE), carte de chat.

**Sprint** : interdit à Endurance 0, consomme une passe en combat, déplacement maximal = 2 × Vitesse pendant le round.

**Endurance pendant le combat** : les attaques de mêlée et le sprint marquent un round « physique » ; tous les 3 rounds physiques, +1 essoufflement. Un round sans action ni déplacement récupère ¼ de l'Endurance max. Malus physique selon l'Endurance restante : plus de 75 % → 0, plus de 50 % → −1, plus de 25 % → −2, au-dessous → −3.

**Pratique** : une attaque réussie en combat engagé donne de la pratique dans la maîtrise de l'arme (critique compris).

---

## 3. HUD Poursuite (« Course poursuite »)

### 3.1 Modèle

- Une poursuite est un **Combat Foundry distinct** marqué `encounterType: "pursuit"`, avec un état `pursuitState` : `{ mainActorId, environmentCap, participants }`.
- Par participant : `role` (poursuivant ou fuyard), `vehicleId` (vide = course à pied), `driverId` (le conducteur ; un passager utilise le moyen de son conducteur), `progress` (jauge de −3 à +3), `lastAction`.
- **Cible principale** : un participant (par défaut le premier PNJ) qui sert de référence de vitesse ; il n'a pas de boutons d'action, le MJ joue ses actions spéciales.
- Le MJ principal fait toutes les écritures ; les joueurs envoient leurs actions par socket et le MJ vérifie qu'ils possèdent l'acteur.
- Pas de rounds visibles : depuis la 0.1.195, chaque action fait avancer la poursuite.

### 3.2 Mise en page

Vue MJ sans poursuite : « Poursuite RWF — utilise les participants sélectionnés et ciblés sur la scène » + bouton **DÉMARRER LA POURSUITE** (refusé si un combat normal est actif). Vue joueur sans poursuite : « Aucune poursuite en cours — le MJ démarre et synchronise la poursuite ».

Poursuite en cours :

```
┌ ⏲ Course poursuite ─────────────────────── ✕ ┐
│ Poursuite en cours                    [FIN]  │  FIN : MJ seulement
│ 3 participants · la jauge indique la progression
│ (MJ) Vitesse max environnement [ 0 ] 0 = aucune limite
│ (MJ) [Ajouter sélection / cibles]            │
│ (MJ) [Obstacle] [Raccourci PNJ] [Prise de risque PNJ] [Action spéciale]
│ [TABLE] [FOUNDRY]                            │
│ (si test TABLE en attente) ÉCHEC|⚠  RÉUSSITE|✸
│ ┌ [portrait] <Nom>                    [◎] ┐ │  ◎ = cible principale (MJ)
│ │ Poursuivant · Vitesse exploitable 3      │ │  ou « Sprint 18 m » à pied
│ │ Endurance 6/9 · malus physique −1        │ │  à pied seulement
│ │ ÉCHAPPÉ        En cours        RATTRAPÉ  │ │  sens inversé pour un fuyard
│ │ ●──────────────┼──────────────○          │ │  marqueur sur la piste
│ │ −3             0              +3         │ │
│ │ (MJ) Rôle [POURSUIT][FUIT]  Moyen [▼]  Conducteur [▼]
│ │ (joueur) <Moto> · passager de <X>        │ │
│ │ [⏩ Continuer] [⚡ Prise de risque] [🗺 Raccourci]
│ │ [⌖ Attaquer]  [🎲 Compétence]  [✋ S'arrêter]
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

Une carte par participant, chacune avec **sa propre jauge**. Libellés de jauge : poursuivant « ÉCHAPPÉ … RATTRAPÉ » ; fuyard « RATTRAPÉ … ÉCHAPPÉ ». Statut central : En cours / Cible rattrapée / Fuite réussie / Cible échappée / Fuyard rattrapé.

### 3.3 Démarrage et participants (MJ)

- Démarrer : crée le Combat de poursuite avec les tokens sélectionnés + ciblés (+ le sien), le démarre au round 1.
- Rôle par défaut : PNJ → fuyard, PJ → poursuivant ; modifiable (POURSUIT / FUIT).
- Moyen : « Course à pied » (toujours proposé, même pour un PNJ sans véhicule) ou un objet Véhicule de l'acteur.
- « Ajouter sélection / cibles » ajoute des participants en cours de route.
- Vitesse max d'environnement : plafonne la vitesse des véhicules (0 = sans limite).

### 3.4 Actions et calcul de la jauge

| Action | Test | Effet sur la jauge |
|---|---|---|
| Continuer | DD 13, bonus = maniabilité | avantage de vitesse + résultat |
| Prise de risque | DD 13, maniabilité − 2 | avantage de vitesse + résultat |
| Raccourci | DD 13, maniabilité + 2 | avantage de vitesse + résultat |
| Attaquer | aucun test automatique | 0 (le MJ arbitre) |
| Compétence | aucun test automatique | 0 (le MJ arbitre) |
| S'arrêter | aucun | −1 (le participant reste dans la poursuite) |

- Test : caractéristique de la maîtrise de déplacement du moyen (voiture → véhicule léger, moto, vélo, bateau, monture, aérien, poids lourd, course à pied → Athlétisme…) + maîtrise + maniabilité + bonus d'action, moins le malus d'Endurance à pied.
- Résultat : critique (20 naturel) +2, réussite +1, échec −1, complication (1 naturel) −2.
- Avantage de vitesse : +1 si sa vitesse dépasse celle de la cible principale, −1 si elle est inférieure, 0 si égale.
- Vitesse : à pied = Sprint (sinon 2 × Vitesse) ; en véhicule = Vitesse du véhicule plafonnée par l'environnement.
- En TABLE, le joueur choisit ÉCHEC / ⚠ / RÉUSSITE / ✸ ; en FOUNDRY, le système lance le test.
- Course à pied : impossible à Endurance 0 ; chaque action de déplacement compte comme round physique (+1 essoufflement toutes les 3).
- Chaque action publie une carte de chat : « Poursuite — <nom> : continue — réussite · Vitesse exploitable N · déplacement de jauge +2 ».
- Actions MJ (Obstacle, Raccourci PNJ, Prise de risque PNJ, Action spéciale) : simple carte de chat « Le MJ applique le contexte, le bonus/malus ou la complication appropriée », sans calcul.

### 3.5 Fin

- À +3 : un poursuivant a rattrapé, un fuyard s'est échappé. À −3 : le poursuivant a perdu la cible, le fuyard est rattrapé.
- **Le premier participant qui atteint une borne termine toute la poursuite** : message de fin envoyé à tous et affiché 5 secondes dans le HUD (« Vous avez réussi à fuir », « Vous vous êtes fait rattraper », « Vous avez rattrapé le fuyard », « Le fuyard vous a échappé »), puis suppression du Combat de poursuite. Le MJ peut aussi cliquer FIN.

### 3.6 Véhicules (objet)

Vitesse (abstraite, −2 à 5), Accélération (−3 à 5, non utilisée par le HUD), Maniabilité (−3 à 5), Structure (≥ 1), Blindage (≥ 0), type, maîtrise.

---

## 4. Problèmes déjà relevés dans l'ancien système (Référence fonctionnelle)

- **Unités de vitesse incohérentes** : sprint en mètres (≈ 18) comparé à une vitesse de véhicule abstraite (−2 à 5). Un coureur « bat » donc toujours une voiture.
- La Course à pied a une maniabilité de 2 dans son profil, mais le HUD lui donne 0.
- Le HUD poursuite ne donne pas de pratique (contrairement au combat).
- Le premier participant à ±3 met fin à toute la poursuite : résolution de groupe à définir.
- Le budget d'attaque est consommé même si le tir échoue faute de munitions.
- L'attaque d'opportunité est annoncée pour tout combattant adjacent, allié compris.
- Sprint : 2 × Vitesse dans le code, alors qu'un champ Sprint existe aussi.
- Pouvoirs : l'armure réduit leurs dégâts (pas ceux des armes) et leur critique ne double pas les dés.
- Le README annonce « aucune interface Poursuite pour le MJ », alors que la 0.1.475 en a une (démarrage, configuration, FIN, actions MJ).

---

## 5. Correspondance avec le Ruleset RWF 2.1.0 et Rule Them'All

| Élément de l'ancien HUD | État dans RWF 2.1.0 / RTA |
|---|---|
| Initiative 1d20 + Agi + Esprit chaque round, départage | Présent dans le Ruleset |
| Attaques par round selon maîtrise, passes 1/2/3 | Nombre d'attaques présent ; le séquencement en passes dans le tracker et le bouton « Fin de la passe » sont à faire dans le HUD |
| Défense = 10 + Agi + Protection − Perforation + Couverture | Présent ; la couverture temporaire réglable par le MJ sur le token serait à ajouter côté HUD |
| « d20 requis » contre la cible | À calculer et afficher dans le HUD |
| Ciblage par combattant, tri par distance, portée bord à bord | À faire dans le HUD (RTA ne contrôle pas la portée bord à bord) |
| Munitions, rafales, rechargement | Laissés au MJ dans le Ruleset (champs sur la feuille, pas de décompte) : le HUD pourrait les reprendre |
| Critique ×2 dés, blessure sur critique | Présent ; blessure grave à 75 % laissée au MJ |
| Endurance (essoufflement, malus, sprint) | Présent |
| Mode TABLE / FOUNDRY | rwf-tools 0.1.0 utilise déjà dé Foundry ou valeur tapée : même principe |
| Jauge de poursuite −3..+3, 6 actions, DD 13, ±2 risque/raccourci | Présent (6 tests de poursuite) ; l'avantage de vitesse est **annoncé** à la main, pas calculé |
| Fin de poursuite à ±3 | Laissée au MJ dans le Ruleset ; le HUD pourrait l'annoncer |
| Rôles, conducteur/passager, cible principale, vitesse d'environnement | Absents : seraient l'état propre du HUD poursuite |

---

## 6. Compatibilité avec le Ruleset RWF 2.1.0 (vérifiée dans `Rulesets/rwf/rwf-ruleset-2.1.0.json`, 2026-10-18)

Verdict : les règles des deux HUD sont presque toutes déjà dans le Ruleset. Les HUD seraient des interfaces qui appellent ses Actions. Trois manques demandent de modifier le Ruleset avant de coder.

### Déjà couvert par le Ruleset

- Initiative 1d20 + Agilité + Esprit relancée à chaque round, départage (`initiative.eachRound`, `departage-initiative`).
- Budget d'attaques selon la maîtrise : compteur `attaques-utilisees` remis à 0 à chaque round, condition `attaque-arme-disponible` ; Sprinter consomme une attaque et est impossible à Endurance 0.
- Difficulté d'attaque = 10 + Agilité cible + max(0, Protection − perforation) + couverture. La couverture est une **entrée de l'Action Attaquer** : le HUD peut la fournir.
- Dégâts bruts des armes, dés doublés au critique, blessure sur critique, pratique sur réussite. Pouvoirs : Énergie payée avant le test, dégâts réduits par l'armure moins la perforation (même comportement que l'ancien système).
- Champs d'arme : portée, perforation, automatique, chargeur, munitions, réserve. Champs de véhicule : vitesse, accélération, maniabilité, structure, blindage, maîtrise.
- Poursuite : jauge `progression-poursuite` par personnage, Actions Continuer / Raccourci / Prise de risque (en véhicule et à pied), S'arrêter, Nouvelle poursuite ; DD 13 en paramètre ; deltas +2/+1/−1/−2 + avantage de vitesse. À pied : maniabilité 2 et malus d'essoufflement (corrige l'écart E10 de l'ancien HUD).

### À ajouter au Ruleset avant les HUD

1. **Mode TABLE** : seul le test demandé par le MJ accepte un dé tapé (`d20-annonce`). Attaque, pouvoir et tests de poursuite lancent toujours les dés Foundry, et les dégâts aussi. Il faudrait des variantes « dé annoncé » pour ces tests et une saisie des dégâts.
2. **Munitions, rafale, full-auto, rechargement** : les champs existent mais rien ne les décompte (choix « laissé au MJ » de la 2.0.0). À modéliser en Actions si le HUD doit les gérer.
3. **Passes 1/2/3** : le Ruleset compte les attaques mais ne fait pas jouer les passes dans l'ordre (`initiative.passes` vaut `null`). Le moteur Rule Them'All a ce réglage ; il faudrait l'activer pour retrouver « Fin de la passe X ».

### Différences de règle à trancher

- **Essoufflement** : le Ruleset retire 1 Endurance à chaque combattant tous les 3 rounds. L'ancien système ne comptait que les rounds physiques, rendait ¼ de l'Endurance après un round sans action ni déplacement, et comptait aussi les actions de poursuite à pied.
- **Vitesse en poursuite** : l'avantage de vitesse est choisi à la main (+1 / 0 / −1). Aucune vitesse de course à pied n'existe pour les personnages : un HUD ne peut le calculer que entre véhicules.

### Reste propre au HUD (aucun changement de Ruleset)

Choix et mémoire de la cible, tri par distance, portée bord à bord, affichage du « d20 requis », couverture réglée par le MJ, rôles poursuivant/fuyard, conducteur/passager, cible principale, vitesse max d'environnement, annonce de fin à ±3, fin automatique du combat quand tous les PNJ sont à 0.
