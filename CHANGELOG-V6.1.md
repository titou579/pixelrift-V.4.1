# PixelRift V6.1 — maintenance et contenu

## Contenu
- Réactivation de la carte **Forêt noire**, déjà présente dans le générateur mais absente du registre des cartes jouables. Le salon propose maintenant six cartes.
- Ajout du skin procédural **Aurore** (épique, 1 800 NovaCoins, niveau 8). Aucun fichier 3D externe n'est requis.

## Corrections
- Les coffres tirent uniquement parmi les armes explicitement marquées comme butin, et le tirage respecte la rareté annoncée.
- Les arsenaux refusent les armes réservées aux coffres.
- Les positions et rotations des joueurs sont validées côté serveur : limites de carte, coordonnées finies, vitesse de déplacement et marge de déplacement du Rift.
- Les événements de tir vérifient l'état de partie, l'arme réellement équipée et la ligne de vue serveur. Les actions de coffre et de décor exigent un joueur vivant et déployé.
- Le Rift possède un cooldown serveur ; les événements de chat et de position tolèrent les paquets incomplets sans faire planter leur gestionnaire.
- Les sessions serveur expirent après sept jours. Les cookies mal formés sont ignorés sans interrompre la connexion.
- La limitation des tentatives de connexion nettoie les anciennes clés et borne sa mémoire.
- L'upload de sauvegarde refuse les tableaux au lieu d'objets et limite le nombre de profils.
- Documentation corrigée sur les mots de passe : les variables `ACCOUNT_*_PWD` ne s'appliquent qu'à la création initiale des comptes.

## Vérifications
- `npm test` : 7 tests réussis.
- Syntaxe Node vérifiée sur les fichiers JavaScript serveur, client et tests.
- 13 fichiers JSX analysés : aucune erreur syntaxique.
- 4 fichiers JSON validés.
- Les six cartes ont été contrôlées pour les apparitions, coffres, collines et décors destructibles hors limites.

Le build Vite et le lancement serveur complet n'ont pas pu être exécutés dans l'environnement de préparation : le registre npm n'était pas résolvable depuis cet environnement. Aucun résultat de build n'est donc revendiqué.
