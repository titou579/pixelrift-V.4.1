import fs from 'fs';
import path from 'path';
import { scheduleCloudUpload } from './cloudBackup.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

export function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(UPLOAD_DIR, 'skins'), { recursive: true });
}

const registry = [];
// Relit tous les fichiers depuis le disque (après une restauration depuis le cloud)
export function reloadAllStores() { for (const s of registry) s.reload(); }

// Petit magasin JSON : lecture au démarrage, écriture différée et atomique
export function jsonStore(file, fallback) {
  ensureDirs();
  const full = path.join(DATA_DIR, file);
  let data;
  const load = () => {
    try {
      data = JSON.parse(fs.readFileSync(full, 'utf-8'));
    } catch {
      data = typeof fallback === 'function' ? fallback() : structuredClone(fallback);
    }
  };
  load();
  let timer = null;
  const flush = () => {
    ensureDirs();
    const tmp = full + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, full);
    if (file !== 'sessions.json' && file !== 'adminlog.json') scheduleCloudUpload();
  };
  const api = {
    reload: load,
    get data() { return data; },
    set data(v) { data = v; },
    save() { clearTimeout(timer); timer = setTimeout(flush, 300); },
    saveNow() { clearTimeout(timer); flush(); },
    path: full,
  };
  registry.push(api);
  return api;
}
