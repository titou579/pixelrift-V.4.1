import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDamage, isValidLoadout, rollLoot, RARITIES, WEAPONS } from '../server/src/weapons.js';
import { allSkins } from '../server/src/catalog.js';
import { parseCookies } from '../server/src/accounts.js';
import { MAP_IDS, getMap } from '../server/src/maps.js';
import { validatePlayerState } from '../server/src/validation.js';

test('les six cartes sont enregistrées et leurs éléments restent dans leurs limites', () => {
  assert.equal(MAP_IDS.length, 6);
  for (const id of MAP_IDS) {
    const map = getMap(id);
    assert.ok(map.spawns.length > 0, `${id}: aucun point d'apparition`);
    for (const spawn of map.spawns) {
      assert.ok(Math.abs(spawn.x) < map.half, `${id}: spawn X hors limites`);
      assert.ok(Math.abs(spawn.z) < map.half, `${id}: spawn Z hors limites`);
    }
    assert.ok(map.chests.length > 0, `${id}: aucun coffre`);
    assert.ok(map.hills.length > 0, `${id}: aucune zone de colline`);
    for (const chest of map.chests) {
      assert.ok(Math.abs(chest.x) < map.half && Math.abs(chest.z) < map.half, `${id}: coffre hors limites`);
    }
    for (const prop of map.destructibles.values()) {
      assert.ok(Number.isFinite(prop.x) && Number.isFinite(prop.y) && Number.isFinite(prop.z), `${id}: décor invalide`);
      assert.ok(Math.abs(prop.x) < map.half && Math.abs(prop.z) < map.half, `${id}: décor hors limites`);
    }
  }
  assert.equal(getMap('foret').name, 'Forêt noire');
});

test('les arsenaux ne peuvent pas contenir d’armes réservées aux coffres', () => {
  assert.equal(isValidLoadout(['pistol', 'smg', 'assault', 'shotgun']), true);
  assert.equal(isValidLoadout(['pistol', 'smg', 'assault', 'ak47']), false);
  assert.equal(isValidLoadout(['pistol', 'pistol', 'assault', 'shotgun']), false);
  assert.equal(isValidLoadout(['pistol', 'smg', 'assault', 'shotgun', 'deagle']), false);
  assert.ok(WEAPONS.ak47.loot);
  assert.equal(Object.keys(WEAPONS).length, 23);
  assert.equal(Object.values(WEAPONS).filter((weapon) => weapon.loot).length, 13);
});

test('les dégâts sont finis et respectent les limites de plombs', () => {
  const rifle = WEAPONS.pistol;
  assert.ok(computeDamage(rifle, 10, 1, 0) > 0);
  assert.ok(computeDamage(rifle, 10, 999, 999) <= rifle.damage * rifle.headMult * rifle.pellets);
  assert.ok(Number.isFinite(computeDamage(rifle, 100000, 1, 0)));
});

test('le butin renvoie toujours une arme de coffre de la rareté annoncée', () => {
  for (const rarity of Object.keys(RARITIES)) {
    assert.ok(Object.values(WEAPONS).some((w) => w.loot && w.rarity === rarity), `aucune arme de butin ${rarity}`);
  }
  for (let i = 0; i < 300; i++) {
    const loot = rollLoot();
    assert.ok(WEAPONS[loot.weaponId]);
    assert.equal(WEAPONS[loot.weaponId].loot, true);
    assert.equal(WEAPONS[loot.weaponId].rarity, loot.rarity);
    assert.ok(loot.heal >= 0 && loot.heal <= 50);
  }
});

test('la validation réseau refuse les téléportations et les positions impossibles', () => {
  const map = { half: 100 };
  const previous = { x: 0, y: 1.7, z: 0 };
  const valid = validatePlayerState(map, previous, { x: 1, y: 1.7, z: 0 }, { yaw: 7, pitch: 0 }, 50);
  assert.ok(valid);
  assert.ok(valid.rotation.yaw >= -Math.PI && valid.rotation.yaw <= Math.PI);
  assert.equal(validatePlayerState(map, previous, { x: 80, y: 1.7, z: 0 }, { yaw: 0, pitch: 0 }, 50), null);
  assert.equal(validatePlayerState(map, previous, { x: 0, y: 80, z: 0 }, { yaw: 0, pitch: 0 }, 50), null);
  assert.equal(validatePlayerState(map, previous, { x: 0, y: 1.7, z: 0 }, { yaw: NaN, pitch: 0 }, 50), null);
  assert.ok(validatePlayerState(map, previous, { x: 7, y: 1.7, z: 0 }, { yaw: 0, pitch: 0 }, 50, 9.5));
});


test('le skin Aurore est disponible et possède un identifiant unique', () => {
  const skins = allSkins();
  const ids = skins.map((skin) => skin.id);
  assert.equal(new Set(ids).size, ids.length);
  const aurore = skins.find((skin) => skin.id === 'recrue_aurore');
  assert.ok(aurore);
  assert.equal(aurore.rarity, 'epic');
  assert.equal(aurore.price, 1800);
  assert.equal(aurore.model.kind, 'procedural');
});


test('les cookies mal formés ne font pas échouer leur analyse', () => {
  const parsed = parseCookies('session=%ZZ; theme=dark; other=hello%20world');
  assert.equal(parsed.session, undefined);
  assert.equal(parsed.theme, 'dark');
  assert.equal(parsed.other, 'hello world');
});
