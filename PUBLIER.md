# 🚀 Publier PixelRift (GitHub + Render)

## 1. Mettre le code sur GitHub
1. Sur github.com : **New repository** → nom `pixelrift` → **ne coche rien** (ni README, ni .gitignore).
2. Dans le dossier du projet (celui qui contient `render.yaml`) :
   ```bash
   git init
   git add .
   git commit -m "PixelRift v4.1"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/pixelrift.git
   git push -u origin main
   ```
3. Vérifie sur GitHub qu'**aucun fichier `.env`** n'apparaît (le `.gitignore` les bloque).

## 2. Publier sur Render
1. render.com → **New > Blueprint** → connecte GitHub → choisis `pixelrift`.
2. Render lit `render.yaml`. Renseigne les 5 mots de passe `ACCOUNT_*_PWD`
   (au moins `ACCOUNT_TITOU_PWD` : c'est le compte administrateur).
3. **Apply**. Le premier build prend quelques minutes. L'adresse sera `https://pixelrift-xxxx.onrender.com`.
4. Teste `https://…onrender.com/health` : tu dois voir `{"status":"ok"}`.

## 3. À savoir (offre gratuite)
- Le service **s'endort après 15 min** sans visite (premier chargement ~30 s).
- Le disque est **effacé à chaque redémarrage/déploiement** : sans sauvegarde, les comptes sont recréés
  depuis les variables et la progression est perdue. Pour la garder : crée un Gist GitHub **privé**,
  un token avec le seul droit « gist », et renseigne `GITHUB_TOKEN` et `GITHUB_GIST_ID` sur Render.
- Le micro (chat vocal) fonctionne car Render fournit du https.

## 4. Mettre à jour
`git add . && git commit -m "message" && git push` : Render redéploie tout seul.

## 5. Crédits
Les assets CC-BY exigent la mention de l'auteur : complète `CREDITS.md` et `client/src/game/credits.js`
pour les 5 packs marqués « à compléter » avant d'ouvrir le jeu au public.
