# 🌌 PIXELRIFT

**Version 6.2** — mini battle royale 3D jouable dans le navigateur, avec une mécanique signature : le **Rift**, un mini-portail de déplacement à courte portée.

## Lancer le jeu sur ton PC

```bash
npm start
```

À lancer à la racine du projet (là où se trouve ce fichier). Au premier lancement, le script installe tout seul les dépendances et crée `server/.env`. Ensuite :

- **Jeu** : http://localhost:5173
- **Amis sur le même Wi-Fi** : l'adresse `http://IP-DE-TON-PC:5173` s'affiche dans le terminal.
- Comptes créés au **premier lancement** : `titou` (administrateur), `thomas`, `hugo`, `lilou`, `matteo` — mot de passe `pixelrift` (ou celui de `server/.env`). Ensuite les mots de passe sont **hachés** dans `server/data/accounts.json` : change-les dans le jeu (**Quartier général → Compte**), ou via l'administration. Les lignes `ACCOUNT_*_PWD` du `.env` ne servent plus après la première création.
- Un match démarre quand **2 joueurs** sont dans le salon (un seul joueur peut s'entraîner sur les sphères roses de l'avenue centrale).

### Jouer avec quelqu'un qui n'est pas chez toi

L'adresse `192.168.x.x` ne marche que dans ta maison. Pour inviter un cousin ou un ami ailleurs, ouvre un **tunnel gratuit** (Cloudflare, sans compte) dans un second terminal pendant que `npm start` tourne :

```bash
cloudflared tunnel --url http://localhost:5173
```

