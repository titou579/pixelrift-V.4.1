import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';

import { initAccounts, getSession, parseCookies } from './accounts.js';
import { setupGameServer } from './gameServer.js';
import { registerRoutes } from './routes.js';
import { loadPlayers, replaceAllPlayers } from './dataManager.js';
import { restoreFromCloud, startPeriodicCloudBackup } from './cloudBackup.js';
import { UPLOAD_DIR, ensureDirs, reloadAllStores } from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const IS_PROD = process.env.NODE_ENV === 'production';
// En local on accepte n'importe quelle origine (localhost, ou l'IP de ton PC sur le Wi-Fi
// pour jouer avec des amis). En production, seule CLIENT_URL est autorisée.
const CORS_ORIGIN = IS_PROD ? CLIENT_URL : true;
// Les routes de sauvegarde manuelle ne sont actives que si BACKUP_TOKEN est défini (jamais de valeur par défaut)
const BACKUP_TOKEN = process.env.BACKUP_TOKEN || '';

// Derrière un proxy HTTPS (Render, Railway…) : récupère la vraie IP et le protocole
app.set('trust proxy', 1);

ensureDirs();

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, credentials: true },
});

// Les sockets n'acceptent que les utilisateurs connectés : l'identité vient du cookie de session,
// jamais d'un nom envoyé par le navigateur.
io.use((socket, next) => {
  const cookies = parseCookies(socket.request.headers.cookie || '');
  const session = getSession(cookies.session);
  if (!session) return next(new Error('unauthorized'));
  socket.data.user = session;
  next();
});

const game = setupGameServer(io);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));

// Skins importés par l'administrateur
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1h' }));

function requireBackupToken(req, res, next) {
  if (!BACKUP_TOKEN) return res.status(404).json({ error: 'Not found' });
  const token = req.headers['x-backup-token'];
  if (token !== BACKUP_TOKEN) return res.status(403).json({ error: 'Token invalide.' });
  next();
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', game: 'PIXELRIFT', time: new Date().toISOString() });
});

const DATA_FILE = path.join(__dirname, '..', 'data', 'players.json');

app.get('/api/backup/download', requireBackupToken, (_req, res) => {
  if (!fs.existsSync(DATA_FILE)) return res.json({ players: {}, empty: true });
  try {
    const players = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    res.json({ players, count: Object.keys(players).length, time: Date.now() });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lecture backup: ' + e.message });
  }
});

app.post('/api/backup/upload', requireBackupToken, (req, res) => {
  const { players } = req.body || {};
  if (!players || typeof players !== 'object') return res.status(400).json({ error: 'Format invalide (players attendu).' });
  replaceAllPlayers(players);
  res.json({ ok: true, count: Object.keys(players).length });
});

registerRoutes(app, game);

// Jeu compilé (client/dist) : si présent, le serveur le sert lui-même → un seul service à héberger
const DIST = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api\/|socket\.io\/|uploads\/|health).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
  console.log('🖥️  Jeu servi depuis client/dist');
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// --- Démarrage : restauration éventuelle depuis le cloud, puis chargement des données ---
(async () => {
  await restoreFromCloud();
  reloadAllStores();
  initAccounts();
  loadPlayers();
  startPeriodicCloudBackup();
  server.listen(PORT, () => {
    console.log(`🌌 PIXELRIFT API — listening on port ${PORT}`);
  });
})();
