import * as THREE from '../vendor/three.module.js';
// Paleta cerrada sacada del ramo
export const C = {
  bg: 0x07060B, lila: 0xB9A3E3, rosa: 0xF2A7C3, crema: 0xFFF6EC, mant: 0xF6DC8A,
  salvia: 0xA9C8A0, agua: 0x9FD3E6, menta: 0xBFE8D8,
  lilaOsc: 0x6C5AA8, salviaOsc: 0x5E8F7A, salviaMed: 0x86C3A8,
};
// Sombreado en 4 bandas: da el aspecto ilustrado y glifos limpios
const g = new THREE.DataTexture(new Uint8Array([70, 140, 205, 255]), 4, 1, THREE.RedFormat);
g.minFilter = g.magFilter = THREE.NearestFilter; g.needsUpdate = true;
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: g, ...o });
export const addLights = scene => {
  scene.add(new THREE.AmbientLight(0xcfc4ff, 1.1));
  const k = new THREE.DirectionalLight(0xfff1e2, 2.4); k.position.set(4, 8, 6); scene.add(k);
  const r = new THREE.DirectionalLight(0xb9a3e3, 1.1); r.position.set(-6, 3, -5); scene.add(r);
};
// Mantiene el ancho de vista del encuadre horizontal en pantallas verticales
export const fitFov = (cam, aspect, vfov, minAspect = 1.3) => {
  cam.aspect = aspect;
  cam.fov = aspect >= minAspect ? vfov : 2 * Math.atan(Math.tan(vfov * Math.PI / 360) * minAspect / aspect) * 180 / Math.PI;
  cam.updateProjectionMatrix();
};