Il affiche une adresse `https://….trycloudflare.com` à envoyer à ton ami (elle change à chaque lancement, et le jeu s'arrête pour lui quand tu fermes ton PC ou le tunnel).
**Avant de partager cette adresse, change les mots de passe de tous les comptes depuis le jeu** (`Quartier général → Compte`). Important : `ACCOUNT_*_PWD` dans `server/.env` ne sert qu'à créer les comptes lors du premier démarrage ; une fois les comptes créés, modifier ces variables ne change pas les mots de passe déjà enregistrés. N'expose jamais les comptes avec le mot de passe local par défaut.

Pas besoin de GitHub ni de Render pour jouer. Les profils de progression sont sauvegardés dans `server/data/players.json` ; les comptes et les sessions sont enregistrés séparément dans `server/data/`.

## ✨ Nouveautés v6

- **8 cartes jouables** : Monde Rift, Ville Rift, Entrepôt 17, Camp de survie, Zone Toon, Forêt noire, Port Azur et Cratère 9.
- **Monde Rift** (carte par défaut, 690 m) : la Ville Rift, l'Entrepôt 17, la Zone Toon, le Camp de survie et une Forêt noire sont **réunis sur une seule carte**, reliés par des routes de ceinture, avec 4 avant-postes, des forêts et 87 coffres et des trousses de soin. Les sept cartes dédiées restent choisissables pour des parties rapides : Ville Rift, Entrepôt 17, Camp de survie, Zone Toon, Forêt noire, Port Azur et Cratère 9. Code : `client/src/game/world.js`.
- **Plus d'arsenal : tout vient des coffres.** On démarre avec un pistolet ; 5 emplacements d'inventaire ; 23 armes au total (10 armes de base et 13 armes de butin) réparties en 4 raretés ; le butin est perdu à la mort. Barre d'inventaire avec icônes d'armes (rendues automatiquement depuis les modèles 3D, `weaponIcons.js`).
- **Tab** : équipement, carte du monde (coffres fermés, ta position, zone du mode), classement. **Mini-carte** en jeu.
- **Décors interactifs** (`destructibles.js`, table partagée client/serveur) : tonneaux, bonbonnes et voitures explosent (dégâts de zone, réaction en chaîne) ; caisses, boîtes et pots se brisent ; tout réapparaît après 2 minutes. Les tentes sont traversables ; les troncs d'arbres sont fins ; hitbox resserrées.
- **14 nouveaux skins** dans la boutique (commun → légendaire), dont Aurore ajouté en V6.1.
- **Mobile** : joystick, regard au doigt, tir, visée, saut, glisse, rechargement, rift, interactions, construction, carte, micro, pause, taille adaptée automatiquement à l'écran, **boutons déplaçables** (menu pause → Personnaliser les touches : taille, transparence, réinitialisation), plein écran + paysage. Code : `components/TouchControls.jsx`.
- **Tutoriel** PC et mobile : à la première partie, puis depuis le salon et le menu pause.

- **Inventaire** : le joueur commence avec un pistolet ; les autres armes sont obtenues dans les coffres, jusqu'à 5 emplacements.

### Nouveautés V6.2 — contenu et jouabilité

- **Coffres garantis visibles** : l'état des coffres reçu pendant le chargement de la scène est maintenant mis en attente puis appliqué une fois les modèles prêts. Les ouvertures et réapparitions pendant ce chargement sont également mémorisées.
- **Trousses de soin** : trousses rouges à croix blanche, visibles sur les cartes, indiquées sur la mini-carte et la carte complète. Une trousse restaure jusqu'à 35 PV si la santé n'est pas pleine et revient après 55 s.
- **Deux cartes originales** : *Port Azur* (quais, bassin d'eau, entrepôt de pêche, conteneurs, grue et zone de marché) et *Cratère 9* (carrière, cuvette centrale, trois passerelles, zone de forage et camp de maintenance). Elles ont leurs propres plans, volumes, apparitions, coffres, soins et décors destructibles. Les points d'apparition et de loot sont contrôlés contre les obstacles et les zones d'eau.
- **Construction / édition** : 100 matériaux au début du match ; mur, sol, rampe et toit coûtent 10 matériaux. Les murs peuvent être convertis en mur plein, fenêtre ou porte ; les autres pièces peuvent être tournées. Seul le propriétaire peut modifier ou retirer sa pièce. Retirer une pièce rend 5 matériaux. Limites serveur : 24 pièces par joueur, 120 par salon.
- **Six modèles 3D PixelRift** inclus dans `client/public/models/build/` : mur plein, fenêtre, porte, dalle de sol, rampe et toit en bois low-poly. Aucun téléchargement externe nécessaire.
- **Mode appareil modeste** : case à cocher dans le menu principal et le menu pause. Profil de référence visé : iPhone 7, Redmi 9 et appareils proches (sans validation sur ces téléphones réels). Réduit la distance de rendu (caméra 390 m / brouillard 155 m), plafonne la résolution interne à 0,9×, masque les petites plantes/détails et réduit les particules d'effets. Le réglage est conservé sur l'appareil ; il est activé par défaut sur les écrans tactiles si aucun choix n'a été enregistré.
- **Décors explosifs** : les tonneaux, bonbonnes et voitures conservent les explosions et réactions en chaîne existantes. La validation serveur du signal de tir sur décor est rapprochée pour empêcher les interactions très éloignées.
- **Construction synchronisée** : les objets et leurs collisions sont transmis à tous les joueurs ; l'autorité serveur contrôle les matériaux, les limites et les modifications.
- `npm test` couvre maintenant les 8 cartes, les trousses de soin, les six modèles 3D et l'ajout/retrait des collisions dynamiques.

### Correctifs de maintenance V6.1

- Nouvelle carte **Forêt noire** réactivée dans le salon : variante forestière du Camp de survie, avec ambiance et disposition végétale distinctes.
- Nouveau skin procédural **Aurore** : violet profond, visière menthe lumineuse (épique, 1 800 NovaCoins, niveau 8).
- Les coffres tirent désormais uniquement parmi les armes explicitement marquées comme butin, en respectant leur rareté.
- Validation serveur des positions et rotations reçues, avec marge contrôlée pour le Rift et les mouvements rapides.
- Contrôle de ligne de vue côté serveur avant d'appliquer des dégâts, en complément du raycast client.
- Cadence de l'événement de position limitée, cooldown Rift vérifié côté serveur et messages incomplets ignorés proprement.
- Sessions expirées après 7 jours, cookies invalides tolérés et protection contre l'accumulation des clés de limitation de connexion.
- Tests automatisés natifs (sans dépendance) : `npm test`.

### Ajouter un décor destructible
Ajoute la clé du modèle dans `client/src/game/destructibles.js` (`explosive` ou `breakable`, nombre de tirs). Rien d'autre à faire.

## ✨ Nouveautés v5

- **Bots** : l'hôte ajoute de 1 à 7 bots dans le salon, avec 4 niveaux (Recrue, Soldat, Vétéran, Élite : vitesse, temps de réaction, précision, cadence). Ils se déplacent en évitant les obstacles, ouvrent des coffres, capturent la colline, et un match peut démarrer avec un seul joueur humain. Code : `server/src/bots.js`.
- **4 cartes** (choisies par l'hôte) : *Ville Rift* (la grande carte), *Entrepôt 17*, *Camp de survie*, *Zone Toon*. Code : `client/src/game/arenas.js` (données partagées par le client et le serveur) et `maps.js`.
- **4 modes** : *Mêlée générale*, *Équipes*, *Course aux armes* (une arme de plus à chaque élimination, 9 niveaux) et *Roi de la colline* (tiens la zone seul pour marquer 1 point/s ; la zone change toutes les 45 s).
- **Coffres à butin** (touche **F**) : 4 raretés (commun, rare, épique, légendaire), 13 armes **introuvables dans l'arsenal**, soin bonus, emplacement d'arme n° 5, butin perdu à la mort, coffres qui réapparaissent après 75 s. Réglage `Coffres à butin` dans le salon. Armes définies dans `server/src/weapons.js` (bloc `LOOT`).
- **Micro ouvert en permanence** (M pour couper).

### Ajouter une carte ou une arme

- Carte : écrire une fonction dans `arenas.js` (même format que `generateMap`), l'ajouter à `ARENA_BUILDERS` et à `MAPS` dans `maps.js`. Le serveur la lit automatiquement.
- Arme à butin : ajouter l'entrée dans `LOOT` (`weapons.js`), le modèle dans `client/public/models/guns2/`, puis `GUN_FILES` / `GUN_META` (rotation du canon) dans `assetCatalog.js` et `VIEW` dans `weapon.js`.
- Les modèles des packs sont normalisés à une taille réelle (`h` ou `len` dans `assetCatalog.js`) : ajuste ces valeurs si un objet te paraît trop grand ou trop petit.

## Commandes

| Touche | Action |
|---|---|
| ZQSD / flèches | Se déplacer (les marches et bordures jusqu'à 50 cm s'enjambent) |
| Espace / Shift | Sauter / courir |
| C (en courant) | Glisser : élan rapide, caméra basse, fonctionne aussi pour esquiver |
| M | Couper / rétablir le micro (le micro est **ouvert en permanence** ; mode « appuyer pour parler » avec V dans le menu pause) |
| F | Ouvrir un coffre / prendre une trousse de soin (à moins de 4,5 m) |
| B | Activer / quitter le mode construction |
| G | Changer de pièce (mur, sol, rampe, toit) |
| Clic gauche / POSER | Placer la pièce sélectionnée |
| Clic droit | Tourner la pièce de 90° (construction) |
| X | Modifier sa construction (mur plein → fenêtre → porte) |
| Retour arrière | Retirer sa construction (remboursement partiel) |
| Tab (maintenu) | Équipement + carte + classement |
| Clic gauche / clic droit | Tirer / viser (zoom + précision, lunette pour le sniper) |
| R | Recharger |
| 1 à 4 / molette | Changer d'arme (5 = arme trouvée dans un coffre) |
| E | Rift (téléportation) |
| Tab | Scores |
| F3 | Afficher / cacher le compteur de FPS |
| Échap | Libérer la souris (menu : arsenal, crédits) |

## Skins, boutique et personnage

- **23 skins intégrés** : Recrue, Ombre, Désert, Polaire, Écarlate, Urbain, Néon, Doré, Spectre, Forêt, Marine, Rouille, Améthyste, Cuivre, Banquise, Toxique, Magma, Cyberpunk, Sakura, Platine, Éclipse, Dragon et Aurore. Plus 5 traînées de balles.
- Ton personnage apparaît **au centre du menu** avec la première arme de ton arsenal en main ; glisse la souris dessus pour le faire tourner. Dans un salon, chaque joueur apparaît avec son skin et son arme, et les adversaires te voient avec ton skin en match.
- L'administrateur peut toujours **importer ses propres modèles 3D** (voir plus bas) ; les modèles importés n'ont pas de pose pour l'arme (elle flotte près de la main).

## Équipes

L'hôte du salon choisit **Solo** ou **Équipes** (Alpha contre Bravo) et l'objectif (10, 15, 25 ou 40 éliminations). Chacun choisit son équipe avant de déployer. En match : pas de tir allié, alliés en vert et ennemis en rouge, apparition à l'ouest ou à l'est selon l'équipe, score d'équipe à l'écran, classement par équipe et récompenses de victoire d'équipe.

## Économie (NovaCoins, niveaux, pass)

Tout est réglé dans `server/src/economy.js` (et par l'admin pour les événements).

| Récompense de match | NovaCoins | XP |
|---|---|---|
| Participation (45 s minimum) | 25 | 100 |
| Élimination | 12 | 40 |
| Tir à la tête (bonus) | 6 | 15 |
| Victoire (solo ou équipe) | 80 | 200 |

- **Niveaux** jusqu'à 100 (600 XP pour le niveau 2, +120 XP par niveau suivant). Les skins rares et au-delà demandent un niveau minimum.
- **Quêtes** : 3 quotidiennes et 3 hebdomadaires, tirées au sort, avec NovaCoins et XP.
- **Pass de combat** : 30 paliers de 800 XP par saison, piste gratuite et piste Premium (2000 NovaCoins, récompenses récupérables rétroactivement). Skins exclusifs à certains paliers. Si tu possèdes déjà une récompense, tu reçois un remboursement partiel.
- **Prix** : 400 (commun), 900 (rare), 1800 (épique), 3500 (légendaire).

## Compte et administration

- **Compte** : changer de pseudo (3 à 16 caractères, une fois par heure) et de mot de passe (8 caractères minimum, les autres appareils sont déconnectés). Le serveur identifie les joueurs par leur session, jamais par un nom envoyé par le navigateur.
- **Administration** (compte administrateur, onglet dédié du Quartier général) :
  - *Joueurs* : créer / supprimer / suspendre un compte, réinitialiser un mot de passe, nommer un administrateur, donner ou retirer pièces, XP et objets, renommer, expulser, remettre les stats à zéro ;
  - *Boutique* : prix, rareté, niveau minimum, activation, « récompense de pass uniquement » ;
  - *Importer* : ajouter un skin 3D (.glb) avec ses crédits, ou créer une variante de couleur avec aperçu en direct ;
  - *Économie & saison* : multiplicateurs d'XP et de pièces (week-end double XP), soldes, nouvelle saison de pass, annonces ;
  - *Salons* : salons et joueurs en direct, fermeture ; *Journal* : historique des actions admin.

### Importer un skin proprement

1. Un personnage debout, de face (+Z), pieds au sol. Format `.glb`, idéalement moins de 25 Mo.
2. Pour alléger un modèle lourd (Sketchfab, scans…), si tu as Python et Pillow :
   `python tools/optimize_skin.py gros.glb leger.glb` (ajoute `--decimate 0.014 0.025` pour un scan très lourd). L'outil réduit les textures, nettoie le maillage et met le personnage à 1,80 m.
3. Quartier général → Administration → Importer, choisis le fichier, règle le prix et la rareté, **remplis les crédits** (licence CC-BY), et coche « déjà à l'échelle » si tu as utilisé l'outil.

## Interface (style « opérations spéciales »)

Menus et HUD refaits dans un style Black Ops : noir charbon, orange ambre, coins coupés, polices condensées et grain de pellicule.

- En jeu : boussole animée, viseur dynamique qui s'ouvre avec la dispersion, panneau d'armes et de munitions, vitalité segmentée avec indicateur de régénération, capacité Rift avec recharge, killfeed, bandeau « ÉLIMINATION », écran « ÉLIMINÉ » en noir et blanc avec le nom du tueur, pause avec menu et rappel des commandes, chargement avec barre segmentée.
- Les polices (Bebas Neue, Rajdhani, Share Tech Mono) sont chargées depuis Google Fonts : il faut internet. Sans connexion, des polices condensées du système les remplacent.
- Les couleurs et les polices se changent en haut de `client/src/styles/global.css` (variables `--accent`, `--font-title`…).

## Gravité lunaire

Des **disques bleus lumineux** sont répartis sur la carte (avenues, plateformes cyberpunk, camping, ferme…). Marcher dessus donne 9 s de gravité lunaire : sauts très hauts, chute lente. Les positions sont dans `PADS` (`client/src/game/mapLayout.js`), la force dans `LUNAR_*` (`player.js`).

## Chat vocal

Maintiens **V** pour parler. Le son passe directement entre les joueurs (WebRTC) et le volume baisse avec la distance (plein volume à 12 m, silence à 90 m : `VOICE_RANGE` dans `voice.js`).

- Le micro exige `http://localhost` ou une adresse **https** (le tunnel Cloudflare convient). Sur `http://192.168.x.x` on peut écouter mais pas parler.
- Si quelqu'un n'entend rien, c'est généralement un réseau qui bloque la connexion directe : il faudrait alors un serveur TURN.

## Inventaire et arsenal en match

En V6, chaque opérateur commence avec un pistolet et trouve les autres armes dans les coffres. L'inventaire possède 5 emplacements ; une arme déjà possédée n'est pas ajoutée une seconde fois, et le butin est perdu à la réapparition. Le mode Course aux armes suit sa propre progression et attribue l'arme suivante après chaque élimination.

Les tirs des autres joueurs sont visibles (traînées) et audibles (volume selon la distance). Chaque arme possède ses propres statistiques (dégâts, plombs, cadence, chargeur, rechargement, dispersion, portée, recul et zoom). Les définitions sont dans `server/src/weapons.js`.

## Régénération

Sans tirer ni être touché pendant **5 s**, tu regagnes **12 PV/s**. Réglages dans `REGEN` (`server/src/weapons.js`).

## La map (340 × 340 m)

Générée dans `client/src/game/mapLayout.js` (graine fixe : identique pour tous les joueurs) :
centre-ville en damier avec 16 blocs d'immeubles, anneau routier, parcs, base militaire (NO), quartier cyberpunk avec plateformes et escaliers (NE), ferme et champs (SO/O), camping, lac avec île et forêt (SE/E), relais routier (N) et grand parc (S).

Pour la modifier : change les zones et les quantités dans `generateMap`. Les spawns sont dans `server/src/weapons.js` (`SPAWNS`), la map les garde dégagés.

## Assets 3D et échelle

Les packs Poly Pizza n'ont pas la même échelle. `client/src/game/assetCatalog.js` donne pour chaque modèle une **taille réelle en mètres** (`h` hauteur, `len` longueur, ou `scale`) : le jeu mesure le modèle au chargement et l'ajuste tout seul. Pour ajouter un modèle :

1. copie le `.glb` dans `client/public/models/…` (nom sans espaces),
2. ajoute une ligne dans `ASSETS` (`file`, taille, `coll: 'box' | 'trunk' | 'none'`),
3. place-le dans `mapLayout.js`.

Ouvre le jeu avec `?debug` (http://localhost:5173/?debug) pour voir dans la console (F12) la taille d'origine et finale de chaque modèle.

## Performance (objectif 30 FPS)

- Les objets sont **instanciés** par carré de 100 m (très peu d'appels de dessin) et les collisions utilisent une **grille spatiale**.
- Le compteur affiche les FPS instantanés et la moyenne sur 10 s (rouge sous 30).
- Sur un téléphone modeste, active le réglage **Mode appareil modeste** dans le menu principal ou le menu pause. Il réduit la distance de vue, la résolution interne, certains détails végétaux et les particules. Il peut aussi être activé sur PC. Les écrans tactiles l'activent par défaut lors de la première visite, mais le choix est mémorisé.

## Crédits et sécurité

- Crédits des modèles : `CREDITS.md` et écran **Crédits** du menu en jeu (licence CC-BY : la mention est obligatoire).
- Ne mets jamais de vrais mots de passe ou de tokens dans le dépôt : uniquement dans `server/.env` (ignoré par git) ou dans les variables d'environnement de Render.

## Publier le jeu

Un `.zip` posé sur un site **ne se joue pas** : le jeu a besoin d'un serveur qui tourne en permanence (Node.js). Les hébergements de fichiers (Google Drive, itch.io pour du HTML simple, GitHub Pages…) ne conviennent pas.

- **Le plus simple** : jouer depuis ton PC, avec un tunnel pour les amis (voir plus haut). `npm run serve` lance tout sur **un seul port** (3001), sans le mode développement.
- **En ligne 24 h/24** : un hébergeur Node.js (Render, Railway, Fly.io…). `render.yaml` est prêt : un seul service, le serveur sert lui-même le jeu compilé. Sur l'offre gratuite de Render, le disque est effacé à chaque redémarrage : renseigne `GITHUB_TOKEN` et `GITHUB_GIST_ID` (Gist **privé**) pour que comptes, profils, boutique et réglages soient sauvegardés puis restaurés automatiquement. Le service gratuit s'endort après 15 min d'inactivité (premier chargement lent).

## Publication en ligne (détails)

`render.yaml` est conservé pour un hébergement Render. La sauvegarde (comptes, profils, catalogue, réglages) passe par un Gist GitHub **privé** (`GITHUB_TOKEN` avec le droit « gist » + `GITHUB_GIST_ID`) ; en local, elle est inutile.

> Guide pas à pas GitHub + Render : voir [PUBLIER.md](PUBLIER.md).
