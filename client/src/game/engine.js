import * as THREE from 'three';
import { createSky, SKY } from './sky.js';
import { applyGraphicsPreset } from './graphicsSettings.js';

// Réglages faciles à modifier
export const RENDER_SETTINGS = {
  maxPixelRatio: 1.5,   // baisse à 1 si le jeu rame
  fogNear: 110,
  fogFar: 340,
  fov: 75,
};

export function createEngine(canvas, { lowPower = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !lowPower,
    powerPreference: lowPower ? 'low-power' : 'high-performance',
    precision: lowPower ? 'mediump' : 'highp',
  });

  const scene = new THREE.Scene();
  const horizon = new THREE.Color(SKY.horizon);
  scene.background = horizon;
  scene.fog = new THREE.Fog(horizon, RENDER_SETTINGS.fogNear, RENDER_SETTINGS.fogFar);

  const camera = new THREE.PerspectiveCamera(
    RENDER_SETTINGS.fov,
    window.innerWidth / window.innerHeight,
    0.1,
    lowPower ? 390 : 1200
  );

  // Lumière du jour : ciel/sol + soleil (sans ombres portées, pour tenir les 30 fps)
  scene.add(new THREE.HemisphereLight(0xbfdcff, 0x6a7a55, 1.35));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.position.copy(SKY.sunDir).multiplyScalar(200);
  scene.add(sun);

  const sky = createSky(scene);
  applyGraphicsPreset(renderer, scene, camera, lowPower);

  return { renderer, scene, camera, sky, applyQuality: (enabled) => applyGraphicsPreset(renderer, scene, camera, enabled) };
}
