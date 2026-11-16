# PixelRift V6.2 — gameplay, cartes et optimisation mobile

## Gameplay
- Correction de la course d'initialisation des coffres : leur état, ouvertures et réapparitions reçus pendant le chargement sont conservés.
- Ajout de trousses de soin dans les huit cartes, avec rendu 3D low-poly, marqueurs de carte, collecte autoritaire serveur (+35 PV maximum) et réapparition en 55 secondes.
- Ajout de *Port Azur* et *Cratère 9*, deux plans dédiés avec leur propre environnement, objets, apparitions, coffres, soins et reliefs.
- Ajout d'un mode de construction multijoueur : murs, sols, rampes, toits ; coûts en matériaux ; rotation ; édition des murs en version pleine, fenêtre ou porte ; suppression avec remboursement partiel.
- Création de six modèles GLB low-poly originaux pour le système de construction.
- Les objets de construction et leurs collisions sont synchronisés avec les joueurs ; le serveur vérifie leurs limites et bloque les déplacements à travers les murs et dalles.
- Présence de tonneaux et bonbonnes explosifs vérifiée sur les huit cartes ; dégâts de zone et réactions en chaîne conservés. La portée de validation serveur des impacts sur décor est limitée à 85 m.

## Mobile et performance
- Case à cocher **Mode appareil modeste** dans le menu principal et le menu pause, mémorisée localement.
- Réduction de la distance d'affichage, de la résolution interne, des petits objets végétaux et des particules ; mode activé par défaut sur écran tactile si aucun réglage précédent n'existe.
- Contrôles tactiles ajoutés pour activer la construction, sélectionner une pièce, la poser, la modifier ou la retirer.

## Vérifications
- Tests natifs pour les huit cartes, les coffres/soins, les modèles GLB et les collisions ajoutées/supprimées dynamiquement.
- Vérification syntaxique Node sur les fichiers JavaScript.
- Le rendu Vite complet et un test en navigateur réel doivent encore être confirmés avec les dépendances installées.
