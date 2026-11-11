// Lance PixelRift en un seul processus et un seul port (3001) :
// compile le jeu (client/dist) puis démarre le serveur qui le sert lui-même.
//   npm run serve
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = (d) => path.join(root, d);
const run = (cwd, args) => spawnSync('npm', args, { cwd, stdio: 'inherit', shell: true });

for (const d of ['server', 'client']) {
  if (!fs.existsSync(path.join(dir(d), 'node_modules'))) {
    console.log(`\n📦 Installation des dépendances de ${d}…\n`);
    if (run(dir(d), ['install']).status !== 0) process.exit(1);
  }
}

const envPath = path.join(dir('server'), '.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, [
    'NODE_ENV=development', 'PORT=3001',
    `SESSION_SECRET=${crypto.randomBytes(24).toString('hex')}`, 'CLIENT_URL=http://localhost:3001', '',
    'ACCOUNT_TITOU_PWD=', 'ACCOUNT_THOMAS_PWD=', 'ACCOUNT_HUGO_PWD=', 'ACCOUNT_LILOU_PWD=', 'ACCOUNT_MATTEO_PWD=', '',
  ].join('\n'));
}

console.log('\n🔨 Compilation du jeu…\n');
if (run(dir('client'), ['run', 'build']).status !== 0) process.exit(1);

const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
console.log('\n🚀 PixelRift démarre sur un seul port');
console.log('   Jeu          : http://localhost:3001');
if (lan) console.log(`   Amis (Wi-Fi) : http://${lan.address}:3001`);
console.log('   Tunnel       : cloudflared tunnel --url http://localhost:3001\n');

const srv = spawn('node', ['src/index.js'], { cwd: dir('server'), stdio: 'inherit', shell: true });
process.on('SIGINT', () => { srv.kill(); process.exit(0); });
srv.on('exit', (c) => process.exit(c || 0));
