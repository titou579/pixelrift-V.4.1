import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GIST_ID = process.env.GITHUB_GIST_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const DATA_DIR = path.join(__dirname, '..', 'data');
// Fichiers sauvegardés dans le Gist (comptes, profils, catalogue, réglages)
const BACKUP_FILES = ['players.json', 'accounts.json', 'catalog.json', 'settings.json'];

let uploadTimeout = null;
let lastUpload = 0;
const MIN_UPLOAD_INTERVAL = 60 * 1000;

const headers = () => ({
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'pixelrift-backup',
});

export function isCloudBackupEnabled() {
  return !!(GIST_ID && GITHUB_TOKEN);
}

// Au démarrage : restaure les fichiers ABSENTS du disque (utile sur un hébergeur qui efface le disque).
// Retourne le nombre de fichiers restaurés.
export async function restoreFromCloud() {
  if (!isCloudBackupEnabled()) {
    console.log('☁️  Cloud backup désactivé (GITHUB_TOKEN ou GITHUB_GIST_ID manquant)');
    return 0;
  }
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers: headers() });
    if (!res.ok) { console.error(`❌ Cloud download HTTP ${res.status}`); return 0; }
    const data = await res.json();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let n = 0;
    for (const f of BACKUP_FILES) {
      const full = path.join(DATA_DIR, f);
      const content = data.files && data.files[f] && data.files[f].content;
      if (content && !fs.existsSync(full)) {
        JSON.parse(content); // vérifie que c'est du JSON valide
        fs.writeFileSync(full, content);
        n++;
      }
    }
    console.log(n ? `☁️  ${n} fichier(s) restauré(s) depuis le cloud` : '☁️  Rien à restaurer (données locales présentes ou Gist vide)');
    return n;
  } catch (e) {
    console.error('❌ Cloud download erreur:', e.message);
    return 0;
  }
}

export function scheduleCloudUpload() {
  if (!isCloudBackupEnabled()) return;
  if (uploadTimeout) clearTimeout(uploadTimeout);
  uploadTimeout = setTimeout(uploadToCloud, 30000);
}

async function uploadToCloud() {
  if (!isCloudBackupEnabled()) return;
  const now = Date.now();
  if (now - lastUpload < MIN_UPLOAD_INTERVAL) { scheduleCloudUpload(); return; }
  try {
    const files = {};
    for (const f of BACKUP_FILES) {
      const full = path.join(DATA_DIR, f);
      if (fs.existsSync(full)) files[f] = { content: fs.readFileSync(full, 'utf-8') };
    }
    if (!Object.keys(files).length) return;
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    if (!res.ok) { console.error(`❌ Cloud upload HTTP ${res.status}`); return; }
    lastUpload = now;
    console.log(`☁️  Backup cloud OK (${Object.keys(files).length} fichiers)`);
  } catch (e) {
    console.error('❌ Cloud upload erreur:', e.message);
  }
}

export function startPeriodicCloudBackup() {
  if (!isCloudBackupEnabled()) return;
  setInterval(uploadToCloud, 5 * 60 * 1000);
  console.log('☁️  Backup cloud périodique activé (toutes les 5 min)');
}
