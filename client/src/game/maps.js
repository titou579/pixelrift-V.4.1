// ============================================================
// REGISTRE DES CARTES — partagé par le client (rendu) et le serveur (bots, coffres, apparitions).
// Données pures (aucune dépendance Three.js).
// ============================================================
import { generateMap, MAP_HALF } from './mapLayout.js';
import { generateArena } from './arenas.js';

export const MAPS = [
  { id: 'ville', name: 'Ville Rift', size: 'Géante', desc: 'La grande carte : centre-ville, base militaire, ferme, camping, lac (340 m).' },
  { id: 'entrepot', name: 'Entrepôt 17', size: 'Moyenne', desc: 'Conteneurs, rayonnages, chariots élévateurs et bureaux — combats serrés (120 m).' },
  { id: 'survie', name: 'Camp de survie', size: 'Moyenne', desc: 'Forêt dense, camp palissadé et miradors en bois (150 m).' },
  { id: 'toon', name: 'Zone Toon', size: 'Petite', desc: 'Tranchées, barrières, épaves et conteneurs — action non-stop (110 m).' },
];
export const DEFAULT_MAP = 'ville';
export const MAP_IDS = MAPS.map((m) => m.id);

export function generateMapById(id, citySpawns) {
  if (id === 'ville' || !MAP_IDS.includes(id)) return generateMap(citySpawns && citySpawns.length ? citySpawns : undefined);
  return generateArena(id);
}
export { MAP_HALF };
